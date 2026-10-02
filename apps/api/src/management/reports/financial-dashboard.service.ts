import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, ProductCostStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { parseCompetence } from "./dre-competence";
import { DreService } from "./dre.service";

@Injectable()
export class FinancialDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DreService) private readonly dreService: DreService
  ) {}

  async getIndicators(tenantId: string) {
    const now = new Date();
    const competence = parseCompetence(undefined, now);
    const [dre, priceReviewCount, ingredients, deliveredOrderCount] = await Promise.all([
      this.dreService.getMonthlySummary(tenantId, competence.competence, now),
      this.prisma.productCostSnapshot.count({
        where: {
          tenantId,
          status: ProductCostStatus.REVIEW_PRICE,
        },
      }),
      this.prisma.ingredient.findMany({
        where: {
          tenantId,
          active: true,
        },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          status: OrderStatus.DELIVERED,
          deletedAt: null,
          createdAt: {
            gte: competence.salesStart,
            lte: competence.salesEnd,
          },
        },
      }),
    ]);

    return {
      periodStart: dre.periodStart,
      periodEnd: dre.periodEnd,
      grossRevenue: dre.grossRevenue,
      cmv: dre.cmv,
      grossProfit: dre.grossProfit,
      variableExpenses: dre.variableExpenses,
      fixedExpenses: dre.fixedExpenses,
      estimatedNetProfit: dre.estimatedNetProfit,
      netMarginRate: dre.netMarginRate,
      deliveredOrderCount,
      priceReviewCount,
      stockAlertCount: ingredients.filter((ingredient) =>
        ingredient.currentStock.lte(ingredient.minimumStock)
      ).length,
    };
  }
}
