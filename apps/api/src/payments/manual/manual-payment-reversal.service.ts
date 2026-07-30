import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ChargeMode,
  ChargeStatus,
  OperationalEventSource,
  OperationalEventType,
  ServiceTabStatus,
} from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { CancelManualPaymentDto } from "./dto/manual-payment.dto";
import { projectManualCharge } from "./manual-payment.service";

@Injectable()
export class ManualPaymentReversalService {
  constructor(private readonly prisma: PrismaService) {}

  async cancel(user: AuthUser, chargeId: string, dto: CancelManualPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.paymentCharge.findFirst({
        where: {
          id: chargeId,
          tenantId: user.tenantId,
          mode: ChargeMode.MANUAL,
          status: ChargeStatus.APPROVED,
        },
        include: { payment: true },
      });
      if (!charge?.payment) throw new NotFoundException("Pagamento manual aprovado nao encontrado");
      if (charge.payment.cancelledAt) throw new ConflictException("Pagamento ja foi cancelado");
      const now = new Date();
      await tx.payment.update({
        where: { id: charge.payment.id },
        data: { cancelledAt: now },
      });
      const updated = await tx.paymentCharge.update({
        where: { id: charge.id },
        data: {
          status: ChargeStatus.CANCELLED,
          finalizedAt: now,
          version: { increment: 1 },
        },
      });
      if (charge.serviceTabId) {
        await tx.serviceTab.update({
          where: { id: charge.serviceTabId },
          data: {
            status: ServiceTabStatus.CHECKOUT_PENDING,
            closedAt: null,
            closedByUserId: null,
            version: { increment: 1 },
          },
        });
      }
      await tx.orderOperationalEvent.create({
        data: {
          tenantId: user.tenantId,
          orderId: charge.orderId,
          serviceTabId: charge.serviceTabId,
          chargeId: charge.id,
          actorUserId: user.id,
          type: OperationalEventType.PAYMENT_CANCELLED,
          source: OperationalEventSource.USER,
          reason: dto.reason.trim(),
        },
      });
      return projectManualCharge(updated);
    });
  }
}
