import { Injectable, Logger } from "@nestjs/common";
import { ChargeStatus, PaymentInstitution } from "@prisma/client";
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
    const staleBefore = new Date(Date.now() - 60_000);
    const pending = await this.prisma.paymentCharge.findMany({
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
      take: limit,
    });
    const results = [];
    for (const charge of pending) {
      try {
        const order = await this.authenticated.execute({
          tenantId: charge.tenantId,
          integrationId: charge.connectionId!,
          request: (token) => this.point.getOrder(token, charge.providerOrderId!),
        });
        await this.charges.applyProviderOrder(charge.id, order);
        results.push({ chargeId: charge.id, reconciled: true });
      } catch {
        await this.prisma.paymentCharge.update({
          where: { id: charge.id },
          data: { lastCheckedAt: new Date() },
        });
        results.push({ chargeId: charge.id, reconciled: false });
      }
    }
    const succeeded = results.filter((result) => result.reconciled).length;
    this.logger.log(
      `event=point.reconciliation.completed metric=point_reconciliation_duration_ms value=${Date.now() - startedAt} attempted=${results.length} succeeded=${succeeded} failed=${results.length - succeeded}`,
    );
    return results;
  }
}
