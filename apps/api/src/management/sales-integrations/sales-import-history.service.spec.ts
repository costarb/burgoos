import { describe, expect, it, vi } from "vitest";
import { SalesImportHistoryService } from "./sales-import-history.service";
import { SalesImportRetentionService } from "./sales-import-retention.service";

describe("SalesImportHistoryService", () => {
  it("paginates only tenant-owned runs", async () => {
    const findMany = vi.fn(() => ({ query: "items" })); const count = vi.fn(() => ({ query: "count" }));
    const service = new SalesImportHistoryService({ salesImportRun: { findMany, count }, $transaction: vi.fn(async () => [[], 0]) } as never);
    await expect(service.list("tenant", { page: 2, pageSize: 10 })).resolves.toEqual({ items: [], page: 2, pageSize: 10, total: 0 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant" }, skip: 10, take: 10 }));
  });
  it("filters tenant-owned movements and redacts unsafe error details", async () => {
    const findMany = vi.fn(); const count = vi.fn();
    const service = new SalesImportHistoryService({
      salesImportRun: { findFirst: vi.fn().mockResolvedValue({ id: "run" }) },
      externalSalesMovement: { findMany, count },
      $transaction: vi.fn().mockResolvedValue([[{
        id: "movement", providerMovementId: "provider", externalSaleId: "sale", kind: "SALE", status: "FAILED",
        occurredAt: null, grossAmount: null, netAmount: null, feeAmount: null, paymentMethod: null, installments: null,
        rejectionCode: "IMPORT_FAILED", rejectionMessage: "Authorization Bearer secret-token", orderId: null,
      }], 1]),
    } as never);
    const result = await service.movements("tenant", "run", { page: 1, pageSize: 20, status: "FAILED" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant", runId: "run", status: "FAILED" } }));
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  it("purges terminal raw runs older than 180 days without touching identities", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new SalesImportRetentionService({ salesImportRun: { deleteMany } } as never);
    await expect(service.purgeExpired(new Date("2026-07-18T00:00:00.000Z"))).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ createdAt: { lt: new Date("2026-01-19T00:00:00.000Z") } }) });
  });
});
