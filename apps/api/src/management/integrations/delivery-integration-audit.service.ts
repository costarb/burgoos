import { Inject, Injectable } from "@nestjs/common";
import { DeliveryIntegrationAuditAction } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { redactIntegrationPayload } from "./integration-secret.util";

@Injectable()
export class DeliveryIntegrationAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: {
    tenantId: string;
    integrationId?: string | null;
    actorUserId?: string | null;
    action: DeliveryIntegrationAuditAction;
    entityType: string;
    entityId?: string | null;
    result: string;
    metadata?: unknown;
  }) {
    return this.prisma.deliveryIntegrationAudit.create({
      data: {
        tenantId: input.tenantId,
        integrationId: input.integrationId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        result: input.result,
        metadata: input.metadata ? redactIntegrationPayload(input.metadata) : undefined,
      },
    });
  }
}
