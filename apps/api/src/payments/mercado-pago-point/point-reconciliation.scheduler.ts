import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackgroundJob } from "@prisma/client";
import { Cron } from "@nestjs/schedule";
import {
  BackgroundJobRegistry,
  type RuntimeBackgroundJobHandler,
} from "../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../common/background-jobs/background-job.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { PointReconciliationService } from "./point-reconciliation.service";
import { RuntimeRoleService } from "../../config/runtime-role.service";

@Injectable()
export class PointReconciliationScheduler implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = "POINT_RECONCILIATION" as const;
  readonly policy = { leaseMs: 120_000, retryBaseDelayMs: 10_000, retryMaxDelayMs: 10 * 60_000 };
  private running = false;

  constructor(
    private readonly reconciliation: PointReconciliationService,
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
      throw new Error("Point durable reconciliation requires BackgroundJobsModule");
    }
    this.registry.register(this);
  }

  @Cron("*/2 * * * *")
  async run() {
    if (!this.consumerRoleEnabled()) return;
    if (this.running) return;
    this.running = true;
    try {
      if (this.durableEnabled()) {
        await this.enqueueStaleCharges();
      } else {
        await this.reconciliation.reconcilePending(25);
      }
    } finally {
      this.running = false;
    }
  }

  async enqueueStaleCharges(): Promise<void> {
    if (!this.backgroundJobs) throw new Error("Background jobs are unavailable");
    const charges = await this.reconciliation.findStaleCharges(25);
    for (const charge of charges) {
      await this.backgroundJobs.enqueue({
        tenantId: charge.tenantId,
        type: "POINT_RECONCILIATION",
        priority: "HIGH",
        targetType: "PaymentCharge",
        targetId: charge.id,
        dedupeKey: charge.id,
        payload: { chargeId: charge.id },
      });
    }
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    if (!job.tenantId || !this.prisma) return { processedCount: 0 };
    const charge = await this.prisma.paymentCharge.findFirst({
      where: {
        id: job.targetId,
        tenantId: job.tenantId,
        institution: "MERCADO_PAGO",
        status: { in: ["CREATED", "WAITING_CUSTOMER", "PROCESSING", "UNKNOWN"] },
      },
      select: { id: true, tenantId: true, connectionId: true, providerOrderId: true },
    });
    if (!charge) return { processedCount: 0 };
    const result = await this.reconciliation.reconcileCharge(charge);
    return { processedCount: result.reconciled ? 1 : 0 };
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("POINT_RECONCILIATION_DURABLE_JOBS_ENABLED") === "true";
  }

  private consumerRoleEnabled(): boolean {
    return this.runtimeRole?.consumesBackgroundJobs ?? true;
  }
}
