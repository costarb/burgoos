import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ChargeMode,
  ChargeStatus,
  OperationalEventSource,
  OperationalEventType,
  PaymentInstitution,
  PaymentMethod,
  PaymentTargetType,
  Prisma,
  ServiceTabStatus,
} from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { ConfirmManualPaymentDto } from "./dto/manual-payment.dto";

const CASH_INSTITUTIONS = new Set<PaymentInstitution>([
  PaymentInstitution.CAIXA_LOCAL,
  PaymentInstitution.DINHEIRO,
]);

export function validateManualPayment(
  institution: PaymentInstitution,
  method: PaymentMethod,
  amount: Prisma.Decimal,
  cashReceivedAmount?: Prisma.Decimal,
) {
  if (amount.lessThanOrEqualTo(0)) {
    throw new ConflictException("O valor do pagamento deve ser maior que zero");
  }
  const cashInstitution = CASH_INSTITUTIONS.has(institution);
  if (cashInstitution && method !== PaymentMethod.CASH) {
    throw new ConflictException("Caixa local aceita somente pagamento em dinheiro");
  }
  if (!cashInstitution && method === PaymentMethod.CASH) {
    throw new ConflictException("Dinheiro deve ser registrado no Caixa local");
  }
  if (method !== PaymentMethod.CASH && cashReceivedAmount) {
    throw new ConflictException("Valor recebido e troco se aplicam somente a dinheiro");
  }
  if (method === PaymentMethod.CASH) {
    if (!cashReceivedAmount) {
      throw new ConflictException("Informe o valor recebido em dinheiro");
    }
    if (cashReceivedAmount.lessThan(amount)) {
      throw new ConflictException("Valor recebido e menor que o saldo a cobrar");
    }
  }
  return {
    cashChangeAmount: method === PaymentMethod.CASH
      ? cashReceivedAmount!.sub(amount)
      : null,
  };
}

@Injectable()
export class ManualPaymentService {
  private readonly logger = new Logger(ManualPaymentService.name);
  constructor(private readonly prisma: PrismaService) {}

  async options(tenantId: string) {
    await this.prisma.paymentInstitutionConfiguration.createMany({
      data: [
        { tenantId, name: "Caixa Local", code: "CAIXA_LOCAL", paymentInstitution: PaymentInstitution.CAIXA_LOCAL },
        { tenantId, name: "PagBank", code: "PAGBANK", paymentInstitution: PaymentInstitution.PAGBANK },
        { tenantId, name: "Mercado Pago", code: "MERCADO_PAGO", paymentInstitution: PaymentInstitution.MERCADO_PAGO },
      ],
      skipDuplicates: true,
    });
    const institutions = await this.prisma.paymentInstitutionConfiguration.findMany({
      where: { tenantId, active: true, paymentInstitution: { not: null } },
      select: { paymentInstitution: true, name: true },
      orderBy: { name: "asc" },
    });
    return institutions.flatMap((institution) => institution.paymentInstitution ? [{
      institution: institution.paymentInstitution,
      name: institution.name,
      methods: methodsForInstitution(institution.paymentInstitution),
    }] : []);
  }

