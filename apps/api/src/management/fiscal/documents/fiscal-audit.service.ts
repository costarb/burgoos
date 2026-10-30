import { Inject, Injectable, Logger } from "@nestjs/common";
import { FiscalDocumentEventType, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";

const SENSITIVE_KEY = /token|secret|password|authorization|pfx|xml|cpf|consumer|document(?!Id)/i;

export interface FiscalEventInput {
  tenantId: string;
  documentId: string;
  type: FiscalDocumentEventType;
  actorUserId?: string | null;
  providerStatus?: string | null;
  code?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export type FiscalLogLevel = "log" | "warn" | "error";

/**
 * Persists the document timeline and writes one-line JSON logs with stable event names
 * (`fiscal.*`), the contract for monitoring alerts.
 */
@Injectable()
export class FiscalAuditService {
  private readonly logger = new Logger("Fiscal");

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async event(input: FiscalEventInput, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.fiscalDocumentEvent.create({
      data: {
        tenantId: input.tenantId,
        documentId: input.documentId,
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        providerStatus: input.providerStatus ?? null,
        code: input.code?.slice(0, 40) ?? null,
        message: input.message?.slice(0, 500) ?? null,
        metadata: sanitize(input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  log(event: string, fields: Record<string, unknown>, level: FiscalLogLevel = "log"): void {
    this.logger[level](JSON.stringify({ event, ...(sanitize(fields) as Record<string, unknown>) }));
  }
}

export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "********" : sanitize(item)])
  );
}
