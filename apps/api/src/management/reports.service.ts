import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../platform/database/prisma.service";
import { formatLocalDate, localDayEnd, localDayStart } from "./reports/sales-report.types";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getDailySummary(tenantId: string, date: Date | string = new Date()) {
    const businessDate = typeof date === "string" ? date : formatLocalDate(date);
    const dayStart = localDayStart(businessDate);
    const dayEnd = localDayEnd(businessDate);

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: OrderStatus.DELIVERED,
        deletedAt: null,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      select: {
        total: true,
      },
    });

    const grossRevenue = orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0));

    return {
      date: businessDate,
      orderCount: orders.length,
      grossRevenue: grossRevenue.toFixed(2),
    };
  }
}
