import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackgroundJob, Prisma } from "@prisma/client";
import { Cron, CronExpression } from "@nestjs/schedule";

import { BackgroundJobRegistry } from "../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../common/background-jobs/background-job.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { RuntimeRoleService } from "../../config/runtime-role.service";

interface RetentionBatchResult {
  deleted: number;
  redacted: number;
  hasMore: boolean;
}

/**
 * Marks a raw provider payload as redacted without touching the canonical amounts,
 * statuses or payment/installment rows derived from it at persistence time.
 */
const REDACTED_RAW_PAYLOAD = (now: Date): Prisma.InputJsonObject => ({
  redacted: true,
  redactedAt: now.toISOString(),
});
const NOT_YET_REDACTED: Prisma.JsonFilter = { path: ["redacted"], equals: true };

@Injectable()
export class SalesImportRetentionService implements OnModuleInit {
  private readonly batchSize: number;
  private readonly deadlineMs: number;
  private readonly ifoodRawPayloadRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly jobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly runtimeRole?: RuntimeRoleService
  ) {
    this.batchSize = this.config?.get<number>("RETENTION_BATCH_SIZE") ?? 250;
    this.deadlineMs = this.config?.get<number>("RETENTION_DEADLINE_MS") ?? 5_000;
    this.ifoodRawPayloadRetentionDays =
      this.config?.get<number>("IFOOD_FINANCIAL_RAW_PAYLOAD_RETENTION_DAYS") ?? 180;
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
    return { processedCount: result.deleted + result.redacted };
  }

  async purgeExpired(now = new Date()): Promise<number> {
    return (await this.runUntilDeadline(now)).deleted;
  }

  private async runUntilDeadline(now: Date): Promise<RetentionBatchResult> {
    const deadline = Date.now() + this.deadlineMs;
    let deleted = 0;
    let redacted = 0;
    let hasMore = false;
    do {
      const batch = await this.purgeBatch(now);
      deleted += batch.deleted;
      redacted += batch.redacted;
      hasMore = batch.hasMore;
      if (!hasMore) break;
    } while (Date.now() < deadline);
    return { deleted, redacted, hasMore };
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
    const ifoodCutoff = new Date(now.getTime() - this.ifoodRawPayloadRetentionDays * 86_400_000);
    const ifoodSaleIds = await this.prisma.externalFinancialSale.findMany({
      where: {
        provider: "IFOOD",
        occurredAt: { lt: ifoodCutoff },
        NOT: { rawPayload: NOT_YET_REDACTED },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: this.batchSize,
    });
    const ifoodEventIds = await this.prisma.externalFinancialEvent.findMany({
      where: {
        integration: { provider: "IFOOD" },
        occurredAt: { lt: ifoodCutoff },
        NOT: { rawPayload: NOT_YET_REDACTED },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: this.batchSize,
    });
    const ifoodSettlementIds = await this.prisma.externalSettlement.findMany({
      where: {
        integration: { provider: "IFOOD" },
        lastSyncedAt: { lt: ifoodCutoff },
        NOT: { rawPayload: NOT_YET_REDACTED },
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
    const [redactedSales, redactedEvents, redactedSettlements] = await Promise.all([
      this.redactRawPayloads(this.prisma.externalFinancialSale, ifoodSaleIds, now),
      this.redactRawPayloads(this.prisma.externalFinancialEvent, ifoodEventIds, now),
      this.redactRawPayloads(this.prisma.externalSettlement, ifoodSettlementIds, now),
    ]);
    return {
      deleted: runs + attempts + notifications,
      redacted: redactedSales + redactedEvents + redactedSettlements,
      hasMore:
        runIds.length === this.batchSize ||
        attemptIds.length === this.batchSize ||
        notificationIds.length === this.batchSize ||
        ifoodSaleIds.length === this.batchSize ||
        ifoodEventIds.length === this.batchSize ||
        ifoodSettlementIds.length === this.batchSize,
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

  /**
   * Overwrites `rawPayload` with a redaction marker for the given ids without touching any
   * other column, so canonical amounts, statuses, payments and installments stay intact.
   */
  private async redactRawPayloads(
    delegate: {
      updateMany(input: {
        where: { id: { in: string[] } };
        data: { rawPayload: Prisma.InputJsonObject };
      }): Promise<{ count: number }>;
    },
    records: Array<{ id: string }>,
    now: Date
  ): Promise<number> {
    if (records.length === 0) return 0;
    return (
      await delegate.updateMany({
        where: { id: { in: records.map(({ id }) => id) } },
        data: { rawPayload: REDACTED_RAW_PAYLOAD(now) },
      })
    ).count;
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
