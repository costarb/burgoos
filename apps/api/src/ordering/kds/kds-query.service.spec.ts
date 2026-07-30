import {
  FulfillmentMethod,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { KdsQueryService, nextStatuses } from "./kds-query.service";

describe("KdsQueryService", () => {
  it("orders the snapshot from oldest to newest and projects customization and priority", async () => {
    const prisma = {
      order: {
        findMany: vi.fn(async () => [
          order("old", "2026-07-24T11:30:00.000Z"),
          order("new", "2026-07-24T11:55:00.000Z"),
        ]),
      },
    };
    const service = new KdsQueryService(
      prisma as never,
      { getOrderStockWarnings: vi.fn(async () => []) } as never,
    );

    const result = await service.snapshot(
      "1b02924c-63ff-430a-a45d-df516a0bb5b4",
      new Date("2026-07-24T12:00:00.000Z"),
    );

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
    expect(result.map((item) => item.id)).toEqual(["old", "new"]);
    expect(result[0]).toMatchObject({
      source: OrderSource.COUNTER,
      ageSeconds: 1800,
      overdue: true,
      nextStatuses: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    });
    expect(result[0].items[0].modifications[0].nameSnapshot).toBe("Cebola");
    expect(result[0].notes).toBe("Entregar junto com a bebida");
    expect(result[0].items[0].notes).toBe("Cortar ao meio");
  });

  it("provides fulfillment-aware actions", () => {
    expect(nextStatuses(OrderStatus.READY, FulfillmentMethod.PICKUP)).toEqual([
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ]);
    expect(nextStatuses(OrderStatus.READY, FulfillmentMethod.DELIVERY)).toEqual([
      OrderStatus.SHIPPED,
      OrderStatus.CANCELLED,
    ]);
  });
});

function order(id: string, createdAt: string) {
  const timestamp = new Date(createdAt);
  return {
    id,
    tenantId: "1b02924c-63ff-430a-a45d-df516a0bb5b4",
    source: OrderSource.COUNTER,
    publicCode: id === "old" ? "101" : "102",
    status: OrderStatus.PENDING,
    version: 0,
    total: new Prisma.Decimal("13.00"),
    customerName: "Balcao",
    customerPhone: "",
    fulfillmentMethod: FulfillmentMethod.PICKUP,
    paymentMethod: PaymentMethod.CASH,
    paymentInstitution: null,
    notes: "Entregar junto com a bebida",
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    platformOrderLink: null,
    items: [{
      id: `${id}-item`,
      productId: "5a019261-ed89-4085-a7b6-ae7868417f8f",
      productNameSnapshot: "Dogao",
      quantity: 1,
      unitPrice: new Prisma.Decimal("13.00"),
      total: new Prisma.Decimal("13.00"),
      notes: "Cortar ao meio",
      modifications: [{
        id: `${id}-mod`,
        type: "REMOVE_INGREDIENT",
        ingredientId: "4bd9a27e-5f24-4fe5-9ca5-adc6f904290b",
        complementId: null,
        nameSnapshot: "Cebola",
        quantity: new Prisma.Decimal(1),
        unitPriceDelta: new Prisma.Decimal(0),
        totalPriceDelta: new Prisma.Decimal(0),
      }],
    }],
  } as never;
}
