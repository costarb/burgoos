import { Injectable, Logger } from "@nestjs/common";
import { ChargeStatus, PaymentCharge, PaymentInstitution } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { MercadoPagoAuthenticatedRequestService } from "../../management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service";
import { PaymentChargeService } from "../application/payment-charge.service";
import { MercadoPagoPointClient } from "./mercado-pago-point.client";

@Injectable()
export class PointReconciliationService {
  private readonly logger = new Logger(PointReconciliationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly point: MercadoPagoPointClient,
    private readonly charges: PaymentChargeService,
  ) {}

  async reconcilePending(limit = 25) {
    const startedAt = Date.now();
    const pending = await this.findStaleCharges(limit);
    const results = [];
    for (const charge of pending) {
      results.push(await this.reconcileCharge(charge));
    }
    const succeeded = results.filter((result) => result.reconciled).length;
    this.logger.log(
      `event=point.reconciliation.completed metric=point_reconciliation_duration_ms value=${Date.now() - startedAt} attempted=${results.length} succeeded=${succeeded} failed=${results.length - succeeded}`,
    );
    return results;
  }

  async findStaleCharges(limit = 25) {
    const staleBefore = new Date(Date.now() - 60_000);
    return this.prisma.paymentCharge.findMany({
      where: {
        institution: PaymentInstitution.MERCADO_PAGO,
        status: {
          in: [
            ChargeStatus.CREATED,
            ChargeStatus.WAITING_CUSTOMER,
            ChargeStatus.PROCESSING,
            ChargeStatus.UNKNOWN,
          ],
        },
        providerOrderId: { not: null },
        connectionId: { not: null },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: staleBefore } }],
      },
      orderBy: { lastCheckedAt: "asc" },
      take: Math.max(1, Math.min(limit, 25)),
    });
  }

  async reconcileCharge(
    charge: Pick<PaymentCharge, "id" | "tenantId" | "connectionId" | "providerOrderId">,
  ): Promise<{ chargeId: string; reconciled: boolean }> {
    if (!charge.connectionId || !charge.providerOrderId) {
      return { chargeId: charge.id, reconciled: false };
    }
    try {
      const order = await this.authenticated.execute({
        tenantId: charge.tenantId,
        integrationId: charge.connectionId,
        request: (token) => this.point.getOrder(token, charge.providerOrderId!),
      });
      await this.charges.applyProviderOrder(charge.id, order);
      return { chargeId: charge.id, reconciled: true };
    } catch {
      await this.prisma.paymentCharge.update({
        where: { id: charge.id },
        data: { lastCheckedAt: new Date() },
      });
      return { chargeId: charge.id, reconciled: false };
    }
  }
}
