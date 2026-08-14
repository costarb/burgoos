import { Injectable } from "@nestjs/common";
import { ChargeStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { MappedPointOrder } from "../mercado-pago-point/mercado-pago-point.mapper";

@Injectable()
export class PaymentSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async settleApproved(chargeId: string, mapped: MappedPointOrder) {
    if (mapped.status !== ChargeStatus.APPROVED) return;
    await this.prisma.$transaction(async (tx) => {
      const charge = await tx.paymentCharge.findUnique({
        where: { id: chargeId },
        include: { payment: true },
      });
      if (!charge || charge.payment) return;
      const payment = await tx.payment.create({
        data: {
          tenantId: charge.tenantId,
          chargeId: charge.id,
          institution: charge.institution,
          method: charge.method,
          grossAmount: charge.amount,
          netAmount: charge.amount,
          providerPaymentId: mapped.providerTransactionId,
          approvedAt: new Date(),
        },
      });
      await tx.paymentAllocation.create({
        data: {
          tenantId: charge.tenantId,
          paymentId: payment.id,
          orderId: charge.orderId,
          serviceTabId: charge.serviceTabId,
          amount: charge.amount,
        },
      });
    });
  }
}
