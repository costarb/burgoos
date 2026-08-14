import type { BackgroundJob } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesImportRetentionService } from "./sales-import-retention.service";

describe("SalesImportRetentionService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("limits every delete category and enqueues a continuation when the deadline is reached", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(6_000);
    const findMany = vi.fn().mockResolvedValue([{ id: "old-1" }, { id: "old-2" }]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const enqueue = vi.fn().mockResolvedValue({});
    const register = vi.fn();
    const service = new SalesImportRetentionService(
      {
        salesImportRun: { findMany, deleteMany },
        oAuthAuthorizationAttempt: { findMany, deleteMany },
        providerNotification: { findMany, deleteMany },
      } as never,
      { enqueue } as never,
      { register } as never,
      { get: vi.fn((key) => key === "RETENTION_DURABLE_JOBS_ENABLED" ? "true" : key === "RETENTION_BATCH_SIZE" ? 2 : 5_000) } as never,
    );

    service.onModuleInit();
    const result = await service.execute({ id: "retention-job" } as BackgroundJob);

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ type: "RETENTION" }));
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(deleteMany).toHaveBeenCalledTimes(3);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "RETENTION",
      dedupeKey: "continuation:retention-job",
      payload: {},
    }));
    expect(result).toEqual({ processedCount: 6 });
  });

  it("does not enqueue a continuation after the final partial batch", async () => {
    const empty = vi.fn().mockResolvedValue([]);
    const enqueue = vi.fn();
    const service = new SalesImportRetentionService(
      {
        salesImportRun: { findMany: empty, deleteMany: vi.fn() },
        oAuthAuthorizationAttempt: { findMany: empty, deleteMany: vi.fn() },
        providerNotification: { findMany: empty, deleteMany: vi.fn() },
      } as never,
      { enqueue } as never,
      undefined,
      { get: vi.fn((key) => key === "RETENTION_DURABLE_JOBS_ENABLED" ? "true" : 250) } as never,
    );

    await expect(service.execute({ id: "retention-job" } as BackgroundJob)).resolves.toEqual({ processedCount: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
