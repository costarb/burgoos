import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeliveryIntegrationAuditAction,
  DeliveryIntegration,
  Prisma,
  DeliveryPlatformEvent,
} from "@prisma/client";
import { ExternalOrderIngestionService } from "../../../ordering/external-order-ingestion.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { DeliveryIntegrationAuditService } from "../delivery-integration-audit.service";
import { DeliveryIntegrationsService } from "../delivery-integrations.service";
import { IfoodDeliveryTrackingService } from "./ifood-delivery-tracking.service";
import { IfoodClient } from "./ifood-client";
import { IfoodDisputeService } from "./ifood-dispute.service";
import { mapIfoodOrderToExternalDraft } from "./ifood-order-mapper";

const POLLING_INTERVAL_MS = 30_000;
const DETAIL_RETRY_WINDOW_MS = 10 * 60_000;

@Injectable()
export class IfoodEventPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IfoodEventPollerService.name);
  private pollingTimer?: NodeJS.Timeout;
  private pollingRunning = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient,
    @Inject(ExternalOrderIngestionService)
    private readonly externalOrderIngestion: ExternalOrderIngestionService,
    @Inject(DeliveryIntegrationAuditService)
    private readonly audit: DeliveryIntegrationAuditService,
    @Optional()
    @Inject(IfoodDisputeService)
    private readonly disputes?: IfoodDisputeService,
    @Optional()
    @Inject(IfoodDeliveryTrackingService)
    private readonly tracking?: IfoodDeliveryTrackingService,
    @Optional()
    private readonly config?: ConfigService
  ) {}

  onModuleInit() {
    if (this.config?.get<string>("DELIVERY_INTEGRATIONS_ENABLED") === "false") {
      this.logger.log("ifood.poll.scheduler status=disabled");
      return;
    }

    const intervalMs = this.pollingIntervalMs();
    this.logger.log(`ifood.poll.scheduler status=started intervalMs=${intervalMs}`);

    this.pollingTimer = setInterval(() => {
      void this.runScheduledPolling();
    }, intervalMs);
    this.pollingTimer.unref?.();

    setTimeout(() => {
      void this.runScheduledPolling();
    }, 1_000).unref?.();
  }

  onModuleDestroy() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
  }

  private async runScheduledPolling() {
    if (this.pollingRunning) {
      this.logger.warn("ifood.poll.scheduler status=skipped reason=already_running");
      return;
    }

    this.pollingRunning = true;
    try {
      await this.pollDueIntegrations();
    } catch (error) {
      this.logger.error(
        `ifood.poll.scheduler status=failed error=${
          error instanceof Error ? error.message : "unknown"
        }`
      );
    } finally {
      this.pollingRunning = false;
    }
  }

  async pollDueIntegrations(now = new Date()) {
    const integrations = await this.prisma.deliveryIntegration.findMany({
      where: {
        provider: "IFOOD",
        status: "ACTIVE",
        pollingEnabled: true,
        OR: [
          { lastSuccessfulPollingAt: null },
          { lastSuccessfulPollingAt: { lt: new Date(now.getTime() - POLLING_INTERVAL_MS) } },
        ],
      },
    });

    for (const integration of integrations) {
      await this.pollIntegration(integration);
    }
  }

  async pollIntegration(integration: DeliveryIntegration) {
    if (!integration.externalMerchantId) {
      return;
    }

    this.logger.log(
      `ifood.poll.start tenantId=${integration.tenantId} integrationId=${integration.id} merchantId=${integration.externalMerchantId}`
    );

    const secret = await this.integrationsService.getActiveCredentialSecret(
      integration.tenantId,
      integration.id
    );

    const events = await this.ifoodClient.pollEvents({
      accessToken: secret.accessToken,
      merchantId: integration.externalMerchantId,
    });

    for (const event of events) {
      await this.persistAndProcessEvent(integration, secret.accessToken, event);
    }

    this.logger.log(
      `ifood.poll.complete tenantId=${integration.tenantId} integrationId=${integration.id} events=${events.length}`
    );

    await this.prisma.deliveryIntegration.update({
      where: { id: integration.id },
      data: {
        lastSuccessfulPollingAt: new Date(),
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  private async persistAndProcessEvent(
    integration: DeliveryIntegration,
    accessToken: string,
    event: {
      id: string;
      code: string;
      fullCode?: string | null;
      orderId?: string | null;
      createdAt?: string | null;
      metadata?: unknown;
      raw: unknown;
    }
  ) {
    const persisted = await this.prisma.deliveryPlatformEvent.upsert({
      where: {
        provider_externalEventId: {
          provider: "IFOOD",
          externalEventId: event.id,
        },
      },
      update: {},
      create: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        provider: "IFOOD",
        externalEventId: event.id,
        externalOrderId: event.orderId,
        eventCode: event.code,
        fullEventCode: event.fullCode,
        providerCreatedAt: event.createdAt ? new Date(event.createdAt) : null,
        payload: event.raw as Prisma.InputJsonValue,
        normalizedSummary: {
          orderId: event.orderId,
          metadata: event.metadata,
        } as Prisma.InputJsonObject,
      },
    });

    if (persisted.status === "ACKED") {
      return;
    }

    this.logger.log(
      `ifood.event.received tenantId=${integration.tenantId} integrationId=${integration.id} eventId=${event.id} code=${event.code} orderId=${event.orderId ?? "none"}`
    );

    await this.processEvent(integration, accessToken, persisted);
  }

  private async processEvent(
    integration: DeliveryIntegration,
    accessToken: string,
    event: DeliveryPlatformEvent
  ) {
    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(),
      },
    });

    if (!event.externalOrderId) {
      await this.markProcessedAndAck(event, accessToken, "IGNORED");
      return;
    }

    if (this.isDisputeEvent(event)) {
      await this.handleDisputeEvent(integration, event);
      await this.markProcessedAndAck(event, accessToken, "PROCESSED");
      return;
    }

    if (this.isCancellationResultEvent(event)) {
      await this.handleCancellationResultEvent(integration, event);
      await this.markProcessedAndAck(event, accessToken, "PROCESSED");
      return;
    }

    if (this.isTrackingEvent(event)) {
      await this.tracking?.refreshIfDue({
        tenantId: integration.tenantId,
        integrationId: integration.id,
        externalOrderId: event.externalOrderId,
      });
      await this.markProcessedAndAck(event, accessToken, "PROCESSED");
      return;
    }

    const details = await this.ifoodClient.getOrderDetails({
      accessToken,
      orderId: event.externalOrderId,
    });

    if (!details) {
      await this.deferEventRetry(event, "Detalhes do pedido ainda indisponiveis");
      return;
    }

    if (this.isOrderModificationEvent(event)) {
      await this.handleOrderModificationEvent(integration, event, details);
      await this.markProcessedAndAck(event, accessToken, "PROCESSED");
      return;
    }

    const orderDraft = mapIfoodOrderToExternalDraft(details);
    if (orderDraft.externalMerchantId === "missing-merchant-id" && integration.externalMerchantId) {
      orderDraft.externalMerchantId = integration.externalMerchantId;
    }

    const order = await this.externalOrderIngestion.ingest({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      orderPlatformId: integration.orderPlatformId,
      order: orderDraft,
    });

    await this.audit.record({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      action: DeliveryIntegrationAuditAction.ORDER_CREATED,
      entityType: "Order",
      entityId: order.id,
      result: "SUCCESS",
      metadata: {
        externalOrderId: orderDraft.externalOrderId,
        eventId: event.externalEventId,
      },
    });

    await this.markProcessedAndAck(event, accessToken, "PROCESSED");
  }

  private async handleOrderModificationEvent(
    integration: DeliveryIntegration,
    event: DeliveryPlatformEvent,
    details: unknown
  ) {
    const link = await this.prisma.platformOrderLink.findFirst({
      where: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        externalOrderId: event.externalOrderId ?? "",
      },
      select: { id: true },
    });

    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        normalizedSummary: {
          exceptionType: "ORDER_MODIFIED",
          externalOrderId: event.externalOrderId,
          requiresOperatorReview: true,
        } as Prisma.InputJsonObject,
      },
    });

    if (link) {
      await this.prisma.platformOrderLink.update({
        where: { id: link.id },
        data: {
          rawOrderSnapshot: details as Prisma.InputJsonValue,
          externalStatus: event.fullEventCode ?? event.eventCode,
          lastProviderUpdateAt: new Date(),
        },
      });
    }

    await this.audit.record({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      action: DeliveryIntegrationAuditAction.ORDER_UPDATED,
      entityType: "PlatformOrderLink",
      entityId: link?.id ?? event.externalOrderId,
      result: link ? "REQUIRES_OPERATOR_REVIEW" : "FAILED",
      metadata: {
        externalOrderId: event.externalOrderId,
        eventCode: event.eventCode,
      },
    });
  }

  private async handleCancellationResultEvent(
    integration: DeliveryIntegration,
    event: DeliveryPlatformEvent
  ) {
    const link = await this.prisma.platformOrderLink.findFirst({
      where: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        externalOrderId: event.externalOrderId ?? "",
      },
      select: { id: true },
    });

    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        normalizedSummary: {
          exceptionType: "CANCELLATION_RESULT",
          externalOrderId: event.externalOrderId,
          providerStatus: event.fullEventCode ?? event.eventCode,
        } as Prisma.InputJsonObject,
      },
    });

    if (link) {
      await this.prisma.platformOrderLink.update({
        where: { id: link.id },
        data: {
          externalStatus: event.fullEventCode ?? event.eventCode,
          lastProviderUpdateAt: new Date(),
        },
      });
    }

    await this.audit.record({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      action: DeliveryIntegrationAuditAction.ORDER_UPDATED,
      entityType: "PlatformOrderLink",
      entityId: link?.id ?? event.externalOrderId,
      result: link ? "SUCCESS" : "FAILED",
      metadata: {
        externalOrderId: event.externalOrderId,
        eventCode: event.eventCode,
      },
    });
  }

  private async handleDisputeEvent(integration: DeliveryIntegration, event: DeliveryPlatformEvent) {
    const payload = asRecord(event.payload);
    const metadata = asRecord(asRecord(event.normalizedSummary).metadata);
    const disputeId =
      stringFrom(payload.disputeId) ??
      stringFrom(metadata.disputeId) ??
      `${event.externalOrderId}-${event.externalEventId}`;

    await this.disputes?.persistFromEvent({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      externalOrderId: event.externalOrderId ?? "",
      externalDisputeId: disputeId,
      status: stringFrom(payload.status) ?? stringFrom(metadata.status) ?? "PENDING",
      proposal: (payload.proposal ?? metadata.proposal ?? payload) as Prisma.InputJsonValue,
      expiresAt:
        dateFrom(payload.expiresAt ?? metadata.expiresAt) ?? new Date(Date.now() + 86_400_000),
    });

    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        normalizedSummary: {
          exceptionType: "DISPUTE",
          externalOrderId: event.externalOrderId,
          externalDisputeId: disputeId,
          requiresOperatorReview: true,
        } as Prisma.InputJsonObject,
      },
    });
  }

  private async deferEventRetry(event: DeliveryPlatformEvent, message: string) {
    const receivedAt = event.receivedAt.getTime();
    const retryCount = event.retryCount + 1;
    const shouldFail = Date.now() - receivedAt > DETAIL_RETRY_WINDOW_MS;

    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        status: shouldFail ? "FAILED" : "RECEIVED",
        retryCount,
        nextRetryAt: shouldFail
          ? null
          : new Date(Date.now() + Math.min(retryCount * 15_000, 60_000)),
        errorMessage: message,
      },
    });

    if (shouldFail) {
      this.logger.warn(`iFood event failed eventId=${event.externalEventId} reason=${message}`);
    }
  }

  private async markProcessedAndAck(
    event: DeliveryPlatformEvent,
    accessToken: string,
    status: "PROCESSED" | "IGNORED"
  ) {
    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        status: "ACK_PENDING",
        processedAt: new Date(),
      },
    });

    await this.ifoodClient.acknowledgeEvents({
      accessToken,
      eventIds: [event.externalEventId],
    });

    this.logger.log(
      `ifood.event.ack tenantId=${event.tenantId} integrationId=${event.integrationId} eventId=${event.externalEventId} result=${status}`
    );

    await this.prisma.deliveryPlatformEvent.update({
      where: { id: event.id },
      data: {
        status: "ACKED",
        acknowledgedAt: new Date(),
      },
    });

    await this.audit.record({
      tenantId: event.tenantId,
      integrationId: event.integrationId,
      action: DeliveryIntegrationAuditAction.EVENT_ACKED,
      entityType: "DeliveryPlatformEvent",
      entityId: event.id,
      result: status,
      metadata: {
        externalEventId: event.externalEventId,
      },
    });
  }

  private isOrderModificationEvent(event: DeliveryPlatformEvent) {
    return this.eventName(event).includes("PATCH") || this.eventName(event).includes("MODIF");
  }

  private isCancellationResultEvent(event: DeliveryPlatformEvent) {
    const name = this.eventName(event);
    return name.includes("CANCEL") && (name.includes("RESULT") || name.includes("ACCEPT"));
  }

  private isDisputeEvent(event: DeliveryPlatformEvent) {
    return this.eventName(event).includes("DISPUTE");
  }

  private isTrackingEvent(event: DeliveryPlatformEvent) {
    const name = this.eventName(event);
    return name.includes("TRACK") || name.includes("DELIVERY_UPDATE");
  }

  private eventName(event: DeliveryPlatformEvent) {
    return `${event.eventCode} ${event.fullEventCode ?? ""}`.toUpperCase();
  }

  private pollingIntervalMs() {
    const configuredSeconds = Number(this.config?.get<string>("DELIVERY_POLLING_INTERVAL_SECONDS"));
    const intervalSeconds = Number.isFinite(configuredSeconds) ? configuredSeconds : 30;
    return Math.max(intervalSeconds, 30) * 1_000;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringFrom(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function dateFrom(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
