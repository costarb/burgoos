import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ChargeMode,
  ChargeStatus,
  OrderStatus,
  PaymentExceptionType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";

@Injectable()
export class PaymentExceptionService {
  private readonly logger = new Logger(PaymentExceptionService.name);
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, status?: "OPEN" | "RESOLVED" | "DISMISSED") {
    return this.prisma.paymentException.findMany({
      where: { tenantId, status },
      include: {
        charge: { select: { id: true, status: true, amount: true, orderId: true, serviceTabId: true } },
        payment: { select: { id: true, grossAmount: true, providerPaymentId: true } },
      },
      orderBy: { openedAt: "desc" },
    });
  }

  async detail(tenantId: string, id: string) {
    const exception = await this.prisma.paymentException.findFirst({
      where: { id, tenantId },
      include: {
        charge: {
          include: {
            order: { select: { id: true, publicCode: true, status: true, total: true } },
            serviceTab: { select: { id: true, number: true, status: true } },
          },
        },
        payment: true,
      },
    });
    if (!exception) throw new NotFoundException("Excecao de pagamento nao encontrada");
    const timeline = exception.chargeId
      ? await this.prisma.orderOperationalEvent.findMany({
          where: { tenantId, chargeId: exception.chargeId },
          orderBy: { occurredAt: "asc" },
        })
      : [];
    return { ...exception, timeline };
  }

  async detect(chargeId: string) {
    const charge = await this.prisma.paymentCharge.findUnique({
      where: { id: chargeId },
      include: { payment: true, order: true },
    });
    if (!charge) throw new NotFoundException("Cobranca nao encontrada");

    const candidates: Array<{ type: PaymentExceptionType; description: string }> = [];
    if (charge.status === ChargeStatus.UNKNOWN) {
      candidates.push({
        type: PaymentExceptionType.UNKNOWN_RESULT,
        description: "A adquirente nao confirmou o resultado final da cobranca.",
      });
    }
    if (/token|unauthori[sz]ed|401/i.test(`${charge.providerStatusDetail ?? ""}`)) {
      candidates.push({
        type: PaymentExceptionType.TOKEN_ERROR,
        description: "A credencial da integracao foi recusada durante a cobranca.",
      });
    }
    if (charge.status === ChargeStatus.APPROVED) {
      const approvedForTarget = await this.prisma.paymentCharge.count({
        where: {
          tenantId: charge.tenantId,
          id: { not: charge.id },
          status: ChargeStatus.APPROVED,
          ...(charge.orderId
            ? { orderId: charge.orderId }
            : { serviceTabId: charge.serviceTabId ?? undefined }),
        },
      });
      if (approvedForTarget > 0) {
        candidates.push({
          type: PaymentExceptionType.POSSIBLE_DUPLICATE,
          description: "Ha mais de uma cobranca aprovada para o mesmo pedido ou comanda.",
        });
      }
    }
    if (
      charge.mode === ChargeMode.MANUAL &&
      charge.payment &&
      new Prisma.Decimal(charge.payment.grossAmount).comparedTo(charge.amount) !== 0
    ) {
      candidates.push({
        type: PaymentExceptionType.MANUAL_DIVERGENCE,
        description: "O valor confirmado manualmente difere do valor da cobranca.",
      });
    }
    if (
      charge.order?.status === OrderStatus.DELIVERED &&
      (charge.status === ChargeStatus.PARTIALLY_REFUNDED || charge.status === ChargeStatus.REFUNDED)
    ) {
      candidates.push({
        type: PaymentExceptionType.REFUND_AFTER_DELIVERY,
        description: "Um pagamento foi estornado depois da entrega do pedido.",
      });
    }

    for (const candidate of candidates) {
      const exists = await this.prisma.paymentException.findFirst({
        where: { tenantId: charge.tenantId, chargeId: charge.id, type: candidate.type, status: "OPEN" },
      });
      if (!exists) {
        await this.prisma.$transaction(async (tx) => {
          await tx.paymentException.create({
            data: {
              tenantId: charge.tenantId,
              chargeId: charge.id,
              paymentId: charge.payment?.id,
              ...candidate,
            },
          });
          await tx.orderOperationalEvent.create({
            data: {
              tenantId: charge.tenantId,
              orderId: charge.orderId,
              serviceTabId: charge.serviceTabId,
              chargeId: charge.id,
              type: "PAYMENT_EXCEPTION_OPENED",
              source: "SYSTEM",
              reason: candidate.description,
              metadata: { exceptionType: candidate.type },
            },
          });
        });
        this.logger.warn(
          `event=payment.exception.opened metric=payment_exceptions_opened value=1 tenantId=${charge.tenantId} chargeId=${charge.id} type=${candidate.type}`,
        );
      }
    }
    return this.list(charge.tenantId, "OPEN");
  }
}
