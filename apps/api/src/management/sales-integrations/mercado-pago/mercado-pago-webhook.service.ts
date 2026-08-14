import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BackgroundJob, Prisma } from "@prisma/client";
import { BackgroundJobRegistry } from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { ProviderTransactionStateService } from "../provider-transaction-state.service";
import { IntegrationAuditService } from "../integration-audit.service";
import { MercadoPagoAuthenticatedRequestService } from "./mercado-pago-authenticated-request.service";
import { MercadoPagoClient } from "./mercado-pago.client";
import { mapMercadoPagoPayment } from "./mercado-pago.mapper";
import { MercadoPagoWebhookPayload } from "./mercado-pago.types";

@Injectable()
export class MercadoPagoWebhookService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly client: MercadoPagoClient,
    private readonly states: ProviderTransactionStateService,
    private readonly audit: IntegrationAuditService,
    @Optional() private readonly jobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.durableEnabled()) return;
    if (!this.jobs || !this.registry) throw new Error("Durable provider webhooks require BackgroundJobsModule");
    this.registry.register({
      type: "PROVIDER_WEBHOOK",
      policy: { leaseMs: 120_000, retryBaseDelayMs: 5_000, retryMaxDelayMs: 600_000 },
      execute: (job) => this.execute(job),
    });
    await this.enqueueRecoverableNotifications();
  }

  async accept(input: {
    eventKey: string;
    payload: MercadoPagoWebhookPayload;
  }): Promise<{ accepted: true; duplicate: boolean }> {
    const resourceType = resource(input.payload.type);
    const environment = input.payload.live_mode === false ? "TEST" : "PRODUCTION";
    let notification: { id: string };
    try {
      notification = await this.prisma.providerNotification.create({
        data: {
          provider: "MERCADO_PAGO",
          environment,
          eventKey: input.eventKey,
          providerEventId: input.payload.id == null ? null : String(input.payload.id),
          providerUserId: input.payload.user_id == null ? null : String(input.payload.user_id),
          resourceType,
          providerResourceId: String(input.payload.data.id),
          action: input.payload.action,
          signatureStatus: "VALID",
          payload: this.secrets.redact(input.payload) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return { accepted: true, duplicate: true };
      throw error;
    }
    if (this.durableEnabled()) {
      if (!this.jobs) throw new Error("Background jobs are unavailable");
      await this.jobs.enqueue({
        type: "PROVIDER_WEBHOOK",
        priority: "CRITICAL",
        targetType: "ProviderNotification",
        targetId: notification.id,
        dedupeKey: notification.id,
        payload: {},
      });
    } else {
      setImmediate(() => void this.process(notification.id));
    }
    return { accepted: true, duplicate: false };
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    await this.process(job.targetId, true);
    return { processedCount: 1 };
  }

  async enqueueRecoverableNotifications(): Promise<void> {
    if (!this.jobs) throw new Error("Background jobs are unavailable");
    let after: string | undefined;
    do {
      const page = await this.prisma.providerNotification.findMany({
        where: {
          status: { in: ["RECEIVED", "FAILED"] },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        select: { id: true, tenantId: true },
        orderBy: { id: "asc" },
        take: 25,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      });
      for (const notification of page) {
        await this.jobs.enqueue({
          tenantId: notification.tenantId,
          type: "PROVIDER_WEBHOOK",
          priority: "CRITICAL",
          targetType: "ProviderNotification",
          targetId: notification.id,
          dedupeKey: notification.id,
          payload: {},
        });
      }
      after = page.length === 25 ? page[page.length - 1]?.id : undefined;
    } while (after);
  }

  async process(notificationId: string, rethrow = false): Promise<void> {
    const claimed = await this.prisma.providerNotification.updateMany({
      where: {
        id: notificationId,
        status: { in: ["RECEIVED", "FAILED"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return;
    const notification = await this.prisma.providerNotification.findUniqueOrThrow({
      where: { id: notificationId },
    });
    try {
      if (!notification.providerUserId) throw new Error("Conta autorizadora ausente");
      const connection = await this.prisma.salesIntegration.findFirst({
        where: {
          provider: "MERCADO_PAGO",
          providerUserId: notification.providerUserId,
          environment: notification.environment,
          status: { not: "DISABLED" },
        },
      });
      if (!connection) throw new Error("Conexao Mercado Pago nao encontrada");
      if (notification.resourceType !== "PAYMENT") {
        await this.prisma.providerNotification.update({
          where: { id: notificationId },
          data: {
            tenantId: connection.tenantId,
            integrationId: connection.id,
            status: "IGNORED",
            processedAt: new Date(),
          },
        });
        return;
      }
      const payment = await this.authenticated.execute({
        tenantId: connection.tenantId,
        integrationId: connection.id,
        request: (token) => this.client.getPayment(token, notification.providerResourceId),
      });
      await this.states.upsertFromMovement({
        tenantId: connection.tenantId,
        integrationId: connection.id,
        provider: "MERCADO_PAGO",
        movement: mapMercadoPagoPayment(payment),
      });
      await this.prisma.$transaction([
        this.prisma.providerNotification.update({
          where: { id: notificationId },
          data: {
            tenantId: connection.tenantId,
            integrationId: connection.id,
            status: "PROCESSED",
            processedAt: new Date(),
            nextAttemptAt: null,
          },
        }),
        this.prisma.salesIntegration.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        }),
      ]);
      await this.audit.record({
        tenantId: connection.tenantId,
        integrationId: connection.id,
        action: "MERCADO_PAGO_WEBHOOK_PROCESSED",
        outcome: "SUCCESS",
        metadata: {
          resourceType: notification.resourceType,
          resourceId: notification.providerResourceId,
        },
      });
    } catch (error) {
      const delayMinutes = Math.min(60, 2 ** Math.min(notification.attempts, 5));
      await this.prisma.providerNotification.update({
        where: { id: notificationId },
        data: {
          status: "FAILED",
          nextAttemptAt: this.durableEnabled() ? null : new Date(Date.now() + delayMinutes * 60_000),
        },
      });
      if (rethrow) throw error;
    }
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("PROVIDER_WEBHOOK_DURABLE_JOBS_ENABLED") === "true";
  }
}

function resource(
  type: MercadoPagoWebhookPayload["type"]
): "PAYMENT" | "ORDER" | "CLAIM" | "CHARGEBACK" {
  if (type === "payment") return "PAYMENT";
  if (type === "order") return "ORDER";
  if (type === "topic_claims_integration_wh") return "CLAIM";
  return "CHARGEBACK";
}
