import { Inject, Injectable } from "@nestjs/common";
import { FinancialAuditAction, Prisma } from "@prisma/client";
import { currentActionOrigin } from "../../common/observability/action-origin";
import { PrismaService } from "../../platform/database/prisma.service";

interface FinancialAuditInput {
  tenantId: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: FinancialAuditAction;
  beforeSnapshot?: Prisma.InputJsonValue | null;
  afterSnapshot?: Prisma.InputJsonValue | null;
}

@Injectable()
export class FinancialAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: FinancialAuditInput, tx: Prisma.TransactionClient = this.prisma) {
    const channel = currentActionOrigin();
    return tx.financialAudit.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        beforeSnapshot: input.beforeSnapshot ?? Prisma.JsonNull,
        afterSnapshot: input.afterSnapshot ?? Prisma.JsonNull,
        ...(channel ? { channel } : {}),
      },
    });
  }
}
