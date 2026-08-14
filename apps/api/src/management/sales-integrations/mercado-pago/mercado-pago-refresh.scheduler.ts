import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackgroundJob } from "@prisma/client";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  BackgroundJobRegistry,
  type RuntimeBackgroundJobHandler,
} from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { MercadoPagoRefreshService } from "./mercado-pago-refresh.service";
import { RuntimeRoleService } from "../../../config/runtime-role.service";

@Injectable()
export class MercadoPagoRefreshScheduler implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = "MP_TOKEN_REFRESH" as const;
  readonly policy = { leaseMs: 120_000, retryBaseDelayMs: 30_000, retryMaxDelayMs: 30 * 60_000 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshService: MercadoPagoRefreshService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly backgroundJobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly runtimeRole?: RuntimeRoleService
  ) {}

  onModuleInit(): void {
    if (!this.consumerRoleEnabled()) return;
    if (!this.durableEnabled()) return;
    if (!this.backgroundJobs || !this.registry) {
      throw new Error("Mercado Pago durable refresh requires BackgroundJobsModule");
    }
    this.registry.register(this);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async renewExpiring(): Promise<void> {
    if (!this.consumerRoleEnabled()) return;
    const threshold = new Date(Date.now() + 15 * 86_400_000);
    const batchSize = this.batchSize();
    let cursor: string | undefined;
    do {
      const connections = await this.prisma.salesIntegration.findMany({
        where: {
          provider: "MERCADO_PAGO",
          credentialMode: "OAUTH",
          status: { in: ["ACTIVE", "TOKEN_EXPIRING"] },
          tokenExpiresAt: { lte: threshold },
        },
        select: { id: true, tenantId: true },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const connection of connections) {
        if (this.durableEnabled()) {
          if (!this.backgroundJobs) throw new Error("Background jobs are unavailable");
          await this.backgroundJobs.enqueue({
            tenantId: connection.tenantId,
            type: "MP_TOKEN_REFRESH",
            priority: "HIGH",
            targetType: "SalesIntegration",
            targetId: connection.id,
            dedupeKey: connection.id,
            payload: { integrationId: connection.id },
          });
        } else {
          await this.refreshService.refresh(connection.tenantId, connection.id);
        }
      }
      cursor = connections.length === batchSize ? connections.at(-1)?.id : undefined;
    } while (cursor);
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    if (!job.tenantId) return { processedCount: 0 };
    const processed = await this.refreshService.refresh(job.tenantId, job.targetId);
    return { processedCount: processed ? 1 : 0 };
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("MP_REFRESH_DURABLE_JOBS_ENABLED") === "true";
  }

  private consumerRoleEnabled(): boolean {
    return this.runtimeRole?.consumesBackgroundJobs ?? true;
  }

  private batchSize(): number {
    const value = Number(this.config?.get<string>("MP_DISCOVERY_BATCH_SIZE"));
    return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100) : 25;
  }
}
