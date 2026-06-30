import { BadRequestException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { EditOrderDto } from "../src/ordering/dto/edit-order.dto";
import {
  assertOrderVersion,
  validateOrderMaintenanceInput,
  validReason,
} from "../src/ordering/order-maintenance-validation";

function input(overrides: Partial<EditOrderDto> = {}): EditOrderDto {
  return {
    expectedUpdatedAt: "2026-06-03T12:00:00.000Z",
    customerName: "Cliente",
    customerPhone: "11999999999",
    fulfillmentMethod: "PICKUP",
    createdAt: "2026-06-03T12:00:00.000Z",
    paymentMethod: "PIX",
    paymentGrossAmount: "20.00",
    paymentFeeAmount: "1.00",
    paymentNetAmount: "19.00",
    items: [
      {
        productId: "f62f4a79-32e4-4b06-9ec8-0be69cff4498",
        productNameSnapshot: "Produto",
        quantity: 1,
        unitPrice: "20.00",
      },
    ],
    ...overrides,
  } as EditOrderDto;
}

describe("order maintenance validation", () => {
  it("requires a reason for finalized orders", () => {
    expect(() => validateOrderMaintenanceInput(OrderStatus.DELIVERED, input())).toThrow(
      BadRequestException
    );
    expect(() =>
      validateOrderMaintenanceInput(OrderStatus.DELIVERED, input({ reason: "Valor corrigido" }))
    ).not.toThrow();
  });

  it("rejects incoherent payment values", () => {
    expect(() =>
      validateOrderMaintenanceInput(
        OrderStatus.PENDING,
        input({ paymentFeeAmount: "21.00", paymentNetAmount: "22.00" })
      )
    ).toThrow(BadRequestException);
  });

  it("recognizes meaningful maintenance reasons", () => {
    expect(validReason("ok")).toBe(false);
    expect(validReason("Pedido duplicado")).toBe(true);
  });

  it("rejects stale or deleted order versions", () => {
    const updatedAt = new Date("2026-06-03T12:00:00.000Z");
    expect(() => assertOrderVersion(updatedAt, null, updatedAt.toISOString())).not.toThrow();
    expect(() =>
      assertOrderVersion(updatedAt, null, "2026-06-03T11:59:59.000Z")
    ).toThrow("Order changed since it was opened");
    expect(() => assertOrderVersion(updatedAt, new Date(), updatedAt.toISOString())).toThrow(
      "Deleted orders cannot be changed"
    );
  });
});