  async confirm(user: AuthUser, dto: ConfirmManualPaymentDto, idempotencyKey: string) {
    const amount = new Prisma.Decimal(dto.amount);
    const cashReceived = dto.cashReceivedAmount
      ? new Prisma.Decimal(dto.cashReceivedAmount)
      : undefined;
    const validation = validateManualPayment(dto.institution, dto.method, amount, cashReceived);
    const institution = await this.prisma.paymentInstitutionConfiguration.findFirst({
      where: {
        tenantId: user.tenantId,
        paymentInstitution: dto.institution,
        active: true,
      },
      select: { id: true },
    });
    if (!institution) throw new ConflictException("Instituicao de pagamento nao esta habilitada");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentCharge.findUnique({
        where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey } },
      });
      if (existing) return projectManualCharge(existing);

      const activeCharge = await tx.paymentCharge.findFirst({
        where: {
          tenantId: user.tenantId,
          targetType: dto.targetType,
          ...(dto.targetType === PaymentTargetType.ORDER
            ? { orderId: dto.targetId }
            : { serviceTabId: dto.targetId }),
          status: {
            in: [
              ChargeStatus.CREATED,
              ChargeStatus.WAITING_CUSTOMER,
              ChargeStatus.PROCESSING,
              ChargeStatus.UNKNOWN,
            ],
          },
        },
        select: { id: true },
      });
      if (activeCharge) {
        throw new ConflictException("Existe uma cobranca ativa para este saldo");
      }

      const target = await loadTarget(
        tx,
        user.tenantId,
        user.id,
        dto.targetType,
        dto.targetId,
      );
      const balance = target.gross.sub(target.paid);
      if (balance.lessThanOrEqualTo(0)) throw new ConflictException("Este saldo ja esta pago");
      if (!amount.equals(balance)) {
        throw new ConflictException({
          statusCode: 409,
          code: "PAYMENT_BALANCE_CHANGED",
          message: `O saldo da comanda foi atualizado para R$ ${balance.toFixed(2)}. Feche e abra a cobranca novamente.`,
          requestedAmount: amount.toFixed(2),
          currentBalance: balance.toFixed(2),
        });
      }

      const now = new Date();
      const charge = await tx.paymentCharge.create({
        data: {
          tenantId: user.tenantId,
          targetType: dto.targetType,
          orderId: dto.targetType === PaymentTargetType.ORDER ? dto.targetId : null,
          serviceTabId: dto.targetType === PaymentTargetType.SERVICE_TAB ? dto.targetId : null,
          institution: dto.institution,
          method: dto.method,
          mode: ChargeMode.MANUAL,
          status: ChargeStatus.APPROVED,
          amount,
          cashReceivedAmount: cashReceived,
          cashChangeAmount: validation.cashChangeAmount,
          manualReference: dto.manualReference?.trim() || null,
          idempotencyKey,
          createdByUserId: user.id,
          confirmedByUserId: user.id,
          finalizedAt: now,
        },
      });
      const payment = await tx.payment.create({
        data: {
          tenantId: user.tenantId,
          chargeId: charge.id,
          institution: dto.institution,
          method: dto.method,
          grossAmount: amount,
          netAmount: amount,
          approvedAt: now,
        },
      });
      await tx.paymentAllocation.create({
        data: {
          tenantId: user.tenantId,
          paymentId: payment.id,
          orderId: charge.orderId,
          serviceTabId: charge.serviceTabId,
          amount,
        },
      });
      if (charge.serviceTabId) {
        await tx.serviceTab.update({
          where: { id: charge.serviceTabId },
          data: {
            status: ServiceTabStatus.PAID,
            closedAt: now,
            closedByUserId: user.id,
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
          type: OperationalEventType.PAYMENT_MANUALLY_CONFIRMED,
          source: OperationalEventSource.USER,
          metadata: {
            institution: dto.institution,
            method: dto.method,
            amount: amount.toFixed(2),
          },
        },
      });
      this.logger.log(
        `event=manual_payment.confirmed metric=manual_payments_confirmed value=1 tenantId=${user.tenantId} chargeId=${charge.id} institution=${dto.institution} method=${dto.method}`,
      );
      return projectManualCharge(charge);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export function methodsForInstitution(institution: PaymentInstitution): PaymentMethod[] {
  if (CASH_INSTITUTIONS.has(institution)) return [PaymentMethod.CASH];
  return [
    PaymentMethod.DEBIT_CARD,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.PIX,
    PaymentMethod.VOUCHER,
    PaymentMethod.DIGITAL_WALLET,
  ];
}

async function loadTarget(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  targetType: PaymentTargetType,
  targetId: string,
) {
  if (targetType === PaymentTargetType.ORDER) {
    const order = await tx.order.findFirst({
      where: { id: targetId, tenantId, deletedAt: null },
      select: {
        total: true,
        assignedUserId: true,
        paymentAllocations: {
          where: { payment: { cancelledAt: null, refundedAt: null } },
          select: { amount: true },
        },
      },
    });
    if (!order) throw new NotFoundException("Pedido nao encontrado");
    if (order.assignedUserId && order.assignedUserId !== userId) {
      throw new ConflictException("Transfira a responsabilidade do pedido antes de cobrar");
    }
    return {
      gross: order.total,
      paid: order.paymentAllocations.reduce(
        (sum, allocation) => sum.add(allocation.amount),
        new Prisma.Decimal(0),
      ),
    };
  }
  const tab = await tx.serviceTab.findFirst({
    where: {
      id: targetId,
      tenantId,
      status: { in: [ServiceTabStatus.OPEN, ServiceTabStatus.CHECKOUT_PENDING] },
    },
    select: {
      assignedUserId: true,
      orders: {
        where: { deletedAt: null, status: { not: "CANCELLED" } },
        select: { total: true },
      },
      paymentAllocations: {
        where: { payment: { cancelledAt: null, refundedAt: null } },
        select: { amount: true },
      },
    },
  });
  if (!tab) throw new NotFoundException("Comanda aberta nao encontrada");
  if (tab.assignedUserId && tab.assignedUserId !== userId) {
    throw new ConflictException("Transfira a responsabilidade da comanda antes de cobrar");
  }
  return {
    gross: tab.orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0)),
    paid: tab.paymentAllocations.reduce(
      (sum, allocation) => sum.add(allocation.amount),
      new Prisma.Decimal(0),
    ),
  };
}

export function projectManualCharge(charge: {
  id: string;
  targetType: PaymentTargetType;
  orderId: string | null;
  serviceTabId: string | null;
  institution: PaymentInstitution;
  method: PaymentMethod;
  mode: ChargeMode;
  status: ChargeStatus;
  amount: Prisma.Decimal;
  cashReceivedAmount: Prisma.Decimal | null;
  cashChangeAmount: Prisma.Decimal | null;
  terminalId: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  finalizedAt: Date | null;
}) {
  return {
    id: charge.id,
    targetType: charge.targetType,
    targetId: charge.orderId ?? charge.serviceTabId!,
    institution: charge.institution,
    method: charge.method,
    mode: charge.mode,
    status: charge.status,
    amount: charge.amount.toFixed(2),
    cashReceivedAmount: charge.cashReceivedAmount?.toFixed(2) ?? null,
    cashChangeAmount: charge.cashChangeAmount?.toFixed(2) ?? null,
    providerStatus: charge.providerStatus,
    providerStatusDetail: charge.providerStatusDetail,
    terminalId: charge.terminalId,
    createdAt: charge.createdAt.toISOString(),
    expiresAt: charge.expiresAt?.toISOString() ?? null,
    finalizedAt: charge.finalizedAt?.toISOString() ?? null,
  };
}
