import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  DeliveryIntegrationAuditAction,
  DeliveryPlatformOrderAction,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { DeliveryIntegrationAuditService } from "../delivery-integration-audit.service";
import { DeliveryIntegrationsService } from "../delivery-integrations.service";
import { IfoodClient } from "./ifood-client";

@Injectable()
export class IfoodStatusSyncService {
  private readonly logger = new Logger(IfoodStatusSyncService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient,
    @Inject(DeliveryIntegrationAuditService)
    private readonly audit: DeliveryIntegrationAuditService
  ) {}

  async syncCancellationReasons(tenantId: string, orderId: string) {
    const link = await this.getPendingIfoodLink(tenantId, orderId, false);
    const secret = await this.integrationsService.getActiveCredentialSecret(
      tenantId,
      link.integrationId
    );
    const reasons = await this.ifoodClient.listCancellationReasons({
      accessToken: secret.accessToken,
      orderId: link.externalOrderId,
    });

    for (const reason of reasons) {
      await this.prisma.platformCancellationReason.upsert({
        where: {
          integrationId_providerReasonId: {
            integrationId: link.integrationId,
            providerReasonId: reason.id,
          },
        },
        update: {
          description: reason.description,
          active: true,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId,
          integrationId: link.integrationId,
          providerReasonId: reason.id,
          description: reason.description,
          applicableActions: ["REFUSE", "REQUEST_CANCELLATION"] as Prisma.InputJsonValue,
        },
      });
    }

    return reasons;
  }

  async confirmOrder(tenantId: string, actorUserId: string, orderId: string) {
    const link = await this.getPendingIfoodLink(tenantId, orderId, true);
    const attempt = await this.createAttempt({
      tenantId,
      actorUserId,
      linkId: link.id,
      integrationId: link.integrationId,
      action: "CONFIRM",
      payload: {
        externalOrderId: link.externalOrderId,
        deadline: link.confirmationDeadlineAt?.toISOString() ?? null,
      },
    });

    try {
      const secret = await this.integrationsService.getActiveCredentialSecret(
        tenantId,
        link.integrationId
      );
      await this.ifoodClient.confirmOrder({
        accessToken: secret.accessToken,
        orderId: link.externalOrderId,
      });
      await this.markAttemptConfirmed(attempt.id, { externalStatus: "CONFIRMED" });
      await this.prisma.platformOrderLink.update({
        where: { id: link.id },
        data: {
          externalStatus: "CONFIRMED",
          internalStatusAtLastSync: OrderStatus.PREPARING,
          lastProviderUpdateAt: new Date(),
        },
      });
      await this.recordSyncAudit(tenantId, link.integrationId, actorUserId, link.id, "SUCCESS");
      this.logger.log(
        `ifood.sync.confirm tenantId=${tenantId} integrationId=${link.integrationId} orderId=${orderId} status=CONFIRMED`
      );
    } catch (error) {
      await this.markAttemptRetryable(attempt.id, error);
      await this.recordSyncAudit(tenantId, link.integrationId, actorUserId, link.id, "FAILED");
      this.logger.warn(
        `ifood.sync.confirm tenantId=${tenantId} integrationId=${link.integrationId} orderId=${orderId} status=RETRYABLE`
      );
      throw new BadGatewayException("Nao foi possivel confirmar o pedido no iFood");
    }
  }

