import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentExceptionStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { AuthUser } from "../../platform/auth/auth.types";

@Injectable()
export class PaymentExceptionResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async finish(
    user: AuthUser,
    id: string,
    status: Extract<PaymentExceptionStatus, "RESOLVED" | "DISMISSED">,
    resolution: string,
  ) {
    const reason = resolution.trim();
    if (reason.length < 5) throw new BadRequestException("Informe a justificativa da resolucao");
    const exception = await this.prisma.paymentException.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { charge: true },
    });
    if (!exception) throw new NotFoundException("Excecao de pagamento nao encontrada");
    if (exception.status !== PaymentExceptionStatus.OPEN) {
      throw new BadRequestException("A excecao ja foi finalizada");
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentException.update({
        where: { id },
        data: {
          status,
          resolution: reason,
          resolvedAt: new Date(),
          resolvedByUserId: user.id,
        },
      });
      await tx.orderOperationalEvent.create({
        data: {
          tenantId: user.tenantId,
          orderId: exception.charge?.orderId,
          serviceTabId: exception.charge?.serviceTabId,
          chargeId: exception.chargeId,
          type: "PAYMENT_EXCEPTION_RESOLVED",
          source: "USER",
          actorUserId: user.id,
          reason,
          metadata: { exceptionId: id, outcome: status },
        },
      });
      return updated;
    });
  }
}
