import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../platform/database/prisma.service";
import { ProviderTransactionStateService } from "../provider-transaction-state.service";
import { IntegrationAuditService } from "../integration-audit.service";
import { SalesIntegrationOperationLockService } from "../sales-integration-operation-lock.service";
import { MercadoPagoAuthenticatedRequestService } from "./mercado-pago-authenticated-request.service";
import { MercadoPagoClient } from "./mercado-pago.client";
import { mapMercadoPagoPayment } from "./mercado-pago.mapper";

@Injectable()
export class MercadoPagoReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly client: MercadoPagoClient,
    private readonly states: ProviderTransactionStateService,
    private readonly locks: SalesIntegrationOperationLockService,
    private readonly audit: IntegrationAuditService
  ) {}

  async reconcile(hours: 24 | 168): Promise<void> {
    let cursor: string | undefined;
    do {
      const connections = await this.prisma.salesIntegration.findMany({
        where: { provider: "MERCADO_PAGO", status: "ACTIVE" },
        select: { id: true, tenantId: true },
        orderBy: { id: "asc" },
        take: 25,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const connection of connections) {
        await this.reconcileConnection(connection.tenantId, connection.id, hours);
      }
      cursor = connections.length === 25 ? connections.at(-1)?.id : undefined;
    } while (cursor);
  }

  async reconcileConnection(
    tenantId: string,
    integrationId: string,
    hours: 24 | 168
  ): Promise<boolean> {
    const owner = `mp-reconciliation:${hours}`;
    if (!(await this.locks.acquire({ tenantId, integrationId, owner, leaseMs: 10 * 60_000 })))
      return false;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - hours * 3_600_000);
      const payments = await this.authenticated.execute({
        tenantId,
        integrationId,
        request: (token, collectorId) =>
          this.client.searchPayments({
            accessToken: token,
            collectorId,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            rangeField: "date_last_updated",
          }),
      });
      for (const payment of payments)
        await this.states.upsertFromMovement({
          tenantId,
          integrationId,
          provider: "MERCADO_PAGO",
          movement: mapMercadoPagoPayment(payment),
        });
      await this.prisma.salesIntegration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() },
      });
      await this.audit.record({
        tenantId,
        integrationId,
        action: "MERCADO_PAGO_RECONCILED",
        outcome: "SUCCESS",
        metadata: { hours, resources: payments.length },
      });
      return true;
    } finally {
      await this.locks.release({ tenantId, integrationId, owner });
    }
  }
}
