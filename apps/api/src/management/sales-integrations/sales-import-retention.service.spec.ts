import type { BackgroundJob } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesImportRetentionService } from "./sales-import-retention.service";

function emptyIfoodPrisma() {
  return {
    externalFinancialSale: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
    externalFinancialEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
    externalSettlement: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    },
  };
}

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
        ...emptyIfoodPrisma(),
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
        ...emptyIfoodPrisma(),
      } as never,
      { enqueue } as never,
      undefined,
      { get: vi.fn((key) => key === "RETENTION_DURABLE_JOBS_ENABLED" ? "true" : 250) } as never,
    );

    await expect(service.execute({ id: "retention-job" } as BackgroundJob)).resolves.toEqual({ processedCount: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("redacts expired iFood raw payloads without deleting the canonical rows", async () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    const empty = vi.fn().mockResolvedValue([]);
    const saleUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const eventUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const settlementUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      salesImportRun: { findMany: empty, deleteMany: vi.fn() },
      oAuthAuthorizationAttempt: { findMany: empty, deleteMany: vi.fn() },
      providerNotification: { findMany: empty, deleteMany: vi.fn() },
      externalFinancialSale: {
        findMany: vi.fn().mockResolvedValue([{ id: "sale-1" }]),
        updateMany: saleUpdateMany,
      },
      externalFinancialEvent: {
        findMany: vi.fn().mockResolvedValue([{ id: "event-1" }]),
        updateMany: eventUpdateMany,
      },
      externalSettlement: {
        findMany: vi.fn().mockResolvedValue([{ id: "settlement-1" }]),
        updateMany: settlementUpdateMany,
      },
    };
    const service = new SalesImportRetentionService(
      prisma as never,
      undefined,
      undefined,
      { get: vi.fn(() => 250) } as never
    );

    const now = new Date("2026-09-07T00:00:00.000Z");
    const result = await service.purgeExpired(now);

    expect(prisma.externalFinancialSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: "IFOOD",
          NOT: { rawPayload: { path: ["redacted"], equals: true } },
        }),
      })
    );
    expect(saleUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sale-1"] } },
      data: { rawPayload: { redacted: true, redactedAt: now.toISOString() } },
    });
    expect(eventUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["event-1"] } },
      data: { rawPayload: { redacted: true, redactedAt: now.toISOString() } },
    });
    expect(settlementUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["settlement-1"] } },
      data: { rawPayload: { redacted: true, redactedAt: now.toISOString() } },
    });
    // Only rawPayload is overwritten: no other field/table is touched by redaction.
    expect(saleUpdateMany.mock.calls[0][0].data).toEqual({
      rawPayload: { redacted: true, redactedAt: now.toISOString() },
    });
    // purgeExpired still reports deleted rows only; execute() reports deleted + redacted.
    expect(result).toBe(0);
  });

  it("skips already-redacted rows so the same records are not rewritten every day", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new SalesImportRetentionService(
      {
        salesImportRun: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        oAuthAuthorizationAttempt: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        providerNotification: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
        externalFinancialSale: { findMany, updateMany: vi.fn() },
        externalFinancialEvent: { findMany, updateMany: vi.fn() },
        externalSettlement: { findMany, updateMany: vi.fn() },
      } as never,
      undefined,
      undefined,
      { get: vi.fn(() => 250) } as never
    );
    await service.purgeExpired(new Date("2026-09-07T00:00:00.000Z"));
    for (const call of findMany.mock.calls) {
      expect(call[0].where.NOT).toEqual({ rawPayload: { path: ["redacted"], equals: true } });
    }
  });
});
