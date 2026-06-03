import { Inject, Injectable } from "@nestjs/common";
import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { calculateOrderProfitability } from "./profitability-calculator";

const cardPaymentMethods: PaymentMethod[] = [
  PaymentMethod.CARD_ON_DELIVERY,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.CREDIT_CARD,
];

@Injectable()
export class OrderProfitabilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createDeliveredOrderSnapshots(tenantId: string, orderId: string): Promise<void> {
    const existing = await this.prisma.orderProfitabilitySnapshot.findMany({
      where: {
        tenantId,
        orderId,
      },
    });

    if (existing.length > 0) {
      return;
    }

    const [configuration, order] = await Promise.all([
      this.getFinancialConfiguration(tenantId),
      this.prisma.order.findFirst({
        where: {
          id: orderId,
          tenantId,
          status: OrderStatus.DELIVERED,
        },
        include: {
          orderPlatform: true,
          items: true,
        },
      }),
    ]);

    if (!order) {
      return;
    }

    const productIds = [...new Set(order.items.map((item) => item.productId))];
    const technicalSheets = await this.prisma.technicalSheet.findMany({
      where: {
        tenantId,
        productId: {
          in: productIds,
        },
        active: true,
      },
      include: {
        lines: true,
      },
    });
    const sheetByProduct = new Map(technicalSheets.map((sheet) => [sheet.productId, sheet]));
    const platformFeeRate = order.orderPlatform?.feeRate ?? new Prisma.Decimal(0);
    const paymentFeeRate =
      order.orderPlatform?.paymentFeeRate ??
      (cardPaymentMethods.includes(order.paymentMethod)
        ? configuration.cardFeeRate
        : new Prisma.Decimal(0));

    const snapshots = order.items.map((item) => {
      const sheet = sheetByProduct.get(item.productId);
      const baseCmv =
        sheet?.lines.reduce(
          (total, line) => total.add(line.itemCost ?? new Prisma.Decimal(0)),
          new Prisma.Decimal(0)
        ) ?? new Prisma.Decimal(0);
      const cmv = baseCmv
        .mul(item.quantity)
        .mul(new Prisma.Decimal(1).add(configuration.operationalLossRate));
      const profitability = calculateOrderProfitability({
        grossRevenue: item.total,
        cmv,
        taxRate: configuration.taxRate,
        platformFeeRate,
        paymentFeeRate,
      });

      return {
        tenantId,
        orderId: order.id,
        orderItemId: item.id,
        orderPlatformId: order.orderPlatformId,
        grossRevenue: profitability.grossRevenue,
        discount: profitability.discount,
        netRevenue: profitability.netRevenue,
        cmv: profitability.cmv,
        platformFee: profitability.platformFee,
        taxAmount: profitability.taxAmount,
        paymentFee: profitability.paymentFee,
        grossProfit: profitability.grossProfit,
        createdAt: order.createdAt,
      };
    });

    if (snapshots.length === 0) {
      return;
    }

    await this.prisma.orderProfitabilitySnapshot.createMany({
      data: snapshots,
    });
  }

  private async getFinancialConfiguration(tenantId: string) {
    return this.prisma.financialConfiguration.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }
}
