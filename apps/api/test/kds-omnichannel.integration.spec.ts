import { NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { KdsCommandService } from "../src/ordering/kds/kds-command.service";
import { OrderingService } from "../src/ordering/ordering.service";

describe("KDS omnichannel integration", () => {
  it("applies a versioned tenant-scoped transition and returns a fresh projection", async () => {
    const current = order(OrderStatus.PENDING, 4);
    const updated = order(OrderStatus.PREPARING, 5);
    const prisma = {
      order: {
        findFirst: vi.fn(async () => current),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => updated),
      },
    };
    const ordering = orderingService(prisma);
    const query = {
      findOne: vi.fn(async () => ({ id: updated.id, status: updated.status, version: 5 })),
    };
    const events = { record: vi.fn(async () => undefined) };
    const command = new KdsCommandService(ordering, query as never, events as never);

    const result = await command.updateStatus(
      {
        id: "d6f96250-42ef-4e54-91eb-ef4ec9de31fc",
        tenantId: tenantId,
        role: "OPERATOR",
      } as never,
      current.id,
      { status: OrderStatus.PREPARING, expectedVersion: 4 },
    );

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId, version: 4 }),
        data: expect.objectContaining({
          status: OrderStatus.PREPARING,
          version: { increment: 1 },
          productionStartedAt: expect.any(Date),
        }),
      }),
    );
    expect(query.findOne).toHaveBeenCalledWith(tenantId, current.id);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        orderId: current.id,
        type: "ORDER_STATUS_CHANGED",
      }),
    );
    expect(result).toMatchObject({ status: OrderStatus.PREPARING, version: 5 });
  });

  it("does not expose an order outside the authenticated tenant", async () => {
    const prisma = {
      order: {
        findFirst: vi.fn(async () => null),
      },
    };
    const command = new KdsCommandService(
      orderingService(prisma),
      { findOne: vi.fn() } as never,
      { record: vi.fn() } as never,
    );

    await expect(
      command.updateStatus(
        { id: "user-2", tenantId: "other-tenant", role: "OPERATOR" } as never,
        "order-1",
        { status: OrderStatus.PREPARING, expectedVersion: 0 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

const tenantId = "1b02924c-63ff-430a-a45d-df516a0bb5b4";

function orderingService(prisma: unknown) {
  return new OrderingService(
    prisma as never,
    { emitOrderUpdated: vi.fn() } as never,
    {
      getOrderStockWarnings: vi.fn(async () => []),
      releaseOrderReservation: vi.fn(),
      consumeOrderReservation: vi.fn(),
    } as never,
    { createDeliveredOrderSnapshots: vi.fn() } as never,
    { syncInternalStatus: vi.fn() } as never,
  );
}

function order(status: OrderStatus, version: number) {
  return {
    id: "order-1",
    tenantId,
    source: "COUNTER",
    publicCode: "101",
    status,
    version,
    total: new Prisma.Decimal("13.00"),
    customerName: "Balcao",
    customerPhone: "",
    fulfillmentMethod: "PICKUP",
    paymentMethod: "CASH",
    paymentInstitution: null,
    externalPaymentId: null,
    paymentGrossAmount: null,
    paymentFeeAmount: null,
    paymentNetAmount: null,
    paymentBrand: null,
    paymentReleaseExpectedAt: null,
    paymentReleaseSource: null,
    orderPlatformId: null,
    platformOrderLink: null,
    notes: null,
    productionStartedAt: null,
    createdAt: new Date("2026-07-24T12:00:00.000Z"),
    updatedAt: new Date("2026-07-24T12:00:00.000Z"),
    deletedAt: null,
    deletionReason: null,
    items: [{
      id: "item-1",
      productId: "product-1",
      productNameSnapshot: "Dogao",
      quantity: 1,
      unitPrice: new Prisma.Decimal("13.00"),
      total: new Prisma.Decimal("13.00"),
      modifications: [],
    }],
  };
}
