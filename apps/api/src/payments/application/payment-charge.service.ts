import { ConflictException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import {
  ChargeMode,
  ChargeStatus,
  PaymentInstitution,
  PaymentTargetType,
  Prisma,
} from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { MercadoPagoAuthenticatedRequestService } from "../../management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service";
import { CreateChargeDto } from "./dto/create-charge.dto";
import { MercadoPagoPointClient } from "../mercado-pago-point/mercado-pago-point.client";
import { mapPointOrder } from "../mercado-pago-point/mercado-pago-point.mapper";
import { PaymentSettlementService } from "./payment-settlement.service";
import { canTransitionChargeStatus } from "./charge-status";
import { PaymentExceptionService } from "./payment-exception.service";

const activeStatuses: ChargeStatus[] = [
  ChargeStatus.CREATED,
  ChargeStatus.WAITING_CUSTOMER,
  ChargeStatus.PROCESSING,
  ChargeStatus.UNKNOWN,
];

@Injectable()
export class PaymentChargeService {
  private readonly logger = new Logger(PaymentChargeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly point: MercadoPagoPointClient,
    private readonly settlement: PaymentSettlementService,
    @Optional() private readonly exceptions?: PaymentExceptionService,
  ) {}

  async createAutomatic(user: AuthUser, dto: CreateChargeDto, idempotencyKey: string) {
    if (dto.mode !== ChargeMode.AUTOMATIC || dto.institution !== PaymentInstitution.MERCADO_PAGO) {
      throw new ConflictException("Cobranca automatica disponivel somente para Mercado Pago Point");
    }
    if (!dto.terminalId) throw new ConflictException("Selecione uma maquininha Point");
    const terminal = await this.prisma.paymentTerminal.findFirst({
      where: { id: dto.terminalId, tenantId: user.tenantId, enabled: true, operatingMode: "PDV" },
    });
    if (!terminal) throw new NotFoundException("Maquininha Point habilitada nao encontrada");
    await this.assertTarget(user.tenantId, dto.targetType, dto.targetId, new Prisma.Decimal(dto.amount));
    const charge = await this.prisma.$transaction(async (tx) => {
      const existingActive = await tx.paymentCharge.findFirst({
        where: {
          tenantId: user.tenantId,
          targetType: dto.targetType,
          ...(dto.targetType === PaymentTargetType.ORDER
            ? { orderId: dto.targetId }
            : { serviceTabId: dto.targetId }),
          status: { in: activeStatuses },
        },
      });
      if (existingActive) throw new ConflictException("Ja existe uma cobranca ativa para este saldo");
      return tx.paymentCharge.create({
        data: {
          tenantId: user.tenantId,
          targetType: dto.targetType,
          orderId: dto.targetType === PaymentTargetType.ORDER ? dto.targetId : null,
          serviceTabId: dto.targetType === PaymentTargetType.SERVICE_TAB ? dto.targetId : null,
          institution: dto.institution,
          method: dto.method,
          mode: dto.mode,
          amount: dto.amount,
          terminalId: terminal.id,
          connectionId: terminal.connectionId,
          idempotencyKey,
          externalReference: `rrf5_${idempotencyKey.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 55)}`,
          createdByUserId: user.id,
          expiresAt: new Date(Date.now() + 16 * 60_000),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try {
      const startedAt = Date.now();
      const providerOrder = await this.authenticated.execute({
        tenantId: user.tenantId,
        integrationId: terminal.connectionId,
        request: (token) => this.point.createOrder(token, {
          terminalId: terminal.providerTerminalId,
          externalReference: charge.externalReference!,
          amount: charge.amount.toFixed(2),
          description: `Pedido ${dto.targetId.slice(0, 8)}`,
        }, idempotencyKey),
      });
      this.logger.log(
        `event=point.charge.created metric=point_charge_duration_ms value=${Date.now() - startedAt} tenantId=${user.tenantId} chargeId=${charge.id} terminalId=${terminal.id}`,
      );
      return this.applyProviderOrder(charge.id, providerOrder);
    } catch (error) {
      await this.prisma.paymentCharge.update({
        where: { id: charge.id },
        data: {
          status: ChargeStatus.FAILED,
          providerStatusDetail: error instanceof Error ? error.message.slice(0, 240) : "Falha na integracao",
          finalizedAt: new Date(),
        },
      });
      await this.exceptions?.detect(charge.id);
      this.logger.error(
        `event=point.charge.failed metric=point_charge_failures value=1 tenantId=${user.tenantId} chargeId=${charge.id} terminalId=${terminal.id} errorType=${error instanceof Error ? error.name : "UnknownError"}`,
      );
      throw error;
    }
  }

  async get(tenantId: string, chargeId: string) {
    const charge = await this.prisma.paymentCharge.findFirst({ where: { id: chargeId, tenantId } });
    if (!charge) throw new NotFoundException("Cobranca nao encontrada");
    return projectCharge(charge);
  }

  async active(tenantId: string, targetType: PaymentTargetType, targetId: string) {
    const charge = await this.prisma.paymentCharge.findFirst({
      where: {
        tenantId,
        targetType,
        ...(targetType === PaymentTargetType.ORDER
          ? { orderId: targetId }
          : { serviceTabId: targetId }),
      },
      orderBy: { createdAt: "desc" },
    });
    return charge ? projectCharge(charge) : null;
  }

  async refresh(tenantId: string, chargeId: string) {
    const charge = await this.prisma.paymentCharge.findFirst({ where: { id: chargeId, tenantId } });
    if (!charge?.providerOrderId || !charge.connectionId) throw new NotFoundException("Cobranca Point nao encontrada");
    const order = await this.authenticated.execute({
      tenantId,
      integrationId: charge.connectionId,
      request: (token) => this.point.getOrder(token, charge.providerOrderId!),
    });
    return this.applyProviderOrder(charge.id, order);
  }

  async cancel(tenantId: string, chargeId: string, idempotencyKey: string) {
    const charge = await this.prisma.paymentCharge.findFirst({ where: { id: chargeId, tenantId } });
    if (!charge?.providerOrderId || !charge.connectionId) throw new NotFoundException("Cobranca Point nao encontrada");
    const order = await this.authenticated.execute({
      tenantId,
      integrationId: charge.connectionId,
      request: (token) => this.point.cancelOrder(token, charge.providerOrderId!, idempotencyKey),
    });
    return this.applyProviderOrder(charge.id, order);
  }

  async applyProviderOrder(chargeId: string, order: Parameters<typeof mapPointOrder>[0]) {
    const mapped = mapPointOrder(order);
    const current = await this.prisma.paymentCharge.findUnique({
      where: { id: chargeId },
      select: { status: true },
    });
    if (!current) throw new NotFoundException("Cobranca nao encontrada");
    if (
      current.status !== mapped.status &&
      !canTransitionChargeStatus(current.status, mapped.status)
    ) {
      return this.getById(chargeId);
    }
    const terminal = ["APPROVED", "DECLINED", "CANCELLED", "EXPIRED", "FAILED", "REFUNDED"].includes(mapped.status);
    const updated = await this.prisma.paymentCharge.updateMany({
      where: { id: chargeId, status: current.status },
      data: {
        status: mapped.status,
        providerOrderId: order.id,
        providerTransactionId: mapped.providerTransactionId,
        providerStatus: mapped.providerStatus,
        providerStatusDetail: mapped.providerStatusDetail,
        lastCheckedAt: new Date(),
        finalizedAt: terminal ? new Date() : null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return this.getById(chargeId);
    const charge = await this.prisma.paymentCharge.findUniqueOrThrow({ where: { id: chargeId } });
    await this.settlement.settleApproved(charge.id, mapped);
    await this.exceptions?.detect(charge.id);
    this.logger.log(
      `event=point.charge.status metric=payment_charge_status value=1 tenantId=${charge.tenantId} chargeId=${charge.id} providerOrderId=${charge.providerOrderId ?? "none"} status=${charge.status}`,
    );
    return projectCharge(charge);
  }

  private async getById(chargeId: string) {
    const charge = await this.prisma.paymentCharge.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException("Cobranca nao encontrada");
    return projectCharge(charge);
  }

  private async assertTarget(
    tenantId: string,
    type: PaymentTargetType,
    targetId: string,
    amount: Prisma.Decimal,
  ) {
    const target = type === PaymentTargetType.ORDER
      ? await this.prisma.order.findFirst({
          where: { id: targetId, tenantId, deletedAt: null },
          select: { total: true, paymentAllocations: { select: { amount: true } } },
        })
      : await this.prisma.serviceTab.findFirst({
          where: { id: targetId, tenantId },
          select: {
            orders: { where: { deletedAt: null }, select: { total: true } },
            paymentAllocations: { select: { amount: true } },
          },
        });
    if (!target) throw new NotFoundException("Pedido ou comanda nao encontrado");
    const gross = "total" in target
      ? target.total
      : target.orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0));
    const paid = target.paymentAllocations.reduce(
      (sum, allocation) => sum.add(allocation.amount),
      new Prisma.Decimal(0),
    );
    const balance = gross.sub(paid);
    if (balance.lessThanOrEqualTo(0)) throw new ConflictException("Este saldo ja esta pago");
    if (amount.greaterThan(balance)) throw new ConflictException("Valor da cobranca supera o saldo em aberto");
  }
}

function projectCharge(charge: {
  id: string; targetType: PaymentTargetType; orderId: string | null; serviceTabId: string | null;
  institution: PaymentInstitution; method: string; mode: ChargeMode; status: ChargeStatus;
  amount: Prisma.Decimal; providerStatus: string | null; providerStatusDetail: string | null;
  terminalId: string | null; createdAt: Date; expiresAt: Date | null; finalizedAt: Date | null;
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
    cashReceivedAmount: null,
    cashChangeAmount: null,
    providerStatus: charge.providerStatus,
    providerStatusDetail: charge.providerStatusDetail,
    terminalId: charge.terminalId,
    createdAt: charge.createdAt.toISOString(),
    expiresAt: charge.expiresAt?.toISOString() ?? null,
    finalizedAt: charge.finalizedAt?.toISOString() ?? null,
  };
}
