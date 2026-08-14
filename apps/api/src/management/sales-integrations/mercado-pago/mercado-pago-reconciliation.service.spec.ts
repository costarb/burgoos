/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";
import { MercadoPagoReconciliationService } from "./mercado-pago-reconciliation.service";
import { MercadoPagoReconciliationScheduler } from "./mercado-pago-reconciliation.scheduler";

describe("MercadoPagoReconciliationService", () => {
  it.each([24, 168] as const)(
    "reconciles the last %s hours by date_last_updated",
    async (hours) => {
      const prisma: any = { salesIntegration: { update: vi.fn() } };
      const client: any = {
        searchPayments: vi.fn().mockResolvedValue([mercadoPagoApprovedPaymentFixture]),
      };
      const authenticated: any = { execute: vi.fn(({ request }) => request("token")) };
      const states: any = { upsertFromMovement: vi.fn() };
      const locks: any = { acquire: vi.fn().mockResolvedValue(true), release: vi.fn() };
      const service = new MercadoPagoReconciliationService(
        prisma,
        authenticated,
        client,
        states,
        locks,
        { record: vi.fn() } as any
      );
      await expect(service.reconcileConnection("tenant", "integration", hours)).resolves.toBe(true);
      expect(client.searchPayments.mock.calls[0][0].rangeField).toBe("date_last_updated");
      expect(states.upsertFromMovement).toHaveBeenCalled();
    }
  );
  it("skips a connection already claimed by another worker", async () => {
    const service = new MercadoPagoReconciliationService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { acquire: vi.fn().mockResolvedValue(false) } as any,
      {} as any
    );
    await expect(service.reconcileConnection("tenant", "integration", 24)).resolves.toBe(false);
  });

  it("pages connections and reconciles them sequentially", async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({ id: `i-${String(index).padStart(2, "0")}`, tenantId: "tenant-a" }));
    const secondPage = [{ id: "i-25", tenantId: "tenant-b" }];
    const prisma: any = { salesIntegration: { findMany: vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage) } };
    const service = new MercadoPagoReconciliationService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    let active = 0;
    let maxActive = 0;
    vi.spyOn(service, "reconcileConnection").mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return true;
    });

    await service.reconcile(24);

    expect(prisma.salesIntegration.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: { id: "i-24" }, skip: 1, take: 25 }));
    expect(service.reconcileConnection).toHaveBeenCalledTimes(26);
    expect(maxActive).toBe(1);
  });

  it("uses the same active key for short and daily durable reconciliation", async () => {
    const enqueue = vi.fn().mockResolvedValue({ id: "job" });
    const prisma: any = { salesIntegration: { findMany: vi.fn().mockResolvedValue([{ id: "integration", tenantId: "tenant" }]) } };
    const scheduler = new MercadoPagoReconciliationScheduler(
      {} as any,
      prisma,
      { get: vi.fn((key: string) => key === "MP_RECONCILIATION_DURABLE_JOBS_ENABLED" ? "true" : "25") } as any,
      { enqueue } as any
    );

    await scheduler.enqueueDue(24);
    await scheduler.enqueueDue(168);

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls.map(([input]) => input.dedupeKey)).toEqual(["integration", "integration"]);
    expect(enqueue.mock.calls.map(([input]) => input.payload.hours)).toEqual([24, 168]);
  });
});
