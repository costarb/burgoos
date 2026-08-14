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
import { MercadoPagoReconciliationService } from "./mercado-pago-reconciliation.service";
import { RuntimeRoleService } from "../../../config/runtime-role.service";

@Injectable()
export class MercadoPagoReconciliationScheduler
  implements OnModuleInit, RuntimeBackgroundJobHandler
{
  readonly type = "MP_RECONCILIATION" as const;
  readonly policy = {
    leaseMs: 15 * 60_000,
    retryBaseDelayMs: 30_000,
    retryMaxDelayMs: 30 * 60_000,
  };

  constructor(
    private readonly reconciliation: MercadoPagoReconciliationService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly backgroundJobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly runtimeRole?: RuntimeRoleService
  ) {}

  onModuleInit(): void {
    if (!this.consumerRoleEnabled()) return;
    if (!this.durableEnabled()) return;
    if (!this.backgroundJobs || !this.registry || !this.prisma) {
      throw new Error("Mercado Pago durable reconciliation requires BackgroundJobsModule");
    }
    this.registry.register(this);
  }

  @Cron("0 */15 * * * *")
  short() {
    if (!this.consumerRoleEnabled()) return;
    return this.durableEnabled() ? this.enqueueDue(24) : this.reconciliation.reconcile(24);
  }
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  daily() {
    if (!this.consumerRoleEnabled()) return;
    return this.durableEnabled() ? this.enqueueDue(168) : this.reconciliation.reconcile(168);
  }

  async enqueueDue(hours: 24 | 168): Promise<void> {
    if (!this.prisma || !this.backgroundJobs) throw new Error("Background jobs are unavailable");
    let cursor: string | undefined;
    const batchSize = this.batchSize();
    do {
      const connections = await this.prisma.salesIntegration.findMany({
        where: { provider: "MERCADO_PAGO", status: "ACTIVE" },
        select: { id: true, tenantId: true },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const connection of connections) {
        await this.backgroundJobs.enqueue({
          tenantId: connection.tenantId,
          type: "MP_RECONCILIATION",
          priority: "NORMAL",
          targetType: "SalesIntegration",
          targetId: connection.id,
          dedupeKey: connection.id,
          payload: { hours },
        });
      }
      cursor = connections.length === batchSize ? connections.at(-1)?.id : undefined;
    } while (cursor);
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    const hours = (job.payload as { hours?: unknown }).hours === 168 ? 168 : 24;
    const connection = await this.prisma?.salesIntegration.findFirst({
      where: {
        id: job.targetId,
        tenantId: job.tenantId ?? "",
        provider: "MERCADO_PAGO",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!connection || !job.tenantId) return { processedCount: 0 };
    const processed = await this.reconciliation.reconcileConnection(
      job.tenantId,
      job.targetId,
      hours
    );
    return { processedCount: processed ? 1 : 0 };
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("MP_RECONCILIATION_DURABLE_JOBS_ENABLED") === "true";
  }

  private consumerRoleEnabled(): boolean {
    return this.runtimeRole?.consumesBackgroundJobs ?? true;
  }

  private batchSize(): number {
    const value = Number(this.config?.get<string>("MP_DISCOVERY_BATCH_SIZE"));
    return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100) : 25;
  }
}
