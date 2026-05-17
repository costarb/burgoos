import { Prisma } from "@prisma/client";

export interface ProfitabilityCalculationInput {
  grossRevenue: Prisma.Decimal;
  cmv: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  platformFeeRate: Prisma.Decimal;
  paymentFeeRate: Prisma.Decimal;
  discount?: Prisma.Decimal;
}

export function calculateOrderProfitability(input: ProfitabilityCalculationInput) {
  const discount = input.discount ?? new Prisma.Decimal(0);
  const netRevenue = input.grossRevenue.sub(discount);
  const platformFee = netRevenue.mul(input.platformFeeRate);
  const taxAmount = netRevenue.mul(input.taxRate);
  const paymentFee = netRevenue.mul(input.paymentFeeRate);
  const grossProfit = netRevenue.sub(input.cmv).sub(platformFee).sub(taxAmount).sub(paymentFee);

  return {
    grossRevenue: input.grossRevenue,
    discount,
    netRevenue,
    cmv: input.cmv,
    platformFee,
    taxAmount,
    paymentFee,
    grossProfit,
  };
}
