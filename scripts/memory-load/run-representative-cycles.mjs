import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const options = parseArgs(process.argv.slice(2));
const cycles = [];
const token = await login();

for (let cycle = 1; cycle <= options.cycles; cycle += 1) {
  const startedAt = new Date().toISOString();
  const steps = [];
  await step(steps, "web-login", () => request(`${options.webUrl}/login`));
  await step(steps, "notification-summary", () => api("/api/admin/notifications/summary"));
  let menu;
  await step(steps, "public-menu", async () => {
    menu = await request(`${options.apiUrl}/api/public/tenants/piloto/menu`);
  });
  await step(steps, "order-create", () => request(`${options.apiUrl}/api/public/tenants/piloto/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerName: `Memory Cycle ${cycle}`,
      customerPhone: "5500000000000",
      fulfillmentMethod: "PICKUP",
      paymentMethod: "PIX_MANUAL",
      notes: `memory-cycle:${cycle}`,
      items: [{ productId: menu.categories[0].products[0].id, quantity: 1 }],
    }),
  }, 201));
  await step(steps, "kds-snapshot", () => api("/api/admin/kds/orders"));
  await step(steps, "public-queue", () => request(`${options.apiUrl}/api/public/tenants/piloto/order-queue`));
  const dates = reportDates();
  await step(steps, "sales-report", () => api(`/api/admin/reports/sales?start=${dates.start}&end=${dates.end}&pageSize=100`));
  await step(steps, "management-report", () => api(`/api/admin/reports/management?start=${dates.start}&end=${dates.end}`));
  await step(steps, "csv-export", () => api("/api/admin/exports", {
    method: "POST",
    body: JSON.stringify({ context: "MANAGEMENT_REPORT", format: "CSV", filters: dates }),
  }, 202));
  await step(steps, "boundary-image", uploadBoundaryImage);

  await delay(options.stabilizationMs);
  cycles.push({
    cycle,
    startedAt,
    stabilizedAt: new Date().toISOString(),
    steps,
    apiRssBytes: await sampleRss(options.apiPid),
    webRssBytes: await sampleRss(options.webPid),
    apiMemory: await latestApiMemory(),
  });
  process.stdout.write(`cycle=${cycle}/${options.cycles} status=complete\n`);
}

const result = summarize(cycles, options);
const output = resolve(options.output);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2), "utf8");
process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);

async function login() {
  const response = await request(`${options.apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: options.email, password: options.password }),
  }, 201);
  return response.accessToken;
}

async function uploadBoundaryImage() {
  const sizeBytes = 2 * 1024 * 1024;
  const intent = await api("/api/admin/assets/upload-intents", {
    method: "POST",
    body: JSON.stringify({
      purpose: "PRODUCT_IMAGE",
      fileName: "memory-boundary.png",
      contentType: "image/png",
      sizeBytes,
      width: 4096,
      height: 4096,
    }),
  }, 201);
  const image = Buffer.alloc(sizeBytes);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image);
  image.write("IHDR", 12, "ascii");
  image.writeUInt32BE(4096, 16);
  image.writeUInt32BE(4096, 20);
  await request(new URL(intent.uploadUrl, options.apiUrl).toString(), {
    method: "PUT",
    headers: { ...intent.headers, authorization: `Bearer ${token}` },
    body: image,
  }, 204);
  await api(`/api/admin/assets/upload-intents/${encodeURIComponent(intent.assetKey)}/confirm`, { method: "POST" }, 201);
}

async function api(path, init = {}, expected = 200) {
  return request(`${options.apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init.headers },
  }, expected);
}

async function request(url, init, expected = 200) {
  const response = await fetch(url, init);
  if (response.status !== expected) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${await response.text()}`);
  if (response.status === 204) return undefined;
  const type = response.headers.get("content-type") ?? "";
  return type.includes("application/json") ? response.json() : response.text();
}

async function step(steps, name, operation) {
  const started = Date.now();
  await operation();
  steps.push({ name, durationMs: Date.now() - started, status: "pass" });
}

async function sampleRss(pid) {
  const script = `(Get-Process -Id ${pid} -ErrorAction Stop).WorkingSet64`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script]);
  return Number(stdout.trim());
}

async function latestApiMemory() {
  const content = await readFile(options.apiLog, "utf8");
  const samples = content.split(/\r?\n/).flatMap((line) => {
    const start = line.indexOf('{"event":"resource.process.sample"');
    if (start < 0) return [];
    const end = line.indexOf("}", start);
    try { return [JSON.parse(line.slice(start, end + 1))]; } catch { return []; }
  });
  const sample = samples.at(-1);
  if (!sample) throw new Error(`No resource.process.sample found in ${options.apiLog}`);
  return sample;
}

function summarize(items, config) {
  const first = items[0]?.apiMemory.heapUsed ?? 0;
  const fifth = items.at(-1)?.apiMemory.heapUsed ?? 0;
  const growth = first === 0 ? 0 : (fifth - first) / first;
  return {
    config: { ...config, password: "[redacted]" },
    summary: {
      cycles: items.length,
      apiPeakRssBytes: Math.max(...items.map((item) => item.apiRssBytes)),
      webPeakRssBytes: Math.max(...items.map((item) => item.webRssBytes)),
      firstStabilizedHeapBytes: first,
      fifthStabilizedHeapBytes: fifth,
      stabilizedHeapGrowthRatio: growth,
      accepted: growth <= 0.1 && items.every((item) => item.apiRssBytes <= 460 * 1024 * 1024 && item.webRssBytes <= 460 * 1024 * 1024),
    },
    cycles: items,
  };
}

function reportDates() {
  const end = new Date().toISOString().slice(0, 10);
  const startDate = new Date(`${end}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 30);
  return { start: startDate.toISOString().slice(0, 10), end };
}

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) values.set(args[index], args[index + 1]);
  return {
    apiUrl: values.get("--api-url") ?? "http://localhost:3001",
    webUrl: values.get("--web-url") ?? "http://localhost:3000",
    apiPid: integer(values.get("--api-pid"), "api pid"),
    webPid: integer(values.get("--web-pid"), "web pid"),
    apiLog: values.get("--api-log") ?? "tmp/memory-soak/api.log",
    email: values.get("--email") ?? "admin@burgoos.local",
    password: values.get("--password") ?? "admin123",
    cycles: integer(values.get("--cycles") ?? "5", "cycles"),
    stabilizationMs: integer(values.get("--stabilization-ms") ?? "900000", "stabilization"),
    output: values.get("--output") ?? "tmp/memory-soak/representative-cycles.json",
  };
}

function integer(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function delay(ms) { return new Promise((resolveDelay) => setTimeout(resolveDelay, ms)); }
