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
    const credential = integration.credentials[0];
    const [
      pendingEvents,
      failedEvents,
      retryableSyncs,
      pendingDisputes,
      pendingExceptions,
      recentAudits,
    ] = await Promise.all([
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
      this.prisma.platformDispute.count({
        where: {
          tenantId,
          integrationId,
          respondedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.deliveryPlatformEvent.count({
        where: {
          tenantId,
          integrationId,
          normalizedSummary: {
            path: ["requiresOperatorReview"],
            equals: true,
          },
        },
      }),
      this.prisma.deliveryIntegrationAudit.findMany({
        where: { tenantId, integrationId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          entityType: true,
          result: true,
          createdAt: true,
        },
      }),
    ]);
    const tokenExpiresAt = credential?.tokenExpiresAt ?? null;
    const tokenExpiresInMinutes = tokenExpiresAt
      ? Math.max(0, Math.round((tokenExpiresAt.getTime() - Date.now()) / 60_000))
      : null;

    return {
      integrationId,
      status: integration.status,
      merchantStatus: integration.lastErrorMessage ? "WARNING" : "UNKNOWN",
      lastSuccessfulPollingAt: integration.lastSuccessfulPollingAt?.toISOString() ?? null,
      pendingEvents,
      failedEvents,
      retryableSyncs,
      pendingDisputes,
      pendingExceptions,
      tokenExpiresAt: tokenExpiresAt?.toISOString() ?? null,
      tokenExpiresInMinutes,
      tokenRequiresAttention: tokenExpiresInMinutes !== null && tokenExpiresInMinutes <= 60,
      recentAudits: recentAudits.map((audit) => ({
        ...audit,
        createdAt: audit.createdAt.toISOString(),
      })),
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
