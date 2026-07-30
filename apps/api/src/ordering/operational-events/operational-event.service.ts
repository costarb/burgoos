import { Injectable } from "@nestjs/common";
import {
  OperationalEventSource,
  OperationalEventType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";

export interface RecordOperationalEventInput {
  tenantId: string;
  type: OperationalEventType;
  source: OperationalEventSource;
  actorUserId?: string | null;
  orderId?: string | null;
  serviceTabId?: string | null;
  chargeId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonObject;
  occurredAt?: Date;
}

@Injectable()
export class OperationalEventService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordOperationalEventInput) {
    return this.prisma.orderOperationalEvent.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        source: input.source,
        actorUserId: input.actorUserId ?? null,
        orderId: input.orderId ?? null,
        serviceTabId: input.serviceTabId ?? null,
        chargeId: input.chargeId ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? {},
        occurredAt: input.occurredAt,
      },
    });
  }
}
