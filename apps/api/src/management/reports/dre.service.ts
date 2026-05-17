import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString } from "../financial/money";
import { calculateDreSummary } from "./dre-calculator";

@Injectable()
export class DreService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string, periodStart: Date, periodEnd: Date) {
    const [configuration, snapshots] = await Promise.all([
      this.prisma.financialConfiguration.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId },
      }),
      this.prisma.orderProfitabilitySnapshot.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
          order: {
            status: OrderStatus.DELIVERED,
          },
        },
      }),
    ]);
    const summary = calculateDreSummary({
      snapshots,
      fixedExpenses: configuration.monthlyFixedCost,
    });

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      grossRevenue: toMoneyString(summary.grossRevenue),
      discounts: toMoneyString(summary.discounts),
      netRevenue: toMoneyString(summary.netRevenue),
      cmv: toMoneyString(summary.cmv),
      feesAndTaxes: toMoneyString(summary.feesAndTaxes),
      grossProfit: toMoneyString(summary.grossProfit),
      fixedExpenses: toMoneyString(summary.fixedExpenses),
      estimatedNetProfit: toMoneyString(summary.estimatedNetProfit),
      netMarginRate: summary.netMarginRate.toNumber(),
      breakEvenRevenue: toMoneyString(summary.breakEvenRevenue),
    };
  }
}
