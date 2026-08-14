import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackgroundJob } from "@prisma/client";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BackgroundJobRegistry } from "../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../common/background-jobs/background-job.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { RuntimeRoleService } from "../../config/runtime-role.service";

interface RetentionBatchResult {
  deleted: number;
  hasMore: boolean;
}

@Injectable()
export class SalesImportRetentionService implements OnModuleInit {
  private readonly batchSize: number;
  private readonly deadlineMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly jobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly runtimeRole?: RuntimeRoleService
  ) {
    this.batchSize = this.config?.get<number>("RETENTION_BATCH_SIZE") ?? 250;
    this.deadlineMs = this.config?.get<number>("RETENTION_DEADLINE_MS") ?? 5_000;
  }

  onModuleInit(): void {
    if (!this.consumerRoleEnabled()) return;
    if (!this.durableEnabled()) return;
    if (!this.jobs || !this.registry)
      throw new Error("Durable retention requires BackgroundJobsModule");
    this.registry.register({
      type: "RETENTION",
      policy: { leaseMs: 120_000, retryBaseDelayMs: 30_000, retryMaxDelayMs: 900_000 },
      execute: (job) => this.execute(job),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async schedule(now = new Date()): Promise<number> {
    if (!this.consumerRoleEnabled()) return 0;
    if (!this.durableEnabled()) return this.purgeExpired(now);
    await this.enqueue(`scheduled:${now.toISOString().slice(0, 10)}`);
    return 0;
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    const result = await this.runUntilDeadline(new Date());
    if (result.hasMore) await this.enqueue(`continuation:${job.id}`);
    return { processedCount: result.deleted };
  }

  async purgeExpired(now = new Date()): Promise<number> {
    return (await this.runUntilDeadline(now)).deleted;
  }

  private async runUntilDeadline(now: Date): Promise<RetentionBatchResult> {
    const deadline = Date.now() + this.deadlineMs;
    let deleted = 0;
    let hasMore = false;
    do {
      const batch = await this.purgeBatch(now);
      deleted += batch.deleted;
      hasMore = batch.hasMore;
      if (!hasMore) break;
    } while (Date.now() < deadline);
    return { deleted, hasMore };
  }

  private async purgeBatch(now: Date): Promise<RetentionBatchResult> {
    const historicalCutoff = new Date(now.getTime() - 180 * 86_400_000);
    const oauthCutoff = new Date(now.getTime() - 24 * 60 * 60_000);
    const notificationCutoff = new Date(now.getTime() - 90 * 86_400_000);
    const runIds = await this.prisma.salesImportRun.findMany({
      where: {
        createdAt: { lt: historicalCutoff },
        status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "CANCELLED"] },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: this.batchSize,
    });
    const attemptIds = await this.prisma.oAuthAuthorizationAttempt.findMany({
      where: {
        expiresAt: { lt: oauthCutoff },
        status: { in: ["COMPLETED", "EXPIRED", "FAILED"] },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: this.batchSize,
    });
    const notificationIds = await this.prisma.providerNotification.findMany({
      where: {
        receivedAt: { lt: notificationCutoff },
        status: { in: ["PROCESSED", "IGNORED"] },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: this.batchSize,
    });

    const [runs, attempts, notifications] = await Promise.all([
      this.deleteIds(this.prisma.salesImportRun, runIds),
      this.deleteIds(this.prisma.oAuthAuthorizationAttempt, attemptIds),
      this.deleteIds(this.prisma.providerNotification, notificationIds),
    ]);
    return {
      deleted: runs + attempts + notifications,
      hasMore:
        runIds.length === this.batchSize ||
        attemptIds.length === this.batchSize ||
        notificationIds.length === this.batchSize,
    };
  }

  private async deleteIds(
    delegate: {
      deleteMany(input: { where: { id: { in: string[] } } }): Promise<{ count: number }>;
    },
    records: Array<{ id: string }>
  ): Promise<number> {
    if (records.length === 0) return 0;
    return (await delegate.deleteMany({ where: { id: { in: records.map(({ id }) => id) } } }))
      .count;
  }

  private async enqueue(dedupeKey: string): Promise<void> {
    if (!this.jobs) throw new Error("Background jobs are unavailable");
    await this.jobs.enqueue({
      type: "RETENTION",
      priority: "LOW",
      targetType: "SalesIntegrationRetention",
      targetId: "global",
      dedupeKey,
      payload: {},
    });
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("RETENTION_DURABLE_JOBS_ENABLED") === "true";
  }

  private consumerRoleEnabled(): boolean {
    return this.runtimeRole?.consumesBackgroundJobs ?? true;
  }
}
