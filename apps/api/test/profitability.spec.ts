import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateOrderProfitability } from "../src/management/reports/profitability-calculator";

describe("order profitability calculation", () => {
  it("calculates gross profit from revenue, CMV, taxes and fees", () => {
    const result = calculateOrderProfitability({
      grossRevenue: decimal("100.00"),
      cmv: decimal("35.00"),
      taxRate: decimal("0.06"),
      platformFeeRate: decimal("0.12"),
      paymentFeeRate: decimal("0.03"),
    });

    expect(result.netRevenue.toFixed(2)).toBe("100.00");
    expect(result.platformFee.toFixed(2)).toBe("12.00");
    expect(result.taxAmount.toFixed(2)).toBe("6.00");
    expect(result.paymentFee.toFixed(2)).toBe("3.00");
    expect(result.grossProfit.toFixed(2)).toBe("44.00");
  });

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
