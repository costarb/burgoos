import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { classifyMenuEngineering } from "../src/management/reports/menu-engineering-calculator";

describe("menu engineering classification", () => {
  it("classifies products by volume and margin quadrants", () => {
    const result = classifyMenuEngineering([
      product("star", "Estrela", 20, "1000.00", "300.00", "700.00"),
      product("workhorse", "Cavalo", 18, "900.00", "540.00", "360.00"),
      product("puzzle", "Quebra-cabeca", 3, "180.00", "45.00", "135.00"),
      product("dog", "Abacaxi", 2, "100.00", "80.00", "20.00"),
    ]);

    expect(result.insufficientData).toBe(false);
    expect(result.items.map((item) => [item.productId, item.classification])).toEqual([
      ["star", "STAR"],
      ["workhorse", "WORKHORSE"],
      ["puzzle", "PUZZLE"],
      ["dog", "DOG"],
    ]);
  });

  it("marks the result as insufficient when there are not enough products", () => {
    const result = classifyMenuEngineering([
      product("only", "Produto unico", 4, "120.00", "60.00", "60.00"),
    ]);

    expect(result.insufficientData).toBe(true);
    expect(result.items[0]).toMatchObject({
      productId: "only",
      classification: "STAR",
    });
  });
});

function product(
  productId: string,
  productName: string,
  volumeSold: number,
  revenue: string,
  cmv: string,
  grossProfit: string
) {
  return {
    productId,
    productName,
    volumeSold,
    revenue: new Prisma.Decimal(revenue),
    cmv: new Prisma.Decimal(cmv),
    grossProfit: new Prisma.Decimal(grossProfit),
  };
}
