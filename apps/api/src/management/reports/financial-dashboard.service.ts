import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, ProductCostStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { DreService } from "./dre.service";

@Injectable()
export class FinancialDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DreService) private readonly dreService: DreService
  ) {}

  async getIndicators(tenantId: string) {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    );
    const [dre, priceReviewCount, ingredients, deliveredOrderCount] = await Promise.all([
      this.dreService.getSummary(tenantId, periodStart, periodEnd),
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
            gte: periodStart,
            lte: periodEnd,
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
