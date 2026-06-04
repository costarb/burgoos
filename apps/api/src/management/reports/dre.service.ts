import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
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
            deletedAt: null,
          },
        },
        include: {
          order: {
            select: {
              paymentNetAmount: true,
            },
          },
        },
      }),
    ]);
    const summary = calculateDreSummary({
      snapshots,
      fixedExpenses: configuration.monthlyFixedCost,
    });
    const acquiredNetRevenue = snapshots.reduce(
      (total, snapshot) => total.add(snapshot.order.paymentNetAmount ?? snapshot.grossRevenue),
      new Prisma.Decimal(0)
    );

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      grossRevenue: toMoneyString(summary.grossRevenue),
      discounts: toMoneyString(summary.discounts),
      netRevenue: toMoneyString(summary.netRevenue),
      acquiredNetRevenue: toMoneyString(acquiredNetRevenue),
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
