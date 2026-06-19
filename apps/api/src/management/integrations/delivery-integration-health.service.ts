import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../platform/database/prisma.service";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";
import { IfoodClient } from "./ifood/ifood-client";

@Injectable()
export class DeliveryIntegrationHealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient,
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
    const merchantOperations = await this.getMerchantOperations({
      tenantId,
      integrationId,
      externalMerchantId: integration.externalMerchantId,
      hasCredential: Boolean(credential),
    });
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
      merchantOperations,
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

  private async getMerchantOperations(input: {
    tenantId: string;
    integrationId: string;
    externalMerchantId: string | null;
    hasCredential: boolean;
  }) {
    if (!input.externalMerchantId || !input.hasCredential) {
      return null;
    }

    try {
      const secret = await this.integrationsService.getActiveCredentialSecret(
        input.tenantId,
        input.integrationId
      );
      const [statusesResult, openingHoursResult] = await Promise.allSettled([
        this.ifoodClient.getMerchantStatus({
          accessToken: secret.accessToken,
          merchantId: input.externalMerchantId,
        }),
        this.ifoodClient.getOpeningHours({
          accessToken: secret.accessToken,
          merchantId: input.externalMerchantId,
        }),
      ]);
      const now = new Date();
      const statuses = statusesResult.status === "fulfilled" ? statusesResult.value : [];
      const openingHours =
        openingHoursResult.status === "fulfilled" ? openingHoursResult.value : null;
      const insideOpeningHours = openingHours
        ? isInsideOpeningHours(now, openingHours.shifts)
        : null;
      const deliveryStatus =
        statuses.find((status) => status.operation === "delivery") ?? statuses[0] ?? null;

      if (!deliveryStatus && statusesResult.status === "rejected") {
        throw statusesResult.reason;
      }

      return {
        available: Boolean(deliveryStatus?.available),
        state: deliveryStatus?.state ?? "UNKNOWN",
        title: deliveryStatus?.title ?? null,
        subtitle:
          deliveryStatus?.subtitle ??
          (openingHoursResult.status === "rejected"
            ? `Horarios indisponiveis: ${errorMessage(openingHoursResult.reason)}`
            : null),
        insideOpeningHours,
        checkedAt: now.toISOString(),
        validations:
          deliveryStatus?.validations.map((validation) => ({
            id: validation.id,
            state: validation.state,
            code: validation.code,
            title: validation.title,
            subtitle: validation.subtitle,
          })) ?? [],
        openingHours:
          openingHours?.shifts.map((shift) => ({
            id: shift.id,
            dayOfWeek: shift.dayOfWeek,
            start: shift.start,
            duration: shift.duration,
            end: endTime(shift.start, shift.duration),
            activeNow: isShiftActive(now, shift),
          })) ?? [],
      };
    } catch (error) {
      return {
        available: false,
        state: "UNKNOWN",
        title: "Status iFood indisponivel",
        subtitle: error instanceof Error ? error.message : "Nao foi possivel consultar o iFood.",
        insideOpeningHours: null,
        checkedAt: new Date().toISOString(),
        validations: [],
        openingHours: [],
      };
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel consultar o iFood.";
}

function isInsideOpeningHours(
  now: Date,
  shifts: Array<{ dayOfWeek: string; start: string; duration: number }>
) {
  return shifts.some((shift) => isShiftActive(now, shift));
}

function isShiftActive(now: Date, shift: { dayOfWeek: string; start: string; duration: number }) {
  if (dayOfWeek(now) !== shift.dayOfWeek) {
    return false;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(shift.start);
  const endMinutes = startMinutes + shift.duration;

  if (endMinutes >= 24 * 60) {
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes % (24 * 60);
  }

  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

function dayOfWeek(date: Date) {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][
    date.getDay()
  ];
}

function parseTimeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function endTime(start: string, duration: number) {
  const minutes = (parseTimeToMinutes(start) + duration) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}
