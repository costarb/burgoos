import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../platform/database/prisma.service";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getDailySummary(tenantId: string, date: Date | string = new Date()) {
    const dayStart = this.toLocalDayStart(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: OrderStatus.DELIVERED,
        createdAt: {
          gte: dayStart,
          lt: dayEnd
        }
      },
      select: {
        total: true
      }
    });

    const grossRevenue = orders.reduce(
      (sum, order) => sum.add(order.total),
      new Prisma.Decimal(0)
    );

    return {
      date: dayStart.toISOString().slice(0, 10),
      orderCount: orders.length,
      grossRevenue: grossRevenue.toFixed(2)
    };
  }

  private toLocalDayStart(date: Date | string): Date {
    if (typeof date === "string") {
      const [year, month, day] = date.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    return dayStart;
  }
}
