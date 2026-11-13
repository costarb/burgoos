import { Inject, Injectable, Optional } from "@nestjs/common";
import { ChargeStatus } from "@prisma/client";
import { FiscalTriggerService } from "../../management/fiscal/documents/fiscal-trigger.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { MappedPointOrder } from "../mercado-pago-point/mercado-pago-point.mapper";

@Injectable()
export class PaymentSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(FiscalTriggerService) private readonly fiscalTrigger?: FiscalTriggerService
  ) {}

  async settleApproved(chargeId: string, mapped: MappedPointOrder) {
    if (mapped.status !== ChargeStatus.APPROVED) return;
    const settled = await this.prisma.$transaction(async (tx) => {
      const charge = await tx.paymentCharge.findUnique({
        where: { id: chargeId },
        include: { payment: true },
      });
      if (!charge || charge.payment) return null;
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
      return charge;
    });
    if (!settled) return;
    // Automatic NFC-e once the sale is fully paid (the trigger checks the balance).
    if (settled.serviceTabId) {
      await this.fiscalTrigger?.requestAutomatic(settled.tenantId, { type: "TAB", id: settled.serviceTabId });
    } else if (settled.orderId) {
      await this.fiscalTrigger?.requestForOrder(settled.tenantId, settled.orderId);
    }
  }
}
