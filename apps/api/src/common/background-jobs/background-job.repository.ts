import { Injectable } from "@nestjs/common";
import { BackgroundJob, BackgroundJobPriority, BackgroundJobType, Prisma } from "@prisma/client";

import { PrismaService } from "../../platform/database/prisma.service";
import type { ResourceSnapshot } from "../observability/resource-operation.service";
import { redactResourceMessage } from "../observability/resource-redaction";

export interface EnqueueJobInput {
  tenantId?: string | null;
  type: BackgroundJobType;
  priority?: BackgroundJobPriority;
  targetType: string;
  targetId: string;
  activeKey?: string | null;
  payload?: Prisma.InputJsonValue;
  maxAttempts?: number;
  availableAt?: Date;
}

export interface JobLeaseOwner {
  workerId: string;
  leaseVersion: number;
}

export interface JobAttemptTelemetry {
  memoryStart: ResourceSnapshot;
  memoryEnd: ResourceSnapshot;
  durationMs: number;
  processedCount?: number;
}

@Injectable()
export class BackgroundJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueJobInput): Promise<BackgroundJob> {
    try {
      return await this.prisma.backgroundJob.create({
        data: {
          tenantId: input.tenantId,
          type: input.type,
          priority: input.priority,
          targetType: input.targetType,
          targetId: input.targetId,
          activeKey: input.activeKey,
          payload: input.payload ?? {},
          maxAttempts: input.maxAttempts,
          availableAt: input.availableAt,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error) || !input.activeKey) throw error;
      const existing = await this.prisma.backgroundJob.findFirst({
        where: {
          activeKey: input.activeKey,
          status: { in: ["PENDING", "RUNNING", "RETRY_WAIT"] },
        },
      });
      if (!existing) throw error;
      return existing;
    }
  }

  async claimNext(
    workerId: string,
    leaseMs: number,
    now = new Date(),
    allowedPriorities: readonly BackgroundJobPriority[] = ["CRITICAL", "HIGH", "NORMAL", "LOW"],
    allowedTypes: readonly BackgroundJobType[] = Object.values(BackgroundJobType)
  ): Promise<BackgroundJob | null> {
    if (allowedPriorities.length === 0 || allowedTypes.length === 0) return null;
    return this.prisma.$transaction(async (tx) => {
      await this.recoverExpired(tx, now);
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      const claimed = await tx.$queryRaw<BackgroundJob[]>(Prisma.sql`
        WITH candidate AS (
          SELECT queued.id
          FROM background_jobs AS queued
          WHERE queued.status IN ('PENDING', 'RETRY_WAIT')
            AND queued.available_at <= ${now}
            AND queued.attempts < queued.max_attempts
            AND queued.priority::text IN (${Prisma.join(allowedPriorities)})
            AND queued.type::text IN (${Prisma.join(allowedTypes)})
          ORDER BY
            CASE queued.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
            COALESCE((
              SELECT MAX(previous.completed_at)
              FROM background_jobs AS previous
              WHERE previous.tenant_id IS NOT DISTINCT FROM queued.tenant_id
                AND previous.status = 'SUCCEEDED'
            ), 'epoch'::timestamp),
            queued.available_at,
            queued.created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE background_jobs AS job
        SET status = 'RUNNING',
            leased_by = ${workerId},
            lease_expires_at = ${leaseExpiresAt},
            heartbeat_at = ${now},
            lease_version = job.lease_version + 1,
            attempts = job.attempts + 1,
            started_at = COALESCE(job.started_at, ${now}),
            updated_at = ${now}
        FROM candidate
        WHERE job.id = candidate.id
        RETURNING
          job.id,
          job.tenant_id AS "tenantId",
          job.type,
          job.priority,
          job.status,
          job.target_type AS "targetType",
          job.target_id AS "targetId",
          job.active_key AS "activeKey",
          job.payload,
          job.attempts,
          job.max_attempts AS "maxAttempts",
          job.available_at AS "availableAt",
          job.leased_by AS "leasedBy",
          job.lease_expires_at AS "leaseExpiresAt",
          job.lease_version AS "leaseVersion",
          job.heartbeat_at AS "heartbeatAt",
          job.progress_current AS "progressCurrent",
          job.progress_total AS "progressTotal",
          job.progress_message AS "progressMessage",
          job.started_at AS "startedAt",
          job.completed_at AS "completedAt",
          job.last_error_code AS "lastErrorCode",
          job.last_error_message AS "lastErrorMessage",
          job.created_at AS "createdAt",
          job.updated_at AS "updatedAt"
      `);
      const job = claimed[0];
      if (!job) return null;
      await tx.backgroundJobAttempt.create({
        data: { jobId: job.id, attempt: job.attempts, workerId },
      });
      return job;
    });
  }

  async recoverExpiredLeases(now = new Date()): Promise<void> {
    await this.prisma.$transaction((tx) => this.recoverExpired(tx, now));
  }

