import { Injectable } from "@nestjs/common";
import { AccessAuditResult, AccessAuditEventType, Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

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

  private redactMetadata(metadata: Prisma.InputJsonValue): Prisma.InputJsonValue {
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      return metadata;
    }

    const redacted: Record<string, unknown> = {};
    const source = metadata as Record<string, unknown>;

    for (const [key, value] of Object.entries(source)) {
      redacted[key] = /password|token|secret|hash/i.test(key) ? "[REDACTED]" : value;
    }

    return redacted as Prisma.InputJsonValue;
  }
}
