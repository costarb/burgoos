import { ConflictException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CounterOrderCalculator } from "./counter-order-calculator";
import { CounterOrderService } from "./counter-order.service";

describe("CounterOrderService update", () => {
  it("rejects changes after the order leaves preparation", async () => {
    const prisma = {
      order: {
        findFirst: vi.fn(async () => ({
          id: "order-1",
          status: OrderStatus.READY,
          version: 1,
        })),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.update(user(), "order-1", {
        expectedVersion: 1,
        fulfillmentMethod: "PICKUP",
        items: [{ productId: productId, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("recalculates and atomically replaces items for an editable counter order", async () => {
    const transaction = {
      order: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: vi.fn(async () => storedOrder()),
      },
      orderItem: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const prisma = {
      order: {
        findFirst: vi.fn(async () => ({
          id: "order-1",
          status: OrderStatus.PENDING,
          version: 0,
        })),
      },
      product: {
        findMany: vi.fn(async () => [catalogProduct()]),
      },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const gateway = { emitOrderUpdated: vi.fn() };
    const service = serviceWith(prisma, gateway);

    const result = await service.update(user(), "order-1", {
      expectedVersion: 0,
      customerName: "Balcao 2",
      fulfillmentMethod: "PICKUP",
      items: [{
        productId,
        quantity: 1,
        modifications: [{
          type: "REMOVE_INGREDIENT",
          referenceId: ingredientId,
          quantity: 1,
        }],
      }],
    });

    expect(transaction.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantId, version: 0 }),
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    expect(transaction.orderItem.deleteMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", tenantId },
    });
    expect(result.items[0].modifications[0].nameSnapshot).toBe("Cebola");
    expect(gateway.emitOrderUpdated).toHaveBeenCalled();
  });
});

const tenantId = "1b02924c-63ff-430a-a45d-df516a0bb5b4";
const productId = "5a019261-ed89-4085-a7b6-ae7868417f8f";
const ingredientId = "4bd9a27e-5f24-4fe5-9ca5-adc6f904290b";

function serviceWith(prisma: unknown, gateway: unknown = { emitOrderUpdated: vi.fn() }) {
  return new CounterOrderService(
    prisma as never,
    new CounterOrderCalculator(),
    {} as never,
    gateway as never,
  );
}

function user() {
  return {
    id: "d6f96250-42ef-4e54-91eb-ef4ec9de31fc",
    tenantId,
    role: "ADMIN",
  } as never;
}

function catalogProduct() {
  return {
    id: productId,
    name: "Dogao",
    price: new Prisma.Decimal("13.00"),
    technicalSheets: [{
      lines: [{
        isPackaging: false,
        ingredient: { id: ingredientId, name: "Cebola" },
      }],
    }],
    complementAssignments: [],
  };
}

function storedOrder() {
  return {
    id: "order-1",
    publicCode: "123",
    serviceTabId: null,
    source: "COUNTER",
    status: "PENDING",
    fulfillmentMethod: "PICKUP",
    total: new Prisma.Decimal("13.00"),
    customerName: "Balcao 2",
    customerPhone: "",
    assignedUserId: null,
    version: 1,
    notes: null,
    createdAt: new Date("2026-07-24T12:00:00.000Z"),
    items: [{
      id: "item-2",
      productId,
      productNameSnapshot: "Dogao",
      quantity: 1,
      baseUnitPrice: new Prisma.Decimal("13.00"),
      calculatedUnitPrice: new Prisma.Decimal("13.00"),
      chargedUnitPrice: new Prisma.Decimal("13.00"),
      unitPrice: new Prisma.Decimal("13.00"),
      total: new Prisma.Decimal("13.00"),
      manualAdjustmentAmount: new Prisma.Decimal("0.00"),
      manualAdjustmentReason: null,
      notes: null,
      modifications: [{
        id: "modification-1",
        type: "REMOVE_INGREDIENT",
        ingredientId,
        complementId: null,
        nameSnapshot: "Cebola",
        quantity: new Prisma.Decimal(1),
        unitPriceDelta: new Prisma.Decimal(0),
        totalPriceDelta: new Prisma.Decimal(0),
      }],
    }],
  } as never;
}
