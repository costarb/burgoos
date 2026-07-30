import { Injectable, Logger } from "@nestjs/common";
import {
  PaymentInstitution,
  PaymentProviderEventStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { MercadoPagoAuthenticatedRequestService } from "../../management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service";
import { PaymentChargeService } from "../application/payment-charge.service";
import { MercadoPagoPointClient } from "../mercado-pago-point/mercado-pago-point.client";

@Injectable()
export class PaymentProviderEventProcessor {
  private readonly logger = new Logger(PaymentProviderEventProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly authenticated: MercadoPagoAuthenticatedRequestService,
    private readonly point: MercadoPagoPointClient,
    private readonly charges: PaymentChargeService,
  ) {}

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
      setImmediate(() => void this.process(event.id));
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

  async process(eventId: string) {
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
    }
  }

  private finish(id: string, status: PaymentProviderEventStatus) {
    return this.prisma.paymentProviderEvent.update({
      where: { id },
      data: { status, processedAt: new Date() },
    });
  }
}
