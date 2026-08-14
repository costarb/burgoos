import { describe, expect, it, vi } from "vitest";
import { BackgroundJobRepository } from "../src/common/background-jobs/background-job.repository";

const memoryStart = { rss: 100, heapUsed: 50, heapTotal: 70, external: 10, arrayBuffers: 5 };
const memoryEnd = { rss: 120, heapUsed: 55, heapTotal: 70, external: 12, arrayBuffers: 6 };

describe("background job attempt observability", () => {
  it("persists bounded resource snapshots and attempt outcome on completion", async () => {
    const attemptUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      backgroundJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      backgroundJobAttempt: { updateMany: attemptUpdate },
    };
    const repository = new BackgroundJobRepository({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await repository.complete("job-1", { workerId: "worker-1", leaseVersion: 1 }, new Date(), {
      memoryStart,
      memoryEnd,
      durationMs: 250,
      processedCount: 12,
    });

    expect(attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ memoryStart, memoryEnd, durationMs: 250, processedCount: 12 }),
    }));
  });

  it("closes expired running attempts as abandoned with a terminal snapshot", async () => {
    const attemptUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      backgroundJob: {
        findMany: vi.fn().mockResolvedValue([{ id: "job-1", attempts: 1, maxAttempts: 5 }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      backgroundJobAttempt: { updateMany: attemptUpdate },
    };
    const repository = new BackgroundJobRepository({ $transaction: vi.fn((callback) => callback(tx)) } as never);

    await repository.recoverExpiredLeases(new Date());

    expect(attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ outcome: "ABANDONED", memoryEnd: expect.objectContaining({ rss: expect.any(Number) }) }),
    }));
  });
});
