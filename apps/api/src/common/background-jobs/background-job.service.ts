import { BadRequestException, Injectable } from "@nestjs/common";
import { BackgroundJob, BackgroundJobPriority, BackgroundJobType, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { BackgroundJobRepository } from "./background-job.repository";

const MAX_PAYLOAD_BYTES = 16 * 1024;
const GLOBAL_JOB_TYPES = new Set<BackgroundJobType>([
  "RETENTION",
  // Webhook receipts can be persisted before their tenant is resolved from the provider resource.
  "PROVIDER_WEBHOOK",
  "PAYMENT_WEBHOOK",
]);

export interface EnqueueBackgroundJobInput {
  tenantId?: string | null;
  type: BackgroundJobType;
  priority?: BackgroundJobPriority;
  targetType: string;
  targetId: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
  maxAttempts?: number;
  availableAt?: Date;
}

@Injectable()
export class BackgroundJobService {
  constructor(private readonly repository: BackgroundJobRepository) {}

  enqueue(input: EnqueueBackgroundJobInput): Promise<BackgroundJob> {
    if (!GLOBAL_JOB_TYPES.has(input.type) && !input.tenantId) {
      throw new BadRequestException(`tenantId is required for ${input.type}`);
    }
    if (!input.targetType.trim() || !input.targetId.trim()) {
      throw new BadRequestException("targetType and targetId are required");
    }
    const payload = input.payload ?? {};
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES) {
      throw new BadRequestException("Background job payload exceeds 16 KiB");
    }
    if (input.maxAttempts !== undefined && (!Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 25)) {
      throw new BadRequestException("maxAttempts must be between 1 and 25");
    }

    return this.repository.enqueue({
      ...input,
      tenantId: input.tenantId ?? null,
      payload: payload as Prisma.InputJsonValue,
      activeKey: input.dedupeKey ? activeKey(input.tenantId ?? null, input.type, input.dedupeKey) : null,
    });
  }
}

function activeKey(tenantId: string | null, type: BackgroundJobType, dedupeKey: string): string {
  const digest = createHash("sha256").update(dedupeKey).digest("hex");
  return `${tenantId ?? "global"}:${type}:${digest}`;
}
