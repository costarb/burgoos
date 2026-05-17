import { Prisma } from "@prisma/client";

export interface DreSnapshotInput {
  grossRevenue: Prisma.Decimal;
  discount: Prisma.Decimal;
  netRevenue: Prisma.Decimal;
  cmv: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  paymentFee: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
}

export function calculateDreSummary(input: {
  snapshots: DreSnapshotInput[];
  fixedExpenses: Prisma.Decimal;
}) {
  const totals = input.snapshots.reduce(
    (current, snapshot) => ({
      grossRevenue: current.grossRevenue.add(snapshot.grossRevenue),
      discounts: current.discounts.add(snapshot.discount),
      netRevenue: current.netRevenue.add(snapshot.netRevenue),
      cmv: current.cmv.add(snapshot.cmv),
      feesAndTaxes: current.feesAndTaxes
        .add(snapshot.platformFee)
        .add(snapshot.taxAmount)
        .add(snapshot.paymentFee),
      grossProfit: current.grossProfit.add(snapshot.grossProfit),
    }),
    {
      grossRevenue: new Prisma.Decimal(0),
      discounts: new Prisma.Decimal(0),
      netRevenue: new Prisma.Decimal(0),
      cmv: new Prisma.Decimal(0),
      feesAndTaxes: new Prisma.Decimal(0),
      grossProfit: new Prisma.Decimal(0),
    }
  );
  const estimatedNetProfit = totals.grossProfit.sub(input.fixedExpenses);
  const netMarginRate = totals.netRevenue.gt(0)
    ? estimatedNetProfit.div(totals.netRevenue)
    : new Prisma.Decimal(0);
  const contributionRate = totals.netRevenue.gt(0)
    ? totals.grossProfit.div(totals.netRevenue)
    : new Prisma.Decimal(0);
  const breakEvenRevenue = contributionRate.gt(0)
    ? input.fixedExpenses.div(contributionRate)
    : new Prisma.Decimal(0);

  return {
    ...totals,
    fixedExpenses: input.fixedExpenses,
    estimatedNetProfit,
    netMarginRate,
    breakEvenRevenue,
  };
}
