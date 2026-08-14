import { Injectable } from "@nestjs/common";
import type { BackgroundJob, BackgroundJobType } from "@prisma/client";

import { RuntimeRoleService } from "../../config/runtime-role.service";

export interface RuntimeBackgroundJobHandler {
  readonly type: BackgroundJobType;
  readonly policy?: {
    leaseMs?: number;
    retryBaseDelayMs?: number;
    retryMaxDelayMs?: number;
    retryJitterRatio?: number;
  };
  execute(job: BackgroundJob, signal: AbortSignal): Promise<{ processedCount?: number }>;
}

@Injectable()
export class BackgroundJobRegistry {
  private readonly handlers = new Map<BackgroundJobType, RuntimeBackgroundJobHandler>();

  constructor(private readonly runtimeRole: RuntimeRoleService) {}

  get consumerEnabled(): boolean {
    return this.runtimeRole.consumesBackgroundJobs;
  }

  register(handler: RuntimeBackgroundJobHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Duplicate background job handler: ${handler.type}`);
    }
    this.handlers.set(handler.type, handler);
  }

  resolve(type: BackgroundJobType): RuntimeBackgroundJobHandler {
    const handler = this.handlers.get(type);
    if (!handler) throw new Error(`No background job handler registered for ${type}`);
    return handler;
  }

  listTypes(): BackgroundJobType[] {
    return [...this.handlers.keys()];
  }
}
