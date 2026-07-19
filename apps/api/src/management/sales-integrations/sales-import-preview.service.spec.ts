import { describe, expect, it, vi } from "vitest";
import { SalesImportPreviewService } from "./sales-import-preview.service";

describe("SalesImportPreviewService", () => {
  const registry = { get: vi.fn(() => ({ capabilities: { maxPeriodDays: 31 } })) };
  const service = () => new SalesImportPreviewService({ salesImportRun: { findFirst: vi.fn(async () => null), create: vi.fn() } } as never, { getCredential: vi.fn(async () => ({ integration: { id: "integration", provider: "PAGBANK", channel: "API", status: "ACTIVE" } })) } as never, registry as never, {} as never);
  it("rejects reversed and periods longer than 31 days", async () => {
    await expect(service().create("tenant", "user", { integrationId: "00000000-0000-4000-8000-000000000000", startDate: "2026-07-10", endDate: "2026-07-01", strategy: "PRICE_WEIGHTED" })).rejects.toThrow(/1 e 31/);
    await expect(service().create("tenant", "user", { integrationId: "00000000-0000-4000-8000-000000000000", startDate: "2026-05-01", endDate: "2026-07-01", strategy: "PRICE_WEIGHTED" })).rejects.toThrow(/1 e 31/);
  });
  it("rejects overlapping active runs", async () => {
    const prisma = { salesImportRun: { findFirst: vi.fn(async () => ({ id: "existing" })) } };
    const current = new SalesImportPreviewService(prisma as never, { getCredential: vi.fn(async () => ({ integration: { id: "integration", provider: "PAGBANK", channel: "API", status: "ACTIVE" } })) } as never, registry as never, {} as never);
    await expect(current.create("tenant", "user", { integrationId: "00000000-0000-4000-8000-000000000000", startDate: "2026-07-01", endDate: "2026-07-02", strategy: "PRICE_WEIGHTED" })).rejects.toThrow(/sobreposto/);
  });
  it("uses the selected provider period capability", async () => {
    const capabilityRegistry = { get: vi.fn(() => ({ capabilities: { maxPeriodDays: 7 } })) };
    const current = new SalesImportPreviewService({ salesImportRun: {} } as never, { getCredential: vi.fn(async () => ({ integration: { provider: "PAGBANK", status: "ACTIVE" } })) } as never, capabilityRegistry as never, {} as never);
    await expect(current.create("tenant", "user", { integrationId: "00000000-0000-4000-8000-000000000000", startDate: "2026-07-01", endDate: "2026-07-08", strategy: "PRICE_WEIGHTED" })).rejects.toThrow(/1 e 7/);
  });
  it("persists validated snapshots and blocks incomplete and current days", async () => {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const dayBeforeYesterday = new Date(today.getTime() - 2 * 86400000);
    const yesterday = new Date(today.getTime() - 86400000);
    const run = {
      id: "run", tenantId: "tenant", integrationId: "integration", provider: "PAGBANK", channel: "API",
      startDate: dayBeforeYesterday, endDate: today,
      integration: { externalMerchantId: "merchant", credentials: [{ secretCiphertext: "cipher" }] },
    };
    const updateRun = vi.fn()
      .mockResolvedValueOnce(run)
      .mockImplementation(({ data }) => Promise.resolve({ ...run, ...data }));
    const upsertDay = vi.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.runId_movementDate.movementDate.toISOString().slice(0, 10) }));
    const updateDay = vi.fn().mockResolvedValue({});
    const createMovement = vi.fn().mockResolvedValue({});
    const adapter = { capabilities: { maxPeriodDays: 31 }, fetchDay: vi.fn()
      .mockResolvedValueOnce({ validated: true, pagesFetched: 2, totalPages: 2, totalElements: 1, movements: [{
        providerMovementId: "movement", externalSaleId: "sale", externalEventCode: "1", kind: "SALE", raw: { token: "remove" },
        sale: { provider: "PAGBANK", channel: "API", providerMovementId: "movement", externalSaleId: "sale", occurredAt: `${dayBeforeYesterday.toISOString().slice(0, 10)}T10:00:00.000Z`, grossAmount: 10, paymentMethod: "PIX", raw: {} },
      }] })
      .mockResolvedValueOnce({ validated: false, pagesFetched: 1, totalPages: 1, totalElements: 0, movements: [] }) };
    const secrets = { decrypt: vi.fn(() => "credential"), redact: vi.fn(() => ({ token: "[REDACTED]" })) };
    const current = new SalesImportPreviewService({
      salesImportRun: { update: updateRun }, salesImportDay: { upsert: upsertDay, update: updateDay },
      externalSalesMovement: { deleteMany: vi.fn(), create: createMovement }, externalSaleIdentity: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never, {} as never, { get: vi.fn(() => adapter) } as never, secrets as never);

    const result = await current.process("run", "tenant");

    expect(adapter.fetchDay).toHaveBeenCalledTimes(2);
    expect(adapter.fetchDay).toHaveBeenNthCalledWith(2, expect.objectContaining({ date: yesterday.toISOString().slice(0, 10) }));
    expect(createMovement).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "NEW", rawPayload: { token: "[REDACTED]" } }) }));
    expect(secrets.redact).toHaveBeenCalledWith({ token: "remove" });
    expect(result).toMatchObject({ status: "PARTIALLY_READY", counts: expect.objectContaining({ found: 1, new: 1, blockedDays: 2 }) });
  });
  it("reconciles a 31,000-movement preview within the operational test budget", async () => {
    const date = new Date(Date.now() - 86400000); date.setUTCHours(0, 0, 0, 0);
    const movements = Array.from({ length: 31000 }, (_, index) => ({ providerMovementId: `movement-${index}`, externalSaleId: `sale-${index}`, externalEventCode: "1", kind: "SALE" as const, raw: {}, sale: { provider: "PAGBANK" as const, channel: "API" as const, providerMovementId: `movement-${index}`, externalSaleId: `sale-${index}`, occurredAt: date.toISOString(), grossAmount: 10, paymentMethod: "PIX" as const, raw: {} } }));
    const run = { id: "run", tenantId: "tenant", integrationId: "integration", provider: "PAGBANK", channel: "API", startDate: date, endDate: date, integration: { externalMerchantId: "merchant", credentials: [{ secretCiphertext: "cipher" }] } };
    const update = vi.fn().mockResolvedValueOnce(run).mockImplementation(({ data }) => Promise.resolve({ ...run, ...data }));
    const current = new SalesImportPreviewService({ salesImportRun: { update }, salesImportDay: { upsert: vi.fn().mockResolvedValue({ id: "day" }), update: vi.fn() }, externalSalesMovement: { deleteMany: vi.fn(), create: vi.fn() }, externalSaleIdentity: { findUnique: vi.fn().mockResolvedValue(null) } } as never, {} as never, { get: vi.fn(() => ({ fetchDay: vi.fn().mockResolvedValue({ validated: true, pagesFetched: 31, totalPages: 31, totalElements: 31000, movements }) })) } as never, { decrypt: vi.fn(() => "credential"), redact: vi.fn(() => ({})) } as never);
    const started = Date.now(); const result = await current.process("run", "tenant");
    expect(result).toMatchObject({ status: "PREVIEW_READY", counts: expect.objectContaining({ found: 31000, new: 31000 }) });
    expect(Date.now() - started).toBeLessThan(10000);
  }, 15000);
});
