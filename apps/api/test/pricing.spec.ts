import { Prisma, ProductCostStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateProductPricing } from "../src/management/pricing/product-pricing.service";

describe("product pricing", () => {
  it("recommends channel-aware price from CMV, fees and desired margin", () => {
    const result = calculateProductPricing({
      ingredientCmv: new Prisma.Decimal(10),
      explicitPackagingCost: new Prisma.Decimal(0),
      hasExplicitPackaging: false,
      averagePackagingCost: new Prisma.Decimal(2),
      operationalLossRate: new Prisma.Decimal(0.03),
      currentPrice: new Prisma.Decimal(30),
      desiredMarginRate: new Prisma.Decimal(0.3),
      taxRate: new Prisma.Decimal(0.06),
      feeRate: new Prisma.Decimal(0.12),
      paymentFeeRate: new Prisma.Decimal(0.035),
      cmvWarningRate: new Prisma.Decimal(0.35),
    });

    expect(result.totalCmv.toFixed(2)).toBe("12.36");
    expect(result.idealPrice.toFixed(2)).toBe("25.48");
    expect(result.estimatedProfit.toFixed(2)).toBe("11.19");
    expect(result.status).toBe(ProductCostStatus.REVIEW_PRICE);
  });

  it("does not double count average packaging when recipe already has packaging lines", () => {
    const result = calculateProductPricing({
      ingredientCmv: new Prisma.Decimal(10),
      explicitPackagingCost: new Prisma.Decimal(1.4),
      hasExplicitPackaging: true,
      averagePackagingCost: new Prisma.Decimal(2.5),
      operationalLossRate: new Prisma.Decimal(0),
      currentPrice: new Prisma.Decimal(30),
      desiredMarginRate: new Prisma.Decimal(0.3),
      taxRate: new Prisma.Decimal(0),
      feeRate: new Prisma.Decimal(0),
      paymentFeeRate: new Prisma.Decimal(0),
      cmvWarningRate: new Prisma.Decimal(0.35),
    });

    expect(result.packagingCost.toFixed(2)).toBe("0.00");
    expect(result.totalCmv.toFixed(2)).toBe("10.00");
  });
});
