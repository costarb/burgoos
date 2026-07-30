import { Injectable } from "@nestjs/common";
import { ChargeStatus, OrderStatus, ServiceTabStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";

@Injectable()
export class ShiftCloseService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string) {
    const [openTabs, activeOrders, inconclusiveCharges, openExceptions] = await Promise.all([
      this.prisma.serviceTab.count({
        where: { tenantId, status: { in: [ServiceTabStatus.OPEN, ServiceTabStatus.CHECKOUT_PENDING] } },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY] },
        },
      }),
      this.prisma.paymentCharge.count({
        where: {
          tenantId,
          status: {
            in: [
              ChargeStatus.CREATED,
              ChargeStatus.WAITING_CUSTOMER,
              ChargeStatus.PROCESSING,
              ChargeStatus.UNKNOWN,
            ],
          },
        },
      }),
      this.prisma.paymentException.count({ where: { tenantId, status: "OPEN" } }),
    ]);
    return {
      openTabs,
      activeOrders,
      inconclusiveCharges,
      openExceptions,
      canClose: openTabs + activeOrders + inconclusiveCharges + openExceptions === 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