  async heartbeat(jobId: string, owner: JobLeaseOwner, leaseMs: number, now = new Date()): Promise<boolean> {
    const result = await this.prisma.backgroundJob.updateMany({
      where: { id: jobId, status: "RUNNING", leasedBy: owner.workerId, leaseVersion: owner.leaseVersion },
      data: { heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs) },
    });
    return result.count === 1;
  }

  async reportProgress(
    jobId: string,
    owner: JobLeaseOwner,
    current: number,
    total: number | null,
    message?: string
  ): Promise<boolean> {
    if (!Number.isSafeInteger(current) || current < 0 || (total !== null && (!Number.isSafeInteger(total) || total < current))) {
      throw new Error("Invalid background job progress");
    }
    const result = await this.prisma.backgroundJob.updateMany({
      where: { id: jobId, status: "RUNNING", leasedBy: owner.workerId, leaseVersion: owner.leaseVersion },
      data: {
        progressCurrent: current,
        progressTotal: total,
        progressMessage: message?.slice(0, 200) ?? null,
      },
    });
    return result.count === 1;
  }

  async retryOrFail(
    jobId: string,
    owner: JobLeaseOwner,
    availableAt: Date,
    errorCode: string,
    errorMessage: string,
    now = new Date(),
    telemetry?: JobAttemptTelemetry,
  ): Promise<"RETRY_WAIT" | "FAILED" | null> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.backgroundJob.findFirst({
        where: { id: jobId, status: "RUNNING", leasedBy: owner.workerId, leaseVersion: owner.leaseVersion },
        select: { attempts: true, maxAttempts: true },
      });
      if (!job) return null;
      const status = job.attempts >= job.maxAttempts ? "FAILED" : "RETRY_WAIT";
      const result = await tx.backgroundJob.updateMany({
        where: { id: jobId, status: "RUNNING", leasedBy: owner.workerId, leaseVersion: owner.leaseVersion },
        data: {
          status,
          availableAt,
          completedAt: status === "FAILED" ? now : null,
          leasedBy: null,
          leaseExpiresAt: null,
          lastErrorCode: errorCode.slice(0, 80),
          lastErrorMessage: redactResourceMessage(errorMessage),
        },
      });
      if (result.count !== 1) return null;
      await tx.backgroundJobAttempt.updateMany({
        where: { jobId, attempt: job.attempts, outcome: "RUNNING" },
        data: {
          outcome: status === "FAILED" ? "FAILED" : "RETRY",
          finishedAt: now,
          errorCode: errorCode.slice(0, 80),
          durationMs: telemetry?.durationMs,
          processedCount: telemetry?.processedCount,
          memoryStart: telemetry?.memoryStart as Prisma.InputJsonValue | undefined,
          memoryEnd: telemetry?.memoryEnd as Prisma.InputJsonValue | undefined,
        },
      });
      return status;
    });
  }

  async complete(jobId: string, owner: JobLeaseOwner, now = new Date(), telemetry?: JobAttemptTelemetry): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.backgroundJob.updateMany({
        where: { id: jobId, status: "RUNNING", leasedBy: owner.workerId, leaseVersion: owner.leaseVersion },
        data: { status: "SUCCEEDED", completedAt: now, leasedBy: null, leaseExpiresAt: null },
      });
      if (result.count !== 1) return false;
      await tx.backgroundJobAttempt.updateMany({
        where: { jobId, attempt: owner.leaseVersion, outcome: "RUNNING" },
        data: {
          outcome: "SUCCEEDED",
          finishedAt: now,
          durationMs: telemetry?.durationMs,
          processedCount: telemetry?.processedCount,
          memoryStart: telemetry?.memoryStart as Prisma.InputJsonValue | undefined,
          memoryEnd: telemetry?.memoryEnd as Prisma.InputJsonValue | undefined,
        },
      });
      return true;
    });
  }

  private async recoverExpired(tx: Prisma.TransactionClient, now: Date): Promise<void> {
    const expired = await tx.backgroundJob.findMany({
      where: { status: "RUNNING", leaseExpiresAt: { lt: now } },
      select: { id: true, attempts: true, maxAttempts: true },
      take: 25,
    });
    for (const job of expired) {
      const status = job.attempts >= job.maxAttempts ? "FAILED" : "RETRY_WAIT";
      const result = await tx.backgroundJob.updateMany({
        where: { id: job.id, status: "RUNNING", leaseExpiresAt: { lt: now } },
        data: {
          status,
          availableAt: now,
          leasedBy: null,
          leaseExpiresAt: null,
          completedAt: status === "FAILED" ? now : null,
        },
      });
      if (result.count === 1) {
        await tx.backgroundJobAttempt.updateMany({
          where: { jobId: job.id, outcome: "RUNNING" },
          data: {
            outcome: "ABANDONED",
            finishedAt: now,
            memoryEnd: processMemorySnapshot() as Prisma.InputJsonValue,
          },
        });
      }
    }
  }
}

function processMemorySnapshot(): Record<string, number> {
  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
