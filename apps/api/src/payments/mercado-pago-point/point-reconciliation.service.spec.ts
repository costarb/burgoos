import { ChargeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PointReconciliationService } from "./point-reconciliation.service";
import { PointReconciliationScheduler } from "./point-reconciliation.scheduler";

describe("PointReconciliationService", () => {
  it("reconciles only targeted stale pending charges", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: "charge-a",
      tenantId: "tenant-a",
      connectionId: "connection-a",
      providerOrderId: "provider-order-a",
    }]);
    const execute = vi.fn(async ({ request }: {
      request: (token: string) => Promise<unknown>;
    }) => request("token"));
    const getOrder = vi.fn().mockResolvedValue({
      id: "provider-order-a",
      status: "processed",
      transactions: { payments: [{ status: "accredited" }] },
    });
    const applyProviderOrder = vi.fn();
    const service = new PointReconciliationService(
      { paymentCharge: { findMany } } as never,
      { execute } as never,
      { getOrder } as never,
      { applyProviderOrder } as never,
    );

    const result = await service.reconcilePending(10);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: {
          in: expect.arrayContaining([
            ChargeStatus.WAITING_CUSTOMER,
            ChargeStatus.PROCESSING,
            ChargeStatus.UNKNOWN,
          ]),
        },
      }),
      take: 10,
    }));
    expect(getOrder).toHaveBeenCalledWith("token", "provider-order-a");
    expect(applyProviderOrder).toHaveBeenCalledWith(
      "charge-a",
      expect.objectContaining({ id: "provider-order-a" }),
    );
    expect(result).toEqual([{ chargeId: "charge-a", reconciled: true }]);
  });

  it("caps each discovery pass at 25 charges and processes them sequentially", async () => {
    const pending = Array.from({ length: 25 }, (_, index) => ({
      id: `charge-${index}`,
      tenantId: "tenant-a",
      connectionId: "connection-a",
      providerOrderId: `provider-order-${index}`,
    }));
    const findMany = vi.fn().mockResolvedValue(pending);
    let active = 0;
    let peakActive = 0;
    const execute = vi.fn(async () => {
      active += 1;
      peakActive = Math.max(peakActive, active);
      await Promise.resolve();
      active -= 1;
      return {};
    });
    const service = new PointReconciliationService(
      { paymentCharge: { findMany } } as never,
      { execute } as never,
      { getOrder: vi.fn() } as never,
      { applyProviderOrder: vi.fn() } as never,
    );

    const result = await service.reconcilePending(100);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
    expect(result).toHaveLength(25);
    expect(execute).toHaveBeenCalledTimes(25);
    expect(peakActive).toBe(1);
  });
});

describe("PointReconciliationScheduler", () => {
  it("uses a stable per-charge claim so concurrent schedulers produce one logical job", async () => {
    const charge = {
      id: "charge-a",
      tenantId: "tenant-a",
      connectionId: "connection-a",
      providerOrderId: "provider-order-a",
    };
    const claimed = new Set<string>();
    const enqueue = vi.fn(async (input: { tenantId: string; type: string; dedupeKey: string }) => {
      claimed.add(`${input.tenantId}:${input.type}:${input.dedupeKey}`);
      return {};
    });
    const reconciliation = { findStaleCharges: vi.fn().mockResolvedValue([charge]) };
    const jobs = { enqueue };
    const first = new PointReconciliationScheduler(reconciliation as never, undefined, undefined, jobs as never);
    const second = new PointReconciliationScheduler(reconciliation as never, undefined, undefined, jobs as never);

    await Promise.all([first.enqueueStaleCharges(), second.enqueueStaleCharges()]);

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      type: "POINT_RECONCILIATION",
      targetId: "charge-a",
      dedupeKey: "charge-a",
    }));
    expect(claimed).toEqual(new Set(["tenant-a:POINT_RECONCILIATION:charge-a"]));
  });

  it("loads the claimed charge within its tenant before reconciling it", async () => {
    const charge = {
      id: "charge-a",
      tenantId: "tenant-a",
      connectionId: "connection-a",
      providerOrderId: "provider-order-a",
    };
    const findFirst = vi.fn().mockResolvedValue(charge);
    const reconcileCharge = vi.fn().mockResolvedValue({ chargeId: "charge-a", reconciled: true });
    const scheduler = new PointReconciliationScheduler(
      { reconcileCharge } as never,
      { paymentCharge: { findFirst } } as never,
    );

    const result = await scheduler.execute({
      tenantId: "tenant-a",
      targetId: "charge-a",
    } as never);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "charge-a", tenantId: "tenant-a" }),
    }));
    expect(reconcileCharge).toHaveBeenCalledWith(charge);
    expect(result).toEqual({ processedCount: 1 });
  });
});