  async refuseOrder(input: {
    tenantId: string;
    actorUserId: string;
    orderId: string;
    providerReasonId: string;
    reason?: string;
  }) {
    const link = await this.getPendingIfoodLink(input.tenantId, input.orderId, false);
    const reason = await this.resolveCancellationReason(
      input.tenantId,
      link.integrationId,
      input.providerReasonId,
      input.reason
    );
    const attempt = await this.createAttempt({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      linkId: link.id,
      integrationId: link.integrationId,
      action: "REFUSE",
      payload: {
        externalOrderId: link.externalOrderId,
        providerReasonId: input.providerReasonId,
        reason,
      },
    });

    try {
      const secret = await this.integrationsService.getActiveCredentialSecret(
        input.tenantId,
        link.integrationId
      );
      await this.ifoodClient.requestCancellation({
        accessToken: secret.accessToken,
        orderId: link.externalOrderId,
        reasonCode: input.providerReasonId,
        reason,
      });
      await this.markAttemptConfirmed(attempt.id, { externalStatus: "CANCELLATION_REQUESTED" });
      await this.prisma.platformOrderLink.update({
        where: { id: link.id },
        data: {
          externalStatus: "CANCELLATION_REQUESTED",
          internalStatusAtLastSync: OrderStatus.CANCELLED,
          lastProviderUpdateAt: new Date(),
        },
      });
      await this.recordSyncAudit(
        input.tenantId,
        link.integrationId,
        input.actorUserId,
        link.id,
        "SUCCESS"
      );
      this.logger.log(
        `ifood.sync.refuse tenantId=${input.tenantId} integrationId=${link.integrationId} orderId=${input.orderId} status=CONFIRMED`
      );
    } catch (error) {
      await this.markAttemptRetryable(attempt.id, error);
      await this.recordSyncAudit(
        input.tenantId,
        link.integrationId,
        input.actorUserId,
        link.id,
        "FAILED"
      );
      this.logger.warn(
        `ifood.sync.refuse tenantId=${input.tenantId} integrationId=${link.integrationId} orderId=${input.orderId} status=RETRYABLE`
      );
      throw new BadGatewayException("Nao foi possivel recusar o pedido no iFood");
    }
  }

  async syncInternalStatus(input: {
    tenantId: string;
    actorUserId?: string | null;
    link: {
      id: string;
      integrationId: string;
      externalOrderId: string;
      mode: string;
      internalStatusAtLastSync: string | null;
    };
    status: OrderStatus;
  }) {
    if (input.link.internalStatusAtLastSync === input.status) {
      return;
    }

    const action = this.mapInternalStatusToAction(input.status, input.link.mode);

    if (!action) {
      return;
    }

    const attempt = await this.createAttempt({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      linkId: input.link.id,
      integrationId: input.link.integrationId,
      action,
      payload: {
        externalOrderId: input.link.externalOrderId,
        internalStatus: input.status,
        mode: input.link.mode,
      },
    });

    try {
      const secret = await this.integrationsService.getActiveCredentialSecret(
        input.tenantId,
        input.link.integrationId
      );
      await this.callStatusAction(action, secret.accessToken, input.link.externalOrderId);
      await this.markAttemptConfirmed(attempt.id, {
        internalStatus: input.status,
        action,
      });
      await this.prisma.platformOrderLink.update({
        where: { id: input.link.id },
        data: {
          externalStatus: action,
          internalStatusAtLastSync: input.status,
          lastProviderUpdateAt: new Date(),
        },
      });
      await this.recordSyncAudit(
        input.tenantId,
        input.link.integrationId,
        input.actorUserId ?? null,
        input.link.id,
        "SUCCESS"
      );
      this.logger.log(
        `ifood.sync.status tenantId=${input.tenantId} integrationId=${input.link.integrationId} linkId=${input.link.id} action=${action} status=CONFIRMED`
      );
    } catch (error) {
      await this.markAttemptRetryable(attempt.id, error);
      await this.recordSyncAudit(
        input.tenantId,
        input.link.integrationId,
        input.actorUserId ?? null,
        input.link.id,
        "FAILED"
      );
      this.logger.warn(
        `ifood.sync.status tenantId=${input.tenantId} integrationId=${input.link.integrationId} linkId=${input.link.id} action=${action} status=RETRYABLE`
      );
    }
  }

