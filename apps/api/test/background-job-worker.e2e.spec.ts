import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BackgroundJobRegistry, type RuntimeBackgroundJobHandler } from "../src/common/background-jobs/background-job.registry";
import { BackgroundJobRepository } from "../src/common/background-jobs/background-job.repository";
import { BackgroundJobWorker } from "../src/common/background-jobs/background-job.worker";
import { MemoryPressureService } from "../src/common/observability/memory-pressure.service";
import { RuntimeRoleService } from "../src/config/runtime-role.service";
import { PrismaService } from "../src/platform/database/prisma.service";

const prisma = new PrismaClient() as PrismaService;
const repository = new BackgroundJobRepository(prisma);

describe("BackgroundJobWorker", () => {
  beforeEach(async () => {
    await prisma.backgroundJob.deleteMany({ where: { targetType: "WorkerTest" } });
  });
  afterAll(async () => prisma.$disconnect());

  it("drains 100 startup jobs with concurrency one per worker", async () => {
    await prisma.backgroundJob.createMany({
      data: Array.from({ length: 100 }, (_, index) => ({ type: "EXPORT", priority: "LOW", targetType: "WorkerTest", targetId: String(index), activeKey: `startup-${index}`, payload: {} })),
    });
    let active = 0;
    let maxActive = 0;
    const handler: RuntimeBackgroundJobHandler = {
      type: "EXPORT",
      execute: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return { processedCount: 1 };
      },
    };
    const workers = [worker(handler), worker(handler)];
    let processed = true;
    while (processed) processed = await runPair(workers);
    expect(await prisma.backgroundJob.count({ where: { targetType: "WorkerTest", status: "SUCCEEDED" } })).toBe(100);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("recovers a job leased by a dead worker exactly once", async () => {
    const job = await repository.enqueue({ type: "EXPORT", priority: "LOW", targetType: "WorkerTest", targetId: "recover", activeKey: "recover" });
    const deadLease = await repository.claimNext("dead-worker", 1, new Date(), ["CRITICAL", "HIGH", "NORMAL", "LOW"], ["EXPORT"]);
    expect(deadLease?.id).toBe(job.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    let executions = 0;
    const recoveryWorker = worker({ type: "EXPORT", execute: async () => { executions += 1; return { processedCount: 1 }; } });
    expect(await recoveryWorker.runOnce()).toBe(true);
    expect(await recoveryWorker.runOnce()).toBe(false);
    expect(executions).toBe(1);
    expect((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("SUCCEEDED");
  });

  it("keeps critical work admissible while high pressure pauses low priority", async () => {
    await repository.enqueue({ type: "EXPORT", priority: "LOW", targetType: "WorkerTest", targetId: "low", activeKey: "pressure-low" });
    await repository.enqueue({ type: "EXPORT", priority: "CRITICAL", targetType: "WorkerTest", targetId: "critical", activeKey: "pressure-critical" });
    const config = new ConfigService({ MEMORY_WARNING_RSS_MB: 1, MEMORY_HIGH_RSS_MB: 2, MEMORY_PEAK_RSS_MB: 3, MEMORY_PRESSURE_CONSECUTIVE_SAMPLES: 2 });
    const pressure = new MemoryPressureService(config);
    pressure.observe(3 * 1024 * 1024);
    pressure.observe(3 * 1024 * 1024);
    const processed: string[] = [];
    const pressureWorker = worker({ type: "EXPORT", execute: async (job) => { processed.push(job.targetId); return {}; } }, pressure);
    expect(await pressureWorker.runOnce()).toBe(true);
    expect(await pressureWorker.runOnce()).toBe(false);
    expect(processed).toEqual(["critical"]);
    expect((await prisma.backgroundJob.findFirstOrThrow({ where: { targetId: "low" } })).status).toBe("PENDING");
  });

  it("stops an idle polling loop gracefully", async () => {
    const idleWorker = worker({ type: "EXPORT", execute: async () => ({}) });
    idleWorker.start();
    await expect(idleWorker.stop()).resolves.toBeUndefined();
  });
});

function worker(handler: RuntimeBackgroundJobHandler, pressure?: MemoryPressureService): BackgroundJobWorker {
  const registry = new BackgroundJobRegistry({ consumesBackgroundJobs: true } as RuntimeRoleService);
  registry.register(handler);
  const config = new ConfigService({ BACKGROUND_JOB_LEASE_MS: 10_000, BACKGROUND_JOB_POLL_INTERVAL_MS: 5 });
  return new BackgroundJobWorker(repository, registry, pressure ?? new MemoryPressureService(config), config);
}

async function runPair(workers: BackgroundJobWorker[]): Promise<boolean> {
  const results = await Promise.all(workers.map((item) => item.runOnce()));
  return results.some(Boolean);
}
