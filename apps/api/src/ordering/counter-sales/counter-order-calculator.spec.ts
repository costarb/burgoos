import { ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";
import { CounterOrderCalculator } from "./counter-order-calculator";

const product = {
  id: "product-1",
  name: "Dogao",
  price: new Decimal("20.00"),
  removableIngredients: [{ id: "ingredient-1", name: "Cebola" }],
  complements: [
    { id: "complement-1", name: "Bacon", price: new Decimal("4.50"), maxQuantity: 2 },
  ],
};

describe("CounterOrderCalculator", () => {
  it("calculates additions on the server and snapshots all modifications", () => {
    const result = new CounterOrderCalculator().calculate(
      [
        {
          productId: product.id,
          quantity: 2,
          modifications: [
            { type: "REMOVE_INGREDIENT", referenceId: "ingredient-1", quantity: 1 },
            { type: "ADD_COMPLEMENT", referenceId: "complement-1", quantity: 2 },
          ],
        },
      ],
      new Map([[product.id, product]]),
      { canOverridePrice: false, actorUserId: "user-1" },
    );

    expect(result.total.toFixed(2)).toBe("58.00");
    expect(result.items[0]).toMatchObject({
      calculatedUnitPrice: expect.any(Decimal),
      chargedUnitPrice: expect.any(Decimal),
      manualAdjustmentReason: null,
    });
    expect(result.items[0].calculatedUnitPrice.toFixed(2)).toBe("29.00");
    expect(result.items[0].modifications).toHaveLength(2);
  });

  it("requires permission and reason for a manual price override", () => {
    const calculator = new CounterOrderCalculator();
    const item = {
      productId: product.id,
      quantity: 1,
      chargedUnitPrice: "18.00",
      priceOverrideReason: "Promocao autorizada",
    };

    expect(() =>
      calculator.calculate([item], new Map([[product.id, product]]), {
        canOverridePrice: false,
        actorUserId: "user-1",
      }),
    ).toThrow(ForbiddenException);

    expect(() =>
      calculator.calculate(
        [{ ...item, priceOverrideReason: undefined }],
        new Map([[product.id, product]]),
        { canOverridePrice: true, actorUserId: "user-1" },
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it("rejects unavailable or excessive customizations", () => {
    expect(() =>
      new CounterOrderCalculator().calculate(
        [
          {
            productId: product.id,
            quantity: 1,
            modifications: [
              { type: "ADD_COMPLEMENT", referenceId: "complement-1", quantity: 3 },
            ],
          },
        ],
        new Map([[product.id, product]]),
        { canOverridePrice: false, actorUserId: "user-1" },
      ),
    ).toThrow(UnprocessableEntityException);
  });
});
