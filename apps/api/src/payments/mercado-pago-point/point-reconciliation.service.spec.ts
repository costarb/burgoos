import { ChargeStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PointReconciliationService } from "./point-reconciliation.service";

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
});
