import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { applyRealOrderFees, calculateDreSummary } from "../src/management/reports/dre-calculator";

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

  it("uses gross - net as the sales fee of orders with real payment values (US5 scenario)", () => {
    const fees = applyRealOrderFees([
      orderItem(
        "imported",
        { net: "139.00", cmv: "40.00", tax: "8.34" },
        { gross: "139.00", net: "134.69" }
      ),
      orderItem("counter", { net: "100.00", cmv: "30.00", tax: "6.00", paymentFee: "3.50" }, null),
    ]);
    const result = calculateDreSummary({ snapshots: fees.snapshots, fixedExpenses: decimal("0") });

    expect(fees.realSalesFees.toFixed(2)).toBe("4.31");
    expect(fees.estimatedSalesFees.toFixed(2)).toBe("3.50");
    expect([fees.realFeeOrderCount, fees.estimatedFeeOrderCount]).toEqual([1, 1]);
    expect(result.salesFees.toFixed(2)).toBe("7.81");
    expect(result.taxes.toFixed(2)).toBe("14.34");
    expect(result.feesAndTaxes.toFixed(2)).toBe("22.15");
    expect(result.grossProfit.toFixed(2)).toBe("146.85");
  });

  it("replaces estimated platform fees, splits the real fee by item and never goes negative", () => {
    const split = applyRealOrderFees([
      orderItem("o1", { net: "60.00", platformFee: "7.20" }, { gross: "100.00", net: "99.00" }),
      orderItem("o1", { net: "40.00", platformFee: "4.80" }, { gross: "100.00", net: "99.00" }),
    ]);
    expect(split.snapshots.map((item) => item.paymentFee.toFixed(2))).toEqual(["0.60", "0.40"]);
    expect(split.snapshots.every((item) => item.platformFee.isZero())).toBe(true);
    expect(split.snapshots[0].grossProfit.toFixed(2)).toBe("59.40");

    const negative = applyRealOrderFees([
      orderItem("o2", { net: "50.00" }, { gross: "50.00", net: "52.00" }),
    ]);
    expect(negative.realSalesFees.toFixed(2)).toBe("0.00");
  });

  function orderItem(
    orderId: string,
    values: { net: string; cmv?: string; tax?: string; platformFee?: string; paymentFee?: string },
    payment: { gross: string; net: string } | null
  ) {
    const net = decimal(values.net);
    const cmv = decimal(values.cmv ?? "0");
    const tax = decimal(values.tax ?? "0");
    const platformFee = decimal(values.platformFee ?? "0");
    const paymentFee = decimal(values.paymentFee ?? "0");
    return {
      orderId,
      order: {
        paymentGrossAmount: payment ? decimal(payment.gross) : null,
        paymentNetAmount: payment ? decimal(payment.net) : null,
      },
      grossRevenue: net,
      discount: decimal("0"),
      netRevenue: net,
      cmv,
      platformFee,
      taxAmount: tax,
      paymentFee,
      grossProfit: net.sub(cmv).sub(tax).sub(platformFee).sub(paymentFee),
    };
  }

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
