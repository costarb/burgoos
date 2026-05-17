import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString } from "../financial/money";
import { classifyMenuEngineering, MenuEngineeringInput } from "./menu-engineering-calculator";

@Injectable()
export class MenuEngineeringService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getReport(tenantId: string, periodStart: Date, periodEnd: Date) {
    const snapshots = await this.prisma.orderProfitabilitySnapshot.findMany({
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
      include: {
        orderItem: true,
      },
    });

    const products = new Map<string, MenuEngineeringInput>();

    snapshots.forEach((snapshot) => {
      if (!snapshot.orderItem) {
        return;
      }

      const current = products.get(snapshot.orderItem.productId) ?? {
        productId: snapshot.orderItem.productId,
        productName: snapshot.orderItem.productNameSnapshot,
        volumeSold: 0,
        revenue: new Prisma.Decimal(0),
        cmv: new Prisma.Decimal(0),
        grossProfit: new Prisma.Decimal(0),
      };

      current.volumeSold += snapshot.orderItem.quantity;
      current.revenue = current.revenue.add(snapshot.netRevenue);
      current.cmv = current.cmv.add(snapshot.cmv);
      current.grossProfit = current.grossProfit.add(snapshot.grossProfit);
      products.set(current.productId, current);
    });

    const result = classifyMenuEngineering([...products.values()]);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      insufficientData: result.insufficientData,
      averageVolume: result.averageVolume,
      averageMarginRate: result.averageMarginRate,
      items: result.items
        .sort((left, right) => right.grossProfit.comparedTo(left.grossProfit))
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          volumeSold: item.volumeSold,
          revenue: toMoneyString(item.revenue),
          cmv: toMoneyString(item.cmv),
          grossProfit: toMoneyString(item.grossProfit),
          marginRate: item.marginRate,
          classification: item.classification,
        })),
    };
  }
}
