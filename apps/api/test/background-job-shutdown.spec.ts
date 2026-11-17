import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeBackgroundJobHandler } from "../src/common/background-jobs/background-job.registry";
import { BackgroundJobWorker } from "../src/common/background-jobs/background-job.worker";

const job = { id: "job-1", type: "FISCAL_FILE_RECOVERY", leaseVersion: 1, attempts: 3, createdAt: new Date() };

function setup(handler: RuntimeBackgroundJobHandler) {
  let claimed = false;
  const repository = {
    claimNext: vi.fn(async () => {
      if (claimed) return null;
      claimed = true;
      return job;
    }),
    heartbeat: vi.fn(async () => true),
    reportProgress: vi.fn(async () => true),
    complete: vi.fn(async () => true),
    retryOrFail: vi.fn(async () => "RETRY_WAIT"),
    releaseForShutdown: vi.fn(async () => true),
  };
  const registry = { consumerEnabled: true, listTypes: () => [handler.type], resolve: () => handler };
  const pressure = { canAdmit: () => true };
  const worker = new BackgroundJobWorker(
    repository as never,
    registry as never,
    pressure as never,
    new ConfigService({ BACKGROUND_JOB_POLL_INTERVAL_MS: 5 })
  );
  return { worker, repository };
}

describe("BackgroundJobWorker shutdown (deploy)", () => {
  it("stops claiming, aborts the running job and gives it back to the queue without a retry penalty", async () => {
    let started!: () => void;
    const running = new Promise<void>((resolve) => (started = resolve));
    const handler: RuntimeBackgroundJobHandler = {
      type: "FISCAL_FILE_RECOVERY",
      execute: (_job, signal) =>
        new Promise((_resolve, reject) => {
          started();
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    };
    const { worker, repository } = setup(handler);

    worker.start();
    await running;
    await worker.stop(1_000);

    expect(repository.releaseForShutdown).toHaveBeenCalledWith("job-1", expect.objectContaining({ leaseVersion: 1 }), expect.any(Date), expect.any(Object));
    expect(repository.retryOrFail).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.claimNext).toHaveBeenCalledTimes(1);
  });

  it("does not hang the shutdown when a job ignores the signal", async () => {
    let started!: () => void;
    const running = new Promise<void>((resolve) => (started = resolve));
    const { worker } = setup({
      type: "FISCAL_FILE_RECOVERY",
      execute: () => {
        started();
        return new Promise(() => undefined);
      },
    });

    worker.start();
    await running;
    const before = Date.now();
    await worker.stop(50);
    expect(Date.now() - before).toBeLessThan(1_000);
  });

  it("still retries ordinary failures with the retry policy", async () => {
    const { worker, repository } = setup({
      type: "FISCAL_FILE_RECOVERY",
      execute: async () => {
        throw new Error("provider down");
      },
    });

    expect(await worker.runOnce()).toBe(true);
    expect(repository.retryOrFail).toHaveBeenCalled();
    expect(repository.releaseForShutdown).not.toHaveBeenCalled();
  });
});
