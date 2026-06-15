import { Inject, Injectable, Logger } from "@nestjs/common";
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
import { IfoodClient } from "./ifood-client";
import { mapIfoodOrderToExternalDraft } from "./ifood-order-mapper";

const POLLING_INTERVAL_MS = 30_000;
const DETAIL_RETRY_WINDOW_MS = 10 * 60_000;

@Injectable()
export class IfoodEventPollerService {
  private readonly logger = new Logger(IfoodEventPollerService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient,
    @Inject(ExternalOrderIngestionService)
    private readonly externalOrderIngestion: ExternalOrderIngestionService,
    @Inject(DeliveryIntegrationAuditService)
    private readonly audit: DeliveryIntegrationAuditService
  ) {}

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

    const details = await this.ifoodClient.getOrderDetails({
      accessToken,
      orderId: event.externalOrderId,
    });

    if (!details) {
      await this.deferEventRetry(event, "Detalhes do pedido ainda indisponiveis");
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
}