  listSyncAttempts(tenantId: string, orderId: string) {
    return this.prisma.platformSyncAttempt.findMany({
      where: {
        tenantId,
        platformOrderLink: {
          orderId,
          tenantId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        status: true,
        errorCode: true,
        errorMessage: true,
        nextRetryAt: true,
        sentAt: true,
        confirmedAt: true,
        createdAt: true,
      },
    });
  }

  private async getPendingIfoodLink(tenantId: string, orderId: string, requireDeadline: boolean) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      select: {
        id: true,
        status: true,
        platformOrderLink: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (!order.platformOrderLink || order.platformOrderLink.provider !== "IFOOD") {
      throw new ConflictException("Pedido nao possui vinculo iFood");
    }

    if (order.status !== "PENDING") {
      throw new ConflictException("Pedido iFood ja saiu da etapa de aceite");
    }

    if (
      requireDeadline &&
      order.platformOrderLink.confirmationDeadlineAt &&
      order.platformOrderLink.confirmationDeadlineAt.getTime() < Date.now()
    ) {
      throw new ConflictException("Prazo de confirmacao iFood expirado");
    }

    return order.platformOrderLink;
  }

  private async resolveCancellationReason(
    tenantId: string,
    integrationId: string,
    providerReasonId: string,
    fallback?: string
  ) {
    const cached = await this.prisma.platformCancellationReason.findFirst({
      where: {
        tenantId,
        integrationId,
        providerReasonId,
        active: true,
      },
      select: { description: true },
    });

    return fallback?.trim() || cached?.description || "Pedido recusado pela loja";
  }

  private createAttempt(input: {
    tenantId: string;
    integrationId: string;
    linkId: string;
    actorUserId: string | null;
    action: DeliveryPlatformOrderAction;
    payload: Prisma.InputJsonValue;
  }) {
    return this.prisma.platformSyncAttempt.create({
      data: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        platformOrderLinkId: input.linkId,
        action: input.action,
        status: "PENDING",
        requestPayload: input.payload,
        createdByUserId: input.actorUserId,
      },
    });
  }

  private markAttemptConfirmed(id: string, responsePayload: Prisma.InputJsonValue) {
    return this.prisma.platformSyncAttempt.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        responsePayload,
        sentAt: new Date(),
        confirmedAt: new Date(),
      },
    });
  }

  private markAttemptRetryable(id: string, error: unknown) {
    return this.prisma.platformSyncAttempt.update({
      where: { id },
      data: {
        status: "RETRYABLE",
        errorCode: "IFOOD_SYNC_FAILED",
        errorMessage: error instanceof Error ? error.message : "Falha desconhecida",
        nextRetryAt: new Date(Date.now() + 60_000),
      },
    });
  }

  private recordSyncAudit(
    tenantId: string,
    integrationId: string,
    actorUserId: string | null,
    linkId: string,
    result: string
  ) {
    return this.audit.record({
      tenantId,
      integrationId,
      actorUserId,
      action:
        result === "SUCCESS"
          ? DeliveryIntegrationAuditAction.SYNC_ATTEMPTED
          : DeliveryIntegrationAuditAction.SYNC_FAILED,
      entityType: "PlatformOrderLink",
      entityId: linkId,
      result,
    });
  }

  private mapInternalStatusToAction(
    status: OrderStatus,
    mode: string
  ): DeliveryPlatformOrderAction | null {
    if (status === OrderStatus.SHIPPED) {
      return mode === "TAKEOUT" ? "READY_TO_PICKUP" : "DISPATCH";
    }

    if (status === OrderStatus.DELIVERED) {
      return "DELIVER";
    }

    if (status === OrderStatus.CANCELLED) {
      return "REQUEST_CANCELLATION";
    }

    return null;
  }

  private async callStatusAction(
    action: DeliveryPlatformOrderAction,
    accessToken: string,
    orderId: string
  ) {
    if (action === "DISPATCH") {
      await this.ifoodClient.dispatchOrder({ accessToken, orderId });
      return;
    }

    if (action === "READY_TO_PICKUP") {
      await this.ifoodClient.markReadyToPickup({ accessToken, orderId });
      return;
    }

    if (action === "DELIVER") {
      await this.ifoodClient.markDelivered({ accessToken, orderId });
      return;
    }

    if (action === "REQUEST_CANCELLATION") {
      await this.ifoodClient.requestCancellation({
        accessToken,
        orderId,
        reasonCode: "501",
        reason: "Pedido cancelado no fluxo operacional",
      });
    }
  }
}
