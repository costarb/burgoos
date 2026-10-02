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

  it("subtracts variable expenses and fixed costs launched for the competence (US2 scenario)", () => {
    const result = calculateDreSummary({
      snapshots: [
        {
          grossRevenue: decimal("15000.00"),
          discount: decimal("300.00"),
          netRevenue: decimal("14700.00"),
          cmv: decimal("4410.00"),
          platformFee: decimal("900.00"),
          taxAmount: decimal("420.00"),
          paymentFee: decimal("150.00"),
          grossProfit: decimal("8820.00"),
        },
      ],
      variableExpenses: decimal("500.00"),
      fixedExpenses: decimal("3000.00"),
      plannedFixedCost: decimal("5000.00"),
    });

    expect(result.grossProfit.toFixed(2)).toBe("8820.00");
    expect(result.contributionMarginRate.toFixed(4)).toBe("0.6000");
    expect(result.estimatedNetProfit.toFixed(2)).toBe("5320.00");
    expect(result.netMarginRate.toFixed(4)).toBe("0.3619");
    expect(result.breakEvenRevenue?.toFixed(2)).toBe("5300.48");
    expect(result.fixedCostVariance.toFixed(2)).toBe("-2000.00");
  });

  it("handles months without revenue and unreachable break-even", () => {
    const empty = calculateDreSummary({ snapshots: [], fixedExpenses: decimal("1000.00") });
    expect(empty.estimatedNetProfit.toFixed(2)).toBe("-1000.00");
    expect(empty.netMarginRate.toFixed(2)).toBe("0.00");
    expect(empty.breakEvenRevenue).toBeNull();

    const negative = calculateDreSummary({
      snapshots: [
        {
          grossRevenue: decimal("100.00"),
          discount: decimal("0.00"),
          netRevenue: decimal("100.00"),
          cmv: decimal("60.00"),
          platformFee: decimal("0.00"),
          taxAmount: decimal("0.00"),
          paymentFee: decimal("0.00"),
          grossProfit: decimal("40.00"),
        },
      ],
      variableExpenses: decimal("50.00"),
      fixedExpenses: decimal("10.00"),
    });
    expect(negative.breakEvenRevenue).toBeNull();
  });

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
