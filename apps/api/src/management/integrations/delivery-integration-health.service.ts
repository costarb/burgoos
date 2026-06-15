import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/database/prisma.service";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";

@Injectable()
export class DeliveryIntegrationHealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService
  ) {}

  async getHealth(tenantId: string, integrationId: string) {
    const integration = await this.integrationsService.getForTenant(tenantId, integrationId);
    const [pendingEvents, failedEvents, retryableSyncs] = await Promise.all([
      this.prisma.deliveryPlatformEvent.count({
        where: {
          tenantId,
          integrationId,
          status: { in: ["RECEIVED", "PROCESSING", "ACK_PENDING"] },
        },
      }),
      this.prisma.deliveryPlatformEvent.count({
        where: { tenantId, integrationId, status: "FAILED" },
      }),
      this.prisma.platformSyncAttempt.count({
        where: { tenantId, integrationId, status: "RETRYABLE" },
      }),
    ]);

    return {
      integrationId,
      status: integration.status,
      merchantStatus: integration.lastErrorMessage ? "WARNING" : "UNKNOWN",
      lastSuccessfulPollingAt: integration.lastSuccessfulPollingAt?.toISOString() ?? null,
      pendingEvents,
      failedEvents,
      retryableSyncs,
      homologationChecks: [
        {
          key: "credentials",
          passed: integration.credentials.length > 0,
          message: integration.credentials.length > 0 ? null : "Credenciais ativas pendentes",
        },
        {
          key: "merchant",
          passed: Boolean(integration.externalMerchantId),
          message: integration.externalMerchantId ? null : "Merchant iFood pendente",
        },
      ],
    };
  }
}
