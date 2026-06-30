import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateDreSummary } from "../src/management/reports/dre-calculator";

describe("DRE summary calculation", () => {
  it("summarizes period revenue, CMV, fees and fixed expenses", () => {
    const result = calculateDreSummary({
      fixedExpenses: decimal("1000.00"),
      snapshots: [
        {
          grossRevenue: decimal("100.00"),
          discount: decimal("0.00"),
          netRevenue: decimal("100.00"),
          cmv: decimal("35.00"),
          platformFee: decimal("12.00"),
          taxAmount: decimal("6.00"),
          paymentFee: decimal("3.00"),
          grossProfit: decimal("44.00"),
        },
        {
          grossRevenue: decimal("50.00"),
          discount: decimal("5.00"),
          netRevenue: decimal("45.00"),
          cmv: decimal("15.00"),
          platformFee: decimal("0.00"),
          taxAmount: decimal("2.70"),
          paymentFee: decimal("0.90"),
          grossProfit: decimal("26.40"),
        },
      ],
    });

    expect(result.grossRevenue.toFixed(2)).toBe("150.00");
    expect(result.discounts.toFixed(2)).toBe("5.00");
    expect(result.netRevenue.toFixed(2)).toBe("145.00");
    expect(result.cmv.toFixed(2)).toBe("50.00");
    expect(result.feesAndTaxes.toFixed(2)).toBe("24.60");
    expect(result.grossProfit.toFixed(2)).toBe("70.40");
    expect(result.estimatedNetProfit.toFixed(2)).toBe("-929.60");
    expect(result.netMarginRate.toFixed(4)).toBe("-6.4110");
  });

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
