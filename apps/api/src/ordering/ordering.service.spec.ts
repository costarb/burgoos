import { OrderStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { OrderingService } from "./ordering.service";

describe("OrderingService platform status sync", () => {
  it("includes item modifications in the operational queue response", async () => {
    const queuedOrder = order({ status: OrderStatus.PENDING, platformOrderLink: null });
    const prisma = {
      order: {
        findMany: vi.fn(async () => [queuedOrder]),
      },
    };
    const service = new OrderingService(
      prisma as never,
      {} as never,
      { getOrderStockWarnings: vi.fn(async () => []) } as never,
      {} as never,
      {} as never
    );

    const result = await service.listAdminOrders("tenant-1", false);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          items: { include: { modifications: true } },
        }),
      })
    );
    expect(result[0].items[0].modifications).toEqual([
      expect.objectContaining({
        type: "REMOVE_INGREDIENT",
        nameSnapshot: "Cebola",
        quantity: 1,
      }),
    ]);
  });

  it("syncs iFood platform status after internal status update", async () => {
    const platformOrderLink = {
      id: "link-1",
      provider: "IFOOD",
      integrationId: "integration-1",
      externalOrderId: "ifood-order-1",
      externalMerchantId: "merchant-1",
      externalStatus: "CONFIRMED",
      confirmationDeadlineAt: null,
      internalStatusAtLastSync: "PREPARING",
      mode: "DELIVERY",
      syncAttempts: [],
    };
    const updatedOrder = order({ status: OrderStatus.SHIPPED, platformOrderLink });
    const prisma = {
      order: {
        findFirst: vi.fn(async () => order({ status: OrderStatus.READY, platformOrderLink })),
        update: vi.fn(async () => updatedOrder),
        findUnique: vi.fn(async () => updatedOrder),
      },
    };
    const platformSync = { syncInternalStatus: vi.fn() };
    const ordersGateway = { emitOrderUpdated: vi.fn() };
    const service = new OrderingService(
      prisma as never,
      ordersGateway as never,
      {
        getOrderStockWarnings: vi.fn(async () => []),
        releaseOrderReservation: vi.fn(),
        consumeOrderReservation: vi.fn(),
      } as never,
      { createDeliveredOrderSnapshots: vi.fn() } as never,
      platformSync as never
    );

    await service.updateOrderStatus("tenant-1", "order-1", OrderStatus.SHIPPED, "user-1");

    expect(platformSync.syncInternalStatus).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      link: platformOrderLink,
      status: OrderStatus.SHIPPED,
    });
  });
});

function order(input: { status: OrderStatus; platformOrderLink: unknown }) {
  return {
    id: "order-1",
    status: input.status,
    total: new Prisma.Decimal(20),
    customerName: "Cliente",
    customerPhone: "11999999999",
    fulfillmentMethod: "DELIVERY",
    paymentMethod: "PIX",
    paymentInstitution: null,
    externalPaymentId: null,
    paymentGrossAmount: null,
    paymentFeeAmount: null,
    paymentNetAmount: null,
    paymentBrand: null,
    paymentReleaseExpectedAt: null,
    paymentReleaseSource: null,
    orderPlatformId: "platform-1",
    platformOrderLink: input.platformOrderLink,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletionReason: null,
    items: [
      {
        id: "item-1",
        productId: "product-1",
        productNameSnapshot: "Produto",
        quantity: 1,
        unitPrice: new Prisma.Decimal(20),
        total: new Prisma.Decimal(20),
        modifications: [
          {
            id: "modification-1",
            type: "REMOVE_INGREDIENT",
            nameSnapshot: "Cebola",
            quantity: new Prisma.Decimal(1),
            unitPriceDelta: new Prisma.Decimal(0),
            totalPriceDelta: new Prisma.Decimal(0),
          },
        ],
      },
    ],
  };
}
