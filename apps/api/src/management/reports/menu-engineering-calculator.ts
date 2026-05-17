import { Prisma } from "@prisma/client";

export type MenuEngineeringClassification = "STAR" | "WORKHORSE" | "PUZZLE" | "DOG";

export interface MenuEngineeringInput {
  productId: string;
  productName: string;
  volumeSold: number;
  revenue: Prisma.Decimal;
  cmv: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
}

export interface MenuEngineeringItem extends MenuEngineeringInput {
  marginRate: number;
  classification: MenuEngineeringClassification;
}

export interface MenuEngineeringResult {
  insufficientData: boolean;
  averageVolume: number;
  averageMarginRate: number;
  items: MenuEngineeringItem[];
}

export function classifyMenuEngineering(
  input: MenuEngineeringInput[],
  minimumProducts = 2
): MenuEngineeringResult {
  if (input.length < minimumProducts) {
    return {
      insufficientData: true,
      averageVolume: 0,
      averageMarginRate: 0,
      items: input.map((item) => toClassifiedItem(item, 0, 0)),
    };
  }

  const averageVolume = input.reduce((total, item) => total + item.volumeSold, 0) / input.length;
  const marginRates = input.map((item) => calculateMarginRate(item.grossProfit, item.revenue));
  const averageMarginRate =
    marginRates.reduce((total, marginRate) => total + marginRate, 0) / marginRates.length;

  return {
    insufficientData: false,
    averageVolume,
    averageMarginRate,
    items: input.map((item) => toClassifiedItem(item, averageVolume, averageMarginRate)),
  };
}

function toClassifiedItem(
  item: MenuEngineeringInput,
  averageVolume: number,
  averageMarginRate: number
): MenuEngineeringItem {
  const marginRate = calculateMarginRate(item.grossProfit, item.revenue);
  const highVolume = item.volumeSold >= averageVolume;
  const highMargin = marginRate >= averageMarginRate;

  return {
    ...item,
    marginRate,
    classification: classifyQuadrant(highVolume, highMargin),
  };
}

function classifyQuadrant(highVolume: boolean, highMargin: boolean): MenuEngineeringClassification {
  if (highVolume && highMargin) {
    return "STAR";
  }

  if (highVolume) {
    return "WORKHORSE";
  }

  if (highMargin) {
    return "PUZZLE";
  }

  return "DOG";
}

function calculateMarginRate(grossProfit: Prisma.Decimal, revenue: Prisma.Decimal): number {
  if (revenue.equals(0)) {
    return 0;
  }

  return grossProfit.div(revenue).toNumber();
}
