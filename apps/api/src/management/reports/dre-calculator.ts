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

export interface DreOrderSnapshotInput extends DreSnapshotInput {
  orderId: string;
  order: {
    paymentGrossAmount: Prisma.Decimal | null;
    paymentNetAmount: Prisma.Decimal | null;
  };
}

const ZERO = new Prisma.Decimal(0);

/**
 * Orders imported with real payment values (gross and net) replace their estimated platform and
 * payment fees with gross - net (never negative), spread over the items by net revenue. Orders
 * without them keep the estimate by rate. Taxes stay estimated.
 */
export function applyRealOrderFees(snapshots: DreOrderSnapshotInput[]) {
  const byOrder = new Map<string, DreOrderSnapshotInput[]>();
  for (const snapshot of snapshots) {
    byOrder.set(snapshot.orderId, [...(byOrder.get(snapshot.orderId) ?? []), snapshot]);
  }

  const adjusted: DreSnapshotInput[] = [];
  let realSalesFees = ZERO;
  let estimatedSalesFees = ZERO;
  let realFeeOrderCount = 0;
  let estimatedFeeOrderCount = 0;

  for (const items of byOrder.values()) {
    const { paymentGrossAmount, paymentNetAmount } = items[0].order;
    if (!paymentGrossAmount || !paymentNetAmount) {
      estimatedFeeOrderCount += 1;
      for (const item of items) {
        estimatedSalesFees = estimatedSalesFees.add(item.platformFee).add(item.paymentFee);
        adjusted.push(item);
      }
      continue;
    }

    const realFee = Prisma.Decimal.max(paymentGrossAmount.sub(paymentNetAmount), ZERO);
    const base = items.reduce((total, item) => total.add(item.netRevenue), ZERO);
    let remaining = realFee;
    realFeeOrderCount += 1;
    realSalesFees = realSalesFees.add(realFee);

    items.forEach((item, index) => {
      const share =
        index === items.length - 1
          ? remaining
          : base.gt(0)
            ? realFee.mul(item.netRevenue).div(base).toDecimalPlaces(2)
            : ZERO;
      remaining = remaining.sub(share);
      adjusted.push({
        ...item,
        platformFee: ZERO,
        paymentFee: share,
        grossProfit: item.grossProfit.add(item.platformFee).add(item.paymentFee).sub(share),
      });
    });
  }

  return {
    snapshots: adjusted,
    realSalesFees,
    estimatedSalesFees,
    realFeeOrderCount,
    estimatedFeeOrderCount,
  };
}

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
      salesFees: current.salesFees.add(snapshot.platformFee).add(snapshot.paymentFee),
      taxes: current.taxes.add(snapshot.taxAmount),
      grossProfit: current.grossProfit.add(snapshot.grossProfit),
    }),
    {
      grossRevenue: ZERO,
      discounts: ZERO,
      netRevenue: ZERO,
      cmv: ZERO,
      feesAndTaxes: ZERO,
      salesFees: ZERO,
      taxes: ZERO,
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
