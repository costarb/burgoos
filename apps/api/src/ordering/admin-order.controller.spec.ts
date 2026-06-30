import { OrderStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AdminOrderController } from "./admin-order.controller";

describe("AdminOrderController platform actions", () => {
  const user = { id: "user-1", tenantId: "tenant-1" } as never;

  it("confirms platform order before moving internal order to preparation", async () => {
    const orderingService = { updateOrderStatus: vi.fn(async () => ({ id: "order-1" })) };
    const platformSync = { confirmOrder: vi.fn() };
    const controller = new AdminOrderController(
      orderingService as never,
      {} as never,
      {} as never,
      platformSync as never
    );

    await controller.confirmPlatformOrder(user, "order-1");

    expect(platformSync.confirmOrder).toHaveBeenCalledWith("tenant-1", "user-1", "order-1");
    expect(orderingService.updateOrderStatus).toHaveBeenCalledWith(
      "tenant-1",
      "order-1",
      OrderStatus.PREPARING,
      "user-1"
    );
  });

  it("refuses platform order before cancelling internal order", async () => {
    const orderingService = { updateOrderStatus: vi.fn(async () => ({ id: "order-1" })) };
    const platformSync = { refuseOrder: vi.fn() };
    const controller = new AdminOrderController(
      orderingService as never,
      {} as never,
      {} as never,
      platformSync as never
    );

    await controller.refusePlatformOrder(user, "order-1", {
      providerReasonId: "501",
      reason: "Sem item",
    });

    expect(platformSync.refuseOrder).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      orderId: "order-1",
      providerReasonId: "501",
      reason: "Sem item",
    });
    expect(orderingService.updateOrderStatus).toHaveBeenCalledWith(
      "tenant-1",
      "order-1",
      OrderStatus.CANCELLED,
      "user-1"
    );
  });
});
