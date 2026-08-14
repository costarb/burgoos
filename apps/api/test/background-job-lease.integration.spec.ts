import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BackgroundJobRepository } from "../src/common/background-jobs/background-job.repository";
import { PrismaService } from "../src/platform/database/prisma.service";

const prisma = new PrismaClient() as PrismaService;
const repository = new BackgroundJobRepository(prisma);

describe("BackgroundJobRepository leases", () => {
  beforeEach(async () => {
    await prisma.backgroundJob.deleteMany({ where: { targetType: "LeaseTest" } });
  });

  afterAll(async () => prisma.$disconnect());

  it("deduplicates the same active key", async () => {
    const input = jobInput("dedupe-key");
    const [first, second] = await Promise.all([repository.enqueue(input), repository.enqueue(input)]);
    expect(first.id).toBe(second.id);
    expect(await prisma.backgroundJob.count({ where: { targetType: "LeaseTest" } })).toBe(1);
  });

  it("atomically grants a job to only one worker", async () => {
    await repository.enqueue(jobInput("atomic-key"));
    const claims = await Promise.all([
      repository.claimNext("worker-a", 60_000, new Date(), ["CRITICAL", "HIGH", "NORMAL", "LOW"], ["RETENTION"]),
      repository.claimNext("worker-b", 60_000, new Date(), ["CRITICAL", "HIGH", "NORMAL", "LOW"], ["RETENTION"]),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("renews only the current lease owner", async () => {
    await repository.enqueue(jobInput("heartbeat-key"));
    const lease = await repository.claimNext("worker-a", 60_000, new Date(), ["CRITICAL", "HIGH", "NORMAL", "LOW"], ["RETENTION"]);
    expect(lease).not.toBeNull();
    expect(await repository.heartbeat(lease!.id, { workerId: "worker-b", leaseVersion: lease!.leaseVersion }, 60_000)).toBe(false);
    expect(await repository.heartbeat(lease!.id, { workerId: "worker-a", leaseVersion: lease!.leaseVersion }, 60_000)).toBe(true);
  });

  it("rejects stale completion after an expired lease is recovered", async () => {
    await repository.enqueue(jobInput("recovery-key"));
    const first = await repository.claimNext("worker-a", 1, new Date("2026-08-07T12:00:00Z"), ["CRITICAL", "HIGH", "NORMAL", "LOW"], ["RETENTION"]);
    const second = await repository.claimNext("worker-b", 60_000, new Date("2026-08-07T12:00:01Z"), ["CRITICAL", "HIGH", "NORMAL", "LOW"], ["RETENTION"]);
    expect(second?.id).toBe(first?.id);
    expect(second!.leaseVersion).toBe(first!.leaseVersion + 1);
    expect(await repository.complete(first!.id, { workerId: "worker-a", leaseVersion: first!.leaseVersion })).toBe(false);
    expect(await repository.complete(second!.id, { workerId: "worker-b", leaseVersion: second!.leaseVersion })).toBe(true);
    const attempts = await prisma.backgroundJobAttempt.findMany({
      where: { jobId: first!.id },
      orderBy: { attempt: "asc" },
    });
    expect(attempts.map(({ outcome }) => outcome)).toEqual(["ABANDONED", "SUCCEEDED"]);
  });
});

function jobInput(activeKey: string) {
  return {
    type: "RETENTION" as const,
    priority: "LOW" as const,
    targetType: "LeaseTest",
    targetId: activeKey,
    activeKey,
    availableAt: new Date("2026-08-07T11:00:00Z"),
  };
}
