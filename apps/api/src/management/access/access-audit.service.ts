import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { AccessAuditResult, AccessAuditEventType, Prisma } from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { AccessAuditQueryDto } from "./dto/access-audit.dto";

interface RecordAccessAuditInput {
  actorUserId?: string | null;
  targetUserId?: string | null;
  storeId?: string | null;
  eventType: AccessAuditEventType;
  result: AccessAuditResult;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

@Injectable()
export class AccessAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: RecordAccessAuditInput, tx: Prisma.TransactionClient = this.prisma) {
    return tx.accessAuditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        targetUserId: input.targetUserId ?? null,
        storeId: input.storeId ?? null,
        eventType: input.eventType,
        result: input.result,
        reason: input.reason ?? null,
        metadata: input.metadata == null ? undefined : this.redactMetadata(input.metadata),
      },
    });
  }

  async query(actor: AuthUser, query: AccessAuditQueryDto = {}) {
    const where: Prisma.AccessAuditEventWhereInput = {
      eventType: query.eventType as AccessAuditEventType | undefined,
      targetUserId: query.targetUserId,
      storeId: query.storeId,
      occurredAt:
        query.start || query.end
          ? {
              gte: query.start ? new Date(query.start) : undefined,
              lte: query.end ? new Date(query.end) : undefined,
            }
          : undefined,
    };

    if (!actor.isMaster && !actor.isPlatformAdmin) {
      const manageableStoreIds = actor.manageableStoreIds ?? [];

      if (query.storeId && !manageableStoreIds.includes(query.storeId)) {
        throw new ForbiddenException("Auditoria fora do escopo autorizado");
      }

      where.storeId = { in: manageableStoreIds };
    }

    const events = await this.prisma.accessAuditEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 200,
    });

    return events.map((event) => ({
      ...event,
      metadata: this.redactMetadataForRead(event.metadata),
    }));
  }

  private redactMetadata(metadata: Prisma.InputJsonValue): Prisma.InputJsonValue {
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      return metadata;
    }

    const redacted: Record<string, unknown> = {};
    const source = metadata as Record<string, unknown>;

    for (const [key, value] of Object.entries(source)) {
      redacted[key] = /password|token|secret|hash/i.test(key) ? "[REDACTED]" : (value ?? null);
    }

    return redacted as Prisma.InputJsonValue;
  }

  private redactMetadataForRead(metadata: Prisma.JsonValue): Prisma.JsonValue {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return metadata;
    }

    const redacted: Record<string, Prisma.JsonValue> = {};

    for (const [key, value] of Object.entries(metadata)) {
      redacted[key] = /password|token|secret|hash/i.test(key) ? "[REDACTED]" : (value ?? null);
    }

    return redacted;
  }
}
