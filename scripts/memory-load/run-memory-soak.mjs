import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const options = parseArgs(process.argv.slice(2));
const samples = [];
const startedAt = Date.now();

if (!options.apiPid && !options.webPid) {
  throw new Error("Provide --api-pid and/or --web-pid");
}

do {
  const timestamp = new Date().toISOString();
  for (const [role, pid] of [["api", options.apiPid], ["web", options.webPid]]) {
    if (!pid) continue;
    const rss = await sampleRss(pid);
    samples.push({ timestamp, role, pid, rss });
  }
  if (Date.now() - startedAt >= options.durationMs) break;
  await delay(options.intervalMs);
} while (true);

const result = summarize(samples, options);
const outputPath = resolve(options.output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
await writeFile(outputPath.replace(/\.json$/i, ".csv"), toCsv(samples), "utf8");
process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    values.set(args[index], args[index + 1]);
  }
  return {
    apiPid: integer(values.get("--api-pid")),
    webPid: integer(values.get("--web-pid")),
    durationMs: integer(values.get("--duration-ms")) ?? 60_000,
    intervalMs: integer(values.get("--interval-ms")) ?? 5_000,
    output: values.get("--output") ?? "tmp/memory-soak/result.json",
  };
}

async function sampleRss(pid) {
  if (platform() === "win32") {
    const script = `(Get-Process -Id ${pid} -ErrorAction Stop).WorkingSet64`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script]);
    return Number(stdout.trim());
  }
  const { stdout } = await execFileAsync("sh", [
    "-c",
    `awk '/VmRSS/ { print $2 * 1024 }' /proc/${pid}/status`,
  ]);
  return Number(stdout.trim());
}

function summarize(samples, config) {
  const byRole = samples.reduce((groups, sample) => {
    (groups[sample.role] ??= []).push(sample);
    return groups;
  }, {});
  const summary = Object.fromEntries(
    Object.entries(byRole).map(([role, roleSamples]) => {
      const rss = roleSamples.map((sample) => sample.rss).sort((a, b) => a - b);
      return [
        role,
        {
          count: rss.length,
          p95RssBytes: percentile(rss, 0.95),
          peakRssBytes: rss.at(-1) ?? 0,
          accepted: percentile(rss, 0.95) <= mb(400) && (rss.at(-1) ?? 0) <= mb(460),
        },
      ];
    })
  );
  return { config, summary, samples };
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function toCsv(samples) {
  return ["timestamp,role,pid,rssBytes", ...samples.map((item) => `${item.timestamp},${item.role},${item.pid},${item.rss}`)].join("\n");
}

function integer(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid positive integer: ${value}`);
  return parsed;
}

function mb(value) {
  return value * 1024 * 1024;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
