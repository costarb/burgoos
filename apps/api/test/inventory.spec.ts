import { Prisma, StockMovementType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildStockMovementDrafts,
  calculateEstimatedStockImpact,
  calculateOrderIngredientRequirements,
} from "../src/operations/inventory/stock-movement-calculator";

describe("stock movement calculator", () => {
  it("calculates ingredient requirements from order items and technical sheets", () => {
    const requirements = calculateOrderIngredientRequirements({
      items: [
        { orderItemId: "item-1", productId: "burger", quantity: 2 },
        { orderItemId: "item-2", productId: "combo", quantity: 1 },
      ],
      technicalSheets: [
        {
          productId: "burger",
          lines: [
            { ingredientId: "blend", quantityUsed: decimal("180") },
            { ingredientId: "bun", quantityUsed: decimal("1") },
          ],
        },
        {
          productId: "combo",
          lines: [
            { ingredientId: "blend", quantityUsed: decimal("120") },
            { ingredientId: "fries", quantityUsed: decimal("150") },
          ],
        },
      ],
    });

    expect(requirements).toEqual([
      {
        orderItemId: "item-1",
        productId: "burger",
        ingredientId: "blend",
        quantity: decimal("360"),
      },
      {
        orderItemId: "item-1",
        productId: "burger",
        ingredientId: "bun",
        quantity: decimal("2"),
      },
      {
        orderItemId: "item-2",
        productId: "combo",
        ingredientId: "blend",
        quantity: decimal("120"),
      },
      {
        orderItemId: "item-2",
        productId: "combo",
        ingredientId: "fries",
        quantity: decimal("150"),
      },
    ]);
  });

  it("creates reservation, release and consumption drafts without changing quantities", () => {
    const requirements = [
      {
        orderItemId: "item-1",
        productId: "burger",
        ingredientId: "blend",
        quantity: decimal("360"),
      },
    ];

    expect(
      buildStockMovementDrafts({
        requirements,
        movementType: StockMovementType.RESERVATION,
        reason: "Pedido em andamento",
      })
    ).toEqual([
      {
        ...requirements[0],
        movementType: StockMovementType.RESERVATION,
        reason: "Pedido em andamento",
      },
    ]);

    expect(
      buildStockMovementDrafts({
        requirements,
        movementType: StockMovementType.RELEASE,
        reason: "Pedido cancelado",
      })[0]
    ).toMatchObject({
      quantity: decimal("360"),
      movementType: StockMovementType.RELEASE,
      reason: "Pedido cancelado",
    });

    expect(
      buildStockMovementDrafts({
        requirements,
        movementType: StockMovementType.CONSUMPTION,
        reason: "Pedido entregue",
      })[0]
    ).toMatchObject({
      quantity: decimal("360"),
      movementType: StockMovementType.CONSUMPTION,
      reason: "Pedido entregue",
    });
  });

  it("subtracts reservations and consumptions, then adds releases and manual entries", () => {
    const impact = calculateEstimatedStockImpact([
      { movementType: StockMovementType.MANUAL_ENTRY, quantity: decimal("1000") },
      { movementType: StockMovementType.RESERVATION, quantity: decimal("360") },
      { movementType: StockMovementType.RELEASE, quantity: decimal("120") },
      { movementType: StockMovementType.CONSUMPTION, quantity: decimal("200") },
    ]);

    expect(impact.toFixed(3)).toBe("560.000");
  });

  function decimal(value: number | string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
