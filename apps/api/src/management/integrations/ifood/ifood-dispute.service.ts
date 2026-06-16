import { BadGatewayException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DeliveryIntegrationAuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { DeliveryIntegrationAuditService } from "../delivery-integration-audit.service";
import { DeliveryIntegrationsService } from "../delivery-integrations.service";
import { IfoodClient } from "./ifood-client";

@Injectable()
export class IfoodDisputeService {
  private readonly logger = new Logger(IfoodDisputeService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DeliveryIntegrationsService)
    private readonly integrationsService: DeliveryIntegrationsService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient,
    @Inject(DeliveryIntegrationAuditService)
    private readonly audit: DeliveryIntegrationAuditService
  ) {}

  async persistFromEvent(input: {
    tenantId: string;
    integrationId: string;
    externalOrderId: string;
    externalDisputeId: string;
    status: string;
    proposal: Prisma.InputJsonValue;
    expiresAt: Date;
  }) {
    const link = await this.prisma.platformOrderLink.findFirst({
      where: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        externalOrderId: input.externalOrderId,
      },
      select: { id: true },
    });

    if (!link) {
      await this.audit.record({
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        action: DeliveryIntegrationAuditAction.DISPUTE_RECEIVED,
        entityType: "PlatformDispute",
        entityId: input.externalDisputeId,
        result: "FAILED",
        metadata: {
          externalOrderId: input.externalOrderId,
          reason: "Pedido interno vinculado nao encontrado",
        },
      });
      return null;
    }

    const dispute = await this.prisma.platformDispute.upsert({
      where: {
        integrationId_externalDisputeId: {
          integrationId: input.integrationId,
          externalDisputeId: input.externalDisputeId,
        },
      },
      update: {
        status: input.status,
        proposal: input.proposal,
        expiresAt: input.expiresAt,
      },
      create: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        platformOrderLinkId: link.id,
        externalDisputeId: input.externalDisputeId,
        status: input.status,
        proposal: input.proposal,
        expiresAt: input.expiresAt,
      },
    });

    await this.audit.record({
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      action: DeliveryIntegrationAuditAction.DISPUTE_RECEIVED,
      entityType: "PlatformDispute",
      entityId: dispute.id,
      result: "SUCCESS",
      metadata: {
        externalOrderId: input.externalOrderId,
        externalDisputeId: input.externalDisputeId,
        status: input.status,
      },
    });
    this.logger.log(
      `ifood.dispute.received tenantId=${input.tenantId} integrationId=${input.integrationId} disputeId=${dispute.id} status=${input.status}`
    );

    return dispute;
  }

  async respond(input: {
    tenantId: string;
    actorUserId: string;
    integrationId: string;
    disputeId: string;
    accepted: boolean;
    reason?: string | null;
  }) {
    const dispute = await this.prisma.platformDispute.findFirst({
      where: {
        id: input.disputeId,
        tenantId: input.tenantId,
        integrationId: input.integrationId,
      },
      include: { platformOrderLink: true },
    });

    if (!dispute) {
      throw new NotFoundException("Disputa nao encontrada");
    }

    const attempt = await this.prisma.platformSyncAttempt.create({
      data: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        platformOrderLinkId: dispute.platformOrderLinkId,
        action: "RESPOND_DISPUTE",
        status: "PENDING",
        requestPayload: {
          externalDisputeId: dispute.externalDisputeId,
          accepted: input.accepted,
          reason: input.reason ?? null,
        },
        createdByUserId: input.actorUserId,
      },
    });

    try {
      const secret = await this.integrationsService.getActiveCredentialSecret(
        input.tenantId,
        input.integrationId
      );
      await this.ifoodClient.respondDispute({
        accessToken: secret.accessToken,
        disputeId: dispute.externalDisputeId,
        accepted: input.accepted,
        reason: input.reason,
      });

      const response = {
        accepted: input.accepted,
        reason: input.reason ?? null,
      } as Prisma.InputJsonObject;

      await this.prisma.platformSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "CONFIRMED",
          responsePayload: response,
          sentAt: new Date(),
          confirmedAt: new Date(),
        },
      });
      await this.prisma.platformDispute.update({
        where: { id: dispute.id },
        data: {
          status: input.accepted ? "ACCEPTED" : "REJECTED",
          response,
          respondedAt: new Date(),
        },
      });
      await this.audit.record({
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        actorUserId: input.actorUserId,
        action: DeliveryIntegrationAuditAction.SYNC_ATTEMPTED,
        entityType: "PlatformDispute",
        entityId: dispute.id,
        result: "SUCCESS",
        metadata: { externalDisputeId: dispute.externalDisputeId },
      });
      this.logger.log(
        `ifood.dispute.respond tenantId=${input.tenantId} integrationId=${input.integrationId} disputeId=${dispute.id} status=CONFIRMED`
      );
    } catch (error) {
      await this.prisma.platformSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "RETRYABLE",
          errorCode: "IFOOD_DISPUTE_RESPONSE_FAILED",
          errorMessage: error instanceof Error ? error.message : "Falha desconhecida",
          nextRetryAt: new Date(Date.now() + 60_000),
        },
      });
      await this.audit.record({
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        actorUserId: input.actorUserId,
        action: DeliveryIntegrationAuditAction.SYNC_FAILED,
        entityType: "PlatformDispute",
        entityId: dispute.id,
        result: "FAILED",
        metadata: { externalDisputeId: dispute.externalDisputeId },
      });
      this.logger.warn(
        `ifood.dispute.respond tenantId=${input.tenantId} integrationId=${input.integrationId} disputeId=${dispute.id} status=RETRYABLE`
      );
      throw new BadGatewayException("Nao foi possivel responder a disputa no iFood");
    }
  }
}
