import { describe, expect, it, vi } from "vitest";
import {
  isDateBlockedForProvider,
  SalesImportPreviewService,
} from "./sales-import-preview.service";

describe("SalesImportPreviewService", () => {
  it("allows D+0 for every provider and blocks future dates", () => {
    expect(isDateBlockedForProvider("MERCADO_PAGO", "2026-07-21", "2026-07-21")).toBe(false);
    expect(isDateBlockedForProvider("MERCADO_PAGO", "2026-07-22", "2026-07-21")).toBe(true);
    expect(isDateBlockedForProvider("PAGBANK", "2026-07-21", "2026-07-21")).toBe(false);
    expect(isDateBlockedForProvider("PAGBANK", "2026-07-20", "2026-07-21")).toBe(false);
    expect(isDateBlockedForProvider("PAGBANK", "2026-07-22", "2026-07-21")).toBe(true);
  });
  const registry = { get: vi.fn(() => ({ capabilities: { maxPeriodDays: 31 } })) };
  const service = () =>
    new SalesImportPreviewService(
      { salesImportRun: { updateMany: vi.fn(async () => ({ count: 0 })), findFirst: vi.fn(async () => null), create: vi.fn() } } as never,
      {
        getCredential: vi.fn(async () => ({
          integration: { id: "integration", provider: "PAGBANK", channel: "API", status: "ACTIVE" },
        })),
      } as never,
      registry as never,
      {} as never
    );
  it("rejects reversed and periods longer than 31 days", async () => {
    await expect(
      service().create("tenant", "user", {
        integrationId: "00000000-0000-4000-8000-000000000000",
        startDate: "2026-07-10",
        endDate: "2026-07-01",
        strategy: "PRICE_WEIGHTED",
      })
    ).rejects.toThrow(/1 e 31/);
    await expect(
      service().create("tenant", "user", {
        integrationId: "00000000-0000-4000-8000-000000000000",
        startDate: "2026-05-01",
        endDate: "2026-07-01",
        strategy: "PRICE_WEIGHTED",
      })
    ).rejects.toThrow(/1 e 31/);
  });
  it("expires runs interrupted while fetching before checking for overlaps", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const findFirst = vi.fn(async () => null);
    const current = new SalesImportPreviewService(
      { salesImportRun: { updateMany, findFirst, create: vi.fn(async () => ({ id: "run-new" })) } } as never,
      {
        getCredential: vi.fn(async () => ({
          integration: { id: "integration", provider: "MERCADO_PAGO", channel: "API", status: "ACTIVE" },
        })),
      } as never,
      registry as never,
      {} as never
    );
    await current.create("tenant", "user", {
      integrationId: "00000000-0000-4000-8000-000000000000",
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      strategy: "PRICE_WEIGHTED",
    }).catch(() => undefined);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ["PENDING", "FETCHING"] }, updatedAt: { lt: expect.any(Date) } }),
      data: expect.objectContaining({ status: "FAILED", errorCode: "STALE_RUN" }),
    }));
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(findFirst.mock.invocationCallOrder[0]);
  });
  it("marks the run as failed when an error escapes the per-day handling", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const current = new SalesImportPreviewService(
      { salesImportRun: { update: vi.fn(async () => { throw Object.assign(new Error("Bad Gateway"), { status: 502 }); }), updateMany } } as never,
      {} as never,
      registry as never,
      {} as never
    );
    await expect(current.process("run-1", "tenant")).rejects.toThrow("Bad Gateway");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "run-1", status: { in: ["PENDING", "FETCHING", "IMPORTING"] } },
      data: expect.objectContaining({ status: "FAILED", errorCode: "HTTP_502", errorMessage: "Bad Gateway" }),
    });
  });
  it("rejects overlapping active runs", async () => {
    const prisma = { salesImportRun: { updateMany: vi.fn(async () => ({ count: 0 })), findFirst: vi.fn(async () => ({ id: "existing" })) } };
    const current = new SalesImportPreviewService(
      prisma as never,
      {
        getCredential: vi.fn(async () => ({
          integration: { id: "integration", provider: "PAGBANK", channel: "API", status: "ACTIVE" },
        })),
      } as never,
      registry as never,
      {} as never
    );
    await expect(
      current.create("tenant", "user", {
        integrationId: "00000000-0000-4000-8000-000000000000",
        startDate: "2026-07-01",
        endDate: "2026-07-02",
        strategy: "PRICE_WEIGHTED",
      })
    ).rejects.toThrow(/sobreposto/);
  });
  it("uses the selected provider period capability", async () => {
    const capabilityRegistry = { get: vi.fn(() => ({ capabilities: { maxPeriodDays: 7 } })) };
    const current = new SalesImportPreviewService(
      { salesImportRun: {} } as never,
      {
        getCredential: vi.fn(async () => ({
          integration: { provider: "PAGBANK", status: "ACTIVE" },
        })),
      } as never,
      capabilityRegistry as never,
      {} as never
    );
    await expect(
      current.create("tenant", "user", {
        integrationId: "00000000-0000-4000-8000-000000000000",
        startDate: "2026-07-01",
        endDate: "2026-07-08",
        strategy: "PRICE_WEIGHTED",
      })
    ).rejects.toThrow(/1 e 7/);
  });
  it("persists validated snapshots, blocks incomplete days and processes D+0", async () => {
    const today = businessToday();
    const dayBeforeYesterday = new Date(today.getTime() - 2 * 86400000);
    const yesterday = new Date(today.getTime() - 86400000);
    const run = {
      id: "run",
      tenantId: "tenant",
      integrationId: "integration",
      provider: "PAGBANK",
      channel: "API",
      startDate: dayBeforeYesterday,
      endDate: today,
      integration: {
        externalMerchantId: "merchant",
        credentials: [{ secretCiphertext: "cipher" }],
      },
    };
    const updateRun = vi
      .fn()
      .mockResolvedValueOnce(run)
      .mockImplementation(({ data }) => Promise.resolve({ ...run, ...data }));
    const upsertDay = vi
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve({ id: where.runId_movementDate.movementDate.toISOString().slice(0, 10) })
      );
    const updateDay = vi.fn().mockResolvedValue({});
    const createMovement = vi.fn().mockResolvedValue({});
    const adapter = {
      capabilities: { maxPeriodDays: 31 },
      fetchRange: vi
        .fn()
        .mockResolvedValueOnce({
          days: [
            {
              validated: true,
              pagesFetched: 2,
              totalPages: 2,
              totalElements: 1,
              movements: [
                {
                  providerMovementId: "movement",
                  externalSaleId: "sale",
                  externalEventCode: "1",
                  kind: "SALE",
                  raw: { token: "remove" },
                  sale: {
                    provider: "PAGBANK",
                    channel: "API",
                    providerMovementId: "movement",
                    externalSaleId: "sale",
                    occurredAt: `${dayBeforeYesterday.toISOString().slice(0, 10)}T10:00:00.000Z`,
                    grossAmount: 10,
                    paymentMethod: "PIX",
                    raw: {},
                  },
                },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          days: [
            { validated: false, pagesFetched: 1, totalPages: 1, totalElements: 0, movements: [] },
          ],
        })
        .mockResolvedValueOnce({
          days: [
            { validated: true, pagesFetched: 1, totalPages: 1, totalElements: 0, movements: [] },
          ],
        }),
    };
    const secrets = {
      decrypt: vi.fn(() => "credential"),
      redact: vi.fn(() => ({ token: "[REDACTED]" })),
    };
    const current = new SalesImportPreviewService(
      {
        salesImportRun: { update: updateRun },
        salesImportDay: { upsert: upsertDay, update: updateDay },
        externalSalesMovement: { deleteMany: vi.fn(), create: createMovement },
        externalSaleIdentity: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      {} as never,
      { get: vi.fn(() => adapter) } as never,
      secrets as never
    );

    const result = await current.process("run", "tenant");

    expect(adapter.fetchRange).toHaveBeenCalledTimes(3);
    expect(adapter.fetchRange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        startDate: yesterday.toISOString().slice(0, 10),
        endDate: yesterday.toISOString().slice(0, 10),
      })
    );
    expect(adapter.fetchRange).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        startDate: today.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
      })
    );
    expect(createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "NEW", rawPayload: { token: "[REDACTED]" } }),
      })
    );
    expect(secrets.redact).toHaveBeenCalledWith({ token: "remove" });
    expect(result).toMatchObject({
      status: "PARTIALLY_READY",
      counts: expect.objectContaining({ found: 1, new: 1, blockedDays: 1 }),
    });
  });
  it("reconciles a 31,000-movement preview within the operational test budget", async () => {
    const date = new Date(businessToday().getTime() - 86400000);
    const movements = Array.from({ length: 31000 }, (_, index) => ({
      providerMovementId: `movement-${index}`,
      externalSaleId: `sale-${index}`,
      externalEventCode: "1",
      kind: "SALE" as const,
      raw: {},
      sale: {
        provider: "PAGBANK" as const,
        channel: "API" as const,
        providerMovementId: `movement-${index}`,
        externalSaleId: `sale-${index}`,
        occurredAt: date.toISOString(),
        grossAmount: 10,
        paymentMethod: "PIX" as const,
        raw: {},
      },
    }));
    const run = {
      id: "run",
      tenantId: "tenant",
      integrationId: "integration",
      provider: "PAGBANK",
      channel: "API",
      startDate: date,
      endDate: date,
      integration: {
        externalMerchantId: "merchant",
        credentials: [{ secretCiphertext: "cipher" }],
      },
    };
    const update = vi
      .fn()
      .mockResolvedValueOnce(run)
      .mockImplementation(({ data }) => Promise.resolve({ ...run, ...data }));
    const current = new SalesImportPreviewService(
      {
        salesImportRun: { update },
        salesImportDay: { upsert: vi.fn().mockResolvedValue({ id: "day" }), update: vi.fn() },
        externalSalesMovement: { deleteMany: vi.fn(), create: vi.fn() },
        externalSaleIdentity: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      {} as never,
      {
        get: vi.fn(() => ({
          fetchRange: vi.fn().mockResolvedValue({
            days: [
              {
                validated: true,
                pagesFetched: 31,
                totalPages: 31,
                totalElements: 31000,
                movements,
              },
            ],
          }),
        })),
      } as never,
      { decrypt: vi.fn(() => "credential"), redact: vi.fn(() => ({})) } as never
    );
    const started = Date.now();
    const result = await current.process("run", "tenant");
    expect(result).toMatchObject({
      status: "PREVIEW_READY",
      counts: expect.objectContaining({ found: 31000, new: 31000 }),
    });
    expect(Date.now() - started).toBeLessThan(10000);
  }, 15000);

  it("classifies iFood candidates, existing orders and unknown sales from one range prefetch", async () => {
    const date = new Date(businessToday().getTime() - 86_400_000);
    const sale = (id: string) => ({
      providerMovementId: id,
      externalSaleId: id,
      externalEventCode: "CONCLUDED",
      kind: "SALE" as const,
      raw: {},
      sale: {
        provider: "IFOOD" as const,
        channel: "API" as const,
        providerMovementId: id,
        externalSaleId: id,
        occurredAt: date.toISOString(),
        grossAmount: 10,
        paymentMethod: "PIX" as const,
        raw: {},
      },
    });
    const run = {
      id: "run-ifood",
      tenantId: "tenant",
      integrationId: "integration-ifood",
      provider: "IFOOD",
      channel: "API",
      startDate: date,
      endDate: date,
      requestedByUserId: "user",
      trigger: "MANUAL",
      integration: {
        externalMerchantId: "merchant-ifood",
        environment: "PRODUCTION",
        credentials: [],
      },
    };
    const update = vi
      .fn()
      .mockResolvedValueOnce(run)
      .mockImplementation(({ data }) => Promise.resolve({ ...run, ...data }));
    const adapter = {
      fetchRange: vi.fn().mockResolvedValue({
        days: [
          {
            date: date.toISOString().slice(0, 10),
            validated: true,
            pagesFetched: 2,
            totalPages: 2,
            totalElements: 3,
            movements: [
              sale("new-sale"),
              sale("existing-sale"),
              {
                providerMovementId: "unknown-sale",
                externalSaleId: "unknown-sale",
                externalEventCode: "FUTURE",
                kind: "UNKNOWN",
                sale: null,
                raw: {},
                rejectionCode: "UNKNOWN_STATUS",
              },
            ],
          },
        ],
      }),
    };
    const createIfoodMovement = vi.fn();
    const current = new SalesImportPreviewService(
      {
        salesImportRun: { update },
        salesImportDay: { upsert: vi.fn().mockResolvedValue({ id: "day" }), update: vi.fn() },
        externalSalesMovement: { deleteMany: vi.fn(), create: createIfoodMovement },
        externalSaleIdentity: {
          findMany: vi.fn().mockResolvedValue([{ externalSaleId: "existing-sale" }]),
        },
      } as never,
      {} as never,
      { get: vi.fn(() => adapter) } as never,
      { redact: vi.fn((value) => value) } as never,
      { upsertFromMovement: vi.fn().mockResolvedValue(null) } as never,
      undefined,
      { getCredential: vi.fn().mockResolvedValue({ accessToken: "token" }) } as never
    );
    const result = await current.process("run-ifood", "tenant");
    expect(adapter.fetchRange).toHaveBeenCalledTimes(1);
    expect(adapter.fetchRange).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: "merchant-ifood", credential: "token" })
    );
    expect(result.counts).toMatchObject({
      found: 3,
      historicalCandidates: 1,
      existingOrders: 1,
      unknown: 1,
    });
    // iFood confirmation reads the financial details from sale.raw, so it is kept.
    expect(createIfoodMovement.mock.calls[0][0].data.normalizedData).toHaveProperty("raw");
  });

  describe("automatic mode (persistKnownSales: false)", () => {
    const date = () => businessToday();
    const movement = (id: string, occurredAt: string, feeAmount?: number) => ({
      providerMovementId: `movement-${id}`,
      externalSaleId: id,
      externalEventCode: "approved",
      kind: "SALE" as const,
      raw: {},
      sale: {
        provider: "MERCADO_PAGO" as const,
        channel: "API" as const,
        providerMovementId: `movement-${id}`,
        externalSaleId: id,
        occurredAt,
        grossAmount: 20,
        feeAmount,
        paymentMethod: "PIX" as const,
        raw: {},
      },
    });
    const setup = (persistKnownSales?: boolean) => {
      const today = date();
      const run = {
        id: "run-auto",
        tenantId: "tenant",
        integrationId: "integration-mp",
        provider: "MERCADO_PAGO",
        channel: "API",
        startDate: today,
        endDate: today,
        trigger: "AUTOMATIC",
        integration: { environment: "PRODUCTION", credentials: [{ secretCiphertext: "cipher" }] },
      };
      const update = vi
        .fn()
        .mockResolvedValueOnce(run)
        .mockImplementation(({ data }) => Promise.resolve({ ...run, ...data }));
      const createMovement = vi.fn().mockResolvedValue({});
      const upsertState = vi.fn().mockResolvedValue("state-id");
      const findIdentities = vi
        .fn()
        .mockResolvedValue([{ externalSaleId: "old-1" }, { externalSaleId: "old-2" }]);
      const day = today.toISOString().slice(0, 10);
      const current = new SalesImportPreviewService(
        {
          salesImportRun: { update },
          salesImportDay: { upsert: vi.fn().mockResolvedValue({ id: "day" }), update: vi.fn() },
          externalSalesMovement: { deleteMany: vi.fn(), create: createMovement },
          externalSaleIdentity: { findMany: findIdentities },
        } as never,
        { getCredential: vi.fn().mockResolvedValue({ token: "token" }) } as never,
        {
          get: vi.fn(() => ({
            fetchRange: vi.fn().mockResolvedValue({
              days: [
                {
                  date: day,
                  validated: true,
                  pagesFetched: 1,
                  totalPages: 1,
                  totalElements: 3,
                  movements: [
                    movement("old-1", `${day}T12:00:00.000Z`, 0.5),
                    movement("old-2", `${day}T13:00:00.000Z`),
                    movement("new-1", `${day}T14:30:00.000Z`),
                  ],
                },
              ],
            }),
          })),
        } as never,
        { redact: vi.fn((value) => value) } as never,
        { upsertFromMovement: upsertState } as never
      );
      return {
        run: () => current.process("run-auto", "tenant", { persistKnownSales }),
        createMovement,
        upsertState,
        findIdentities,
        day,
      };
    };

    it("stores only new sales and returns the known ones for in-memory reconciliation", async () => {
      const { run, createMovement, upsertState, findIdentities, day } = setup(false);
      const result = await run();

      expect(findIdentities).toHaveBeenCalledTimes(1);
      expect(createMovement).toHaveBeenCalledTimes(1);
      expect(createMovement).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ externalSaleId: "new-1", status: "NEW" }) })
      );
      // The payload is stored once, in rawPayload, not again inside the normalized sale.
      const stored = createMovement.mock.calls[0][0].data;
      expect(stored.normalizedData).toMatchObject({ externalSaleId: "new-1", grossAmount: 20 });
      expect(stored.normalizedData).not.toHaveProperty("raw");
      // The provider transaction state keeps being refreshed for every movement.
      expect(upsertState).toHaveBeenCalledTimes(3);
      expect(result.knownSales.map((item) => item.externalSaleId)).toEqual(["old-1", "old-2"]);
      expect(result.knownSales[0].sale).toMatchObject({ feeAmount: 0.5 });
      expect(result.latestOccurredAt?.toISOString()).toBe(`${day}T14:30:00.000Z`);
      expect(result.counts).toMatchObject({ found: 3, new: 1, duplicate: 2 });
      expect(result.status).toBe("PREVIEW_READY");
    });

    it("keeps storing every movement in the manual preview", async () => {
      const { run, createMovement } = setup(undefined);
      const result = await run();

      expect(createMovement).toHaveBeenCalledTimes(3);
      expect(createMovement).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ externalSaleId: "old-1", status: "DUPLICATE" }) })
      );
      expect(result.knownSales).toEqual([]);
      expect(result.counts).toMatchObject({ found: 3, new: 1, duplicate: 2 });
    });
  });
});

function businessToday(): Date {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${date}T00:00:00.000Z`);
}
