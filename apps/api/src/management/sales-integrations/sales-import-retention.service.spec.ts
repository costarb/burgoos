import type { BackgroundJob } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesImportRetentionService } from "./sales-import-retention.service";

function emptyIfoodPrisma() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
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
      $executeRaw: vi.fn().mockResolvedValue(0),
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
        $executeRaw: vi.fn().mockResolvedValue(0),
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

  describe("sales import compaction (spec 030)", () => {
    const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?").replace(/\s+/g, " ");
    const build = (executeRaw: ReturnType<typeof vi.fn>) => {
      const empty = vi.fn().mockResolvedValue([]);
      return new SalesImportRetentionService(
        {
          salesImportRun: { findMany: empty, deleteMany: vi.fn() },
          oAuthAuthorizationAttempt: { findMany: empty, deleteMany: vi.fn() },
          providerNotification: { findMany: empty, deleteMany: vi.fn() },
          ...emptyIfoodPrisma(),
          $executeRaw: executeRaw,
        } as never,
        { enqueue: vi.fn() } as never,
        undefined,
        { get: vi.fn((key) => (key === "RETENTION_DURABLE_JOBS_ENABLED" ? "true" : key === "RETENTION_DEADLINE_MS" ? 0 : 250)) } as never
      );
    };

    it("compacts duplicates, drops automatic runs without new sales and redacts old payloads", async () => {
      const executeRaw = vi.fn().mockResolvedValueOnce(120).mockResolvedValueOnce(30).mockResolvedValueOnce(7);
      const service = build(executeRaw);
      const logs: string[] = [];
      (service as unknown as { logger: { log: (m: string) => void } }).logger = { log: (m) => logs.push(m) };
      const now = new Date("2026-11-20T05:00:00.000Z");

      const deleted = await service.purgeExpired(now);

      expect(deleted).toBe(150);
      const [compact, runs, redact] = executeRaw.mock.calls;
      expect(sqlOf(compact)).toContain("DELETE FROM external_sales_movements");
      expect(sqlOf(compact)).toContain("m.status = 'DUPLICATE'");
      expect(sqlOf(compact)).toContain(`r."trigger" = 'AUTOMATIC'`);
      expect(sqlOf(runs)).toContain("DELETE FROM sales_import_runs");
      expect(sqlOf(runs)).toContain("COALESCE(counts->>'new', '0') = '0'");
      expect(runs[1]).toEqual(new Date("2026-11-18T05:00:00.000Z")); // 2 days
      expect(sqlOf(redact)).toContain("UPDATE external_sales_movements SET raw_payload");
      expect(redact).toContainEqual(new Date("2026-10-21T05:00:00.000Z")); // 30 days
      // Orders, identities and provider transaction states are never part of the statements.
      for (const call of executeRaw.mock.calls) expect(sqlOf(call)).not.toMatch(/orders|external_sale_identities|provider_transaction_states/);
      expect(JSON.parse(logs[0])).toMatchObject({
        event: "sales.retention.completed",
        compactedMovements: 120,
        deletedRuns: 30,
        redactedPayloads: 7,
        hasMore: false,
      });
    });

    it("asks for a continuation while a full batch was compacted", async () => {
      const executeRaw = vi.fn().mockResolvedValueOnce(2000).mockResolvedValue(0);
      const enqueue = vi.fn();
      const service = build(executeRaw);
      (service as unknown as { jobs: { enqueue: typeof enqueue } }).jobs = { enqueue };
      await service.execute({ id: "job-1" } as BackgroundJob);
      expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "continuation:job-1" }));
    });
  });
});
