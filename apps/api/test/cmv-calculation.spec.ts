import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateIngredientUnitCost } from "../src/management/financial/ingredient-cost";
import { calculateTechnicalSheetCost } from "../src/management/financial/technical-sheet-cost";

describe("CMV calculation", () => {
  it("calculates ingredient unit cost from purchase cost and quantity", () => {
    expect(calculateIngredientUnitCost(120, 3000).toFixed(4)).toBe("0.0400");
  });

  it("rejects zero purchase quantity", () => {
    expect(() => calculateIngredientUnitCost(120, 0)).toThrow(
      "Purchase quantity must be greater than zero"
    );
  });

  it("calculates technical sheet line costs and total CMV", () => {
    const result = calculateTechnicalSheetCost([
      {
        ingredientId: "beef",
        ingredientName: "Blend",
        quantityUsed: new Prisma.Decimal(180),
        unitCost: new Prisma.Decimal("0.04"),
        isPackaging: false,
      },
      {
        ingredientId: "box",
        ingredientName: "Caixa",
        quantityUsed: new Prisma.Decimal(1),
        unitCost: new Prisma.Decimal("1.20"),
        isPackaging: true,
      },
    ]);

    expect(result.ingredientCmv.toFixed(2)).toBe("8.40");
    expect(result.lines).toMatchObject([
      {
        ingredientId: "beef",
        itemCost: "7.20",
      },
      {
        ingredientId: "box",
        itemCost: "1.20",
        isPackaging: true,
      },
    ]);
  });
});
