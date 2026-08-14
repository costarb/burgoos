import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BackgroundJob,
  PaymentInstitution,
  PaymentProviderEventStatus,
  Prisma,
} from "@prisma/client";
import { BackgroundJobRegistry } from "../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../common/background-jobs/background-job.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { MercadoPagoAuthenticatedRequestService } from "../../management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service";
import { PaymentChargeService } from "../application/payment-charge.service";
import { MercadoPagoPointClient } from "../mercado-pago-point/mercado-pago-point.client";

@Injectable()
export class PaymentProviderEventProcessor implements OnModuleInit {
  private readonly logger = new Logger(PaymentProviderEventProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly point: MercadoPagoPointClient,
    private readonly charges: PaymentChargeService,
    @Optional() private readonly jobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.durableEnabled()) return;
    if (!this.jobs || !this.registry) throw new Error("Durable payment webhooks require BackgroundJobsModule");
    this.registry.register({
      type: "PAYMENT_WEBHOOK",
      policy: { leaseMs: 120_000, retryBaseDelayMs: 5_000, retryMaxDelayMs: 600_000 },
      execute: (job) => this.execute(job),
    });
    await this.enqueueRecoverableEvents();
  }

  async accept(input: {
    eventId: string;
    resourceId: string;
    topic: string;
    payload: Prisma.InputJsonObject;
  }) {
    try {
      const event = await this.prisma.paymentProviderEvent.create({
        data: {
          provider: PaymentInstitution.MERCADO_PAGO,
          providerEventId: input.eventId,
          providerResourceId: input.resourceId,
          topic: input.topic,
          signatureValid: true,
          payloadRedacted: input.payload,
        },
        select: { id: true },
      });
      if (this.durableEnabled()) {
        if (!this.jobs) throw new Error("Background jobs are unavailable");
        await this.jobs.enqueue({
          type: "PAYMENT_WEBHOOK",
          priority: "CRITICAL",
          targetType: "PaymentProviderEvent",
          targetId: event.id,
          dedupeKey: event.id,
          payload: {},
        });
      } else {
        setImmediate(() => void this.process(event.id));
      }
      this.logger.log(
        `event=point.webhook.accepted metric=point_webhooks_accepted value=1 providerEventId=${input.eventId} providerResourceId=${input.resourceId}`,
      );
      return { accepted: true, duplicate: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        this.logger.log(
          `event=point.webhook.duplicate metric=point_webhooks_duplicate value=1 providerEventId=${input.eventId} providerResourceId=${input.resourceId}`,
        );
        return { accepted: true, duplicate: true };
      }
      throw error;
    }
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    await this.process(job.targetId, true);
    return { processedCount: 1 };
  }

  async enqueueRecoverableEvents(): Promise<void> {
    if (!this.jobs) throw new Error("Background jobs are unavailable");
    let after: string | undefined;
    do {
      const page = await this.prisma.paymentProviderEvent.findMany({
        where: { status: { in: ["PENDING", "FAILED"] } },
        select: { id: true, tenantId: true },
        orderBy: { id: "asc" },
        take: 25,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      });
      for (const event of page) {
        await this.jobs.enqueue({
          tenantId: event.tenantId,
          type: "PAYMENT_WEBHOOK",
          priority: "CRITICAL",
          targetType: "PaymentProviderEvent",
          targetId: event.id,
          dedupeKey: event.id,
          payload: {},
        });
      }
      after = page.length === 25 ? page[page.length - 1]?.id : undefined;
    } while (after);
  }

  async process(eventId: string, rethrow = false) {
    const event = await this.prisma.paymentProviderEvent.findUnique({ where: { id: eventId } });
    if (
      !event ||
      (
        event.status !== PaymentProviderEventStatus.PENDING &&
        event.status !== PaymentProviderEventStatus.FAILED
      )
    ) {
      return;
    }
    await this.prisma.paymentProviderEvent.update({
      where: { id: event.id },
      data: { attempts: { increment: 1 }, lastError: null },
    });
    try {
      const charge = await this.prisma.paymentCharge.findFirst({
        where: {
          institution: PaymentInstitution.MERCADO_PAGO,
          providerOrderId: event.providerResourceId,
        },
        select: { id: true, tenantId: true, connectionId: true },
      });
      if (!charge?.connectionId) {
        this.logger.warn(
          `event=point.webhook.ignored metric=point_webhooks_ignored value=1 providerEventId=${event.providerEventId} providerResourceId=${event.providerResourceId}`,
        );
        await this.finish(event.id, PaymentProviderEventStatus.IGNORED);
        return;
      }
      const order = await this.authenticated.execute({
        tenantId: charge.tenantId,
        integrationId: charge.connectionId,
        request: (token) => this.point.getOrder(token, event.providerResourceId),
      });
      await this.charges.applyProviderOrder(charge.id, order);
      await this.prisma.paymentProviderEvent.update({
        where: { id: event.id },
        data: {
          tenantId: charge.tenantId,
          status: PaymentProviderEventStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
      this.logger.log(
        `event=point.webhook.processed metric=point_webhooks_processed value=1 tenantId=${charge.tenantId} chargeId=${charge.id} providerResourceId=${event.providerResourceId}`,
      );
    } catch (error) {
      await this.prisma.paymentProviderEvent.update({
        where: { id: event.id },
        data: {
          status: PaymentProviderEventStatus.FAILED,
          lastError: "Falha ao consultar ou aplicar a order Mercado Pago",
        },
      });
      this.logger.error(
        `event=point.webhook.failed metric=point_webhooks_failed value=1 providerEventId=${event.providerEventId} providerResourceId=${event.providerResourceId} errorType=${error instanceof Error ? error.name : "UnknownError"}`,
      );
      if (rethrow) throw error;
    }
  }

  private finish(id: string, status: PaymentProviderEventStatus) {
    return this.prisma.paymentProviderEvent.update({
      where: { id },
      data: { status, processedAt: new Date() },
    });
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("PAYMENT_WEBHOOK_DURABLE_JOBS_ENABLED") === "true";
  }
}
