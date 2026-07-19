import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../security/integration-secret.service";

@Injectable()
export class IntegrationAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService
  ) {}

  async record(input: {
    tenantId: string;
    integrationId: string;
    actorUserId?: string | null;
    action: string;
    outcome: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const safeMetadata = this.secrets.redact(
      allowlisted(input.metadata ?? {})
    ) as Prisma.InputJsonValue;
    await this.prisma.integrationAuditEvent.create({
      data: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        actorUserId: input.actorUserId,
        action: input.action,
        outcome: input.outcome,
        metadata: safeMetadata,
      },
    });
  }
}

const AUDIT_METADATA_KEYS = new Set([
  "providerUserId",
  "initialLoadDays",
  "expiresAt",
  "hours",
  "resources",
  "resourceType",
  "resourceId",
  "runId",
  "trigger",
  "outcomeCode",
]);
function allowlisted(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => AUDIT_METADATA_KEYS.has(key))
  );
}
