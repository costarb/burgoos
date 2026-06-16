import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../platform/database/prisma.service";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";

@Injectable()
export class DeliveryIntegrationHealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    private readonly config: ConfigService
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
    const pollingIntervalSeconds = this.pollingIntervalSeconds();
    const lastPollingAt = integration.lastSuccessfulPollingAt;
    const nextPollingAt = lastPollingAt
      ? new Date(lastPollingAt.getTime() + pollingIntervalSeconds * 1_000)
      : null;
    const schedulerEnabled = this.config.get<string>("DELIVERY_INTEGRATIONS_ENABLED") !== "false";
    const pollingReady =
      schedulerEnabled &&
      integration.status === "ACTIVE" &&
      integration.pollingEnabled &&
      Boolean(integration.externalMerchantId) &&
      Boolean(credential);

    return {
      integrationId,
      status: integration.status,
      merchantStatus: integration.lastErrorMessage ? "WARNING" : "UNKNOWN",
      lastSuccessfulPollingAt: integration.lastSuccessfulPollingAt?.toISOString() ?? null,
      polling: {
        schedulerEnabled,
        enabled: integration.pollingEnabled,
        ready: pollingReady,
        status: this.pollingStatus({
          schedulerEnabled,
          integrationStatus: integration.status,
          pollingEnabled: integration.pollingEnabled,
          hasCredential: Boolean(credential),
          hasMerchant: Boolean(integration.externalMerchantId),
        }),
        intervalSeconds: pollingIntervalSeconds,
        lastSuccessfulPollingAt: lastPollingAt?.toISOString() ?? null,
        nextExpectedPollingAt: nextPollingAt?.toISOString() ?? null,
      },
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

  private pollingIntervalSeconds() {
    const configured = Number(this.config.get<string>("DELIVERY_POLLING_INTERVAL_SECONDS"));
    return Math.max(Number.isFinite(configured) ? configured : 30, 30);
  }

  private pollingStatus(input: {
    schedulerEnabled: boolean;
    integrationStatus: string;
    pollingEnabled: boolean;
    hasCredential: boolean;
    hasMerchant: boolean;
  }) {
    if (!input.schedulerEnabled) return "SCHEDULER_DISABLED";
    if (input.integrationStatus !== "ACTIVE") return "INTEGRATION_NOT_ACTIVE";
    if (!input.pollingEnabled) return "POLLING_DISABLED";
    if (!input.hasCredential) return "MISSING_CREDENTIALS";
    if (!input.hasMerchant) return "MISSING_MERCHANT";
    return "READY";
  }
}
