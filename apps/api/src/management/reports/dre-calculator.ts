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

const ZERO = new Prisma.Decimal(0);

/**
 * Monthly DRE: sales lines come from the delivered-order snapshots; variable expenses and fixed
 * costs are the payables launched for the competence. The planned fixed cost is reference only.
 */
export function calculateDreSummary(input: {
  snapshots: DreSnapshotInput[];
  variableExpenses?: Prisma.Decimal;
  fixedExpenses: Prisma.Decimal;
  plannedFixedCost?: Prisma.Decimal;
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
      grossRevenue: ZERO,
      discounts: ZERO,
      netRevenue: ZERO,
      cmv: ZERO,
      feesAndTaxes: ZERO,
      grossProfit: ZERO,
    }
  );
  const variableExpenses = input.variableExpenses ?? ZERO;
  const fixedExpenses = input.fixedExpenses;
  const plannedFixedCost = input.plannedFixedCost ?? ZERO;

  const estimatedNetProfit = totals.grossProfit.sub(variableExpenses).sub(fixedExpenses);
  const hasRevenue = totals.netRevenue.gt(0);
  const netMarginRate = hasRevenue ? estimatedNetProfit.div(totals.netRevenue) : ZERO;
  const contributionMarginRate = hasRevenue ? totals.grossProfit.div(totals.netRevenue) : ZERO;
  const marginAfterVariableRate = hasRevenue
    ? totals.grossProfit.sub(variableExpenses).div(totals.netRevenue)
    : ZERO;
  const breakEvenRevenue = marginAfterVariableRate.gt(0)
    ? fixedExpenses.div(marginAfterVariableRate)
    : null;

  return {
    ...totals,
    variableExpenses,
    fixedExpenses,
    estimatedNetProfit,
    netMarginRate,
    contributionMarginRate,
    breakEvenRevenue,
    plannedFixedCost,
    fixedCostVariance: fixedExpenses.sub(plannedFixedCost),
  };
}
