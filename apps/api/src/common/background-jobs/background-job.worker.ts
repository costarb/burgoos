import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackgroundJobPriority } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { MemoryPressureService } from "../observability/memory-pressure.service";
import { ResourceMetricsService } from "../observability/resource-metrics.service";
import { snapshot } from "../observability/resource-operation.service";
import { redactResourceMessage } from "../observability/resource-redaction";
import { BackgroundJobPolicy } from "./background-job-policy";
import { BackgroundJobRegistry, type RuntimeBackgroundJobHandler } from "./background-job.registry";
import { BackgroundJobRepository } from "./background-job.repository";

@Injectable()
export class BackgroundJobWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobWorker.name);
  private readonly workerId = `worker-${randomUUID()}`;
  private readonly leaseMs: number;
  private readonly pollIntervalMs: number;
  private readonly controller = new AbortController();
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly repository: BackgroundJobRepository,
    private readonly registry: BackgroundJobRegistry,
    private readonly pressure: MemoryPressureService,
    config: ConfigService,
    @Optional()
    @Inject(BackgroundJobPolicy)
    private readonly policy = new BackgroundJobPolicy(),
    @Optional() private readonly metrics?: ResourceMetricsService,
  ) {
    this.leaseMs = config.get<number>("BACKGROUND_JOB_LEASE_MS") ?? 60_000;
    this.pollIntervalMs = config.get<number>("BACKGROUND_JOB_POLL_INTERVAL_MS") ?? 1_000;
  }

  onModuleInit(): void {
    if (this.registry.consumerEnabled) this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  start(): void {
    if (!this.loopPromise) this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.controller.abort();
    await this.loopPromise;
    this.loopPromise = null;
  }

  async runOnce(now = new Date()): Promise<boolean> {
    const priorities = this.admittedPriorities();
    const job = await this.repository.claimNext(
      this.workerId,
      this.leaseMs,
      now,
      priorities,
      this.registry.listTypes()
    );
    if (!job) return false;
    const owner = { workerId: this.workerId, leaseVersion: job.leaseVersion };
    let handler: RuntimeBackgroundJobHandler;
    try {
      handler = this.registry.resolve(job.type);
    } catch (error) {
      await this.repository.retryOrFail(
        job.id,
        owner,
        new Date(Date.now() + this.policy.retryDelayMs(job.attempts)),
        "HANDLER_NOT_REGISTERED",
        error instanceof Error ? error.message : "Background job handler is not registered"
      );
      return true;
    }
    const startedAt = Date.now();
    const memoryStart = snapshot();
    this.metrics?.jobStarted({
      jobId: job.id,
      handler: job.type,
      queueLagMs: Math.max(0, startedAt - job.createdAt.getTime()),
      snapshot: memoryStart,
    });
    const handlerLeaseMs = handler.policy?.leaseMs ?? this.leaseMs;
    await this.repository.heartbeat(job.id, owner, handlerLeaseMs, now);
    const heartbeat = setInterval(() => {
      void this.repository.heartbeat(job.id, owner, handlerLeaseMs).catch((error) =>
        this.logger.error(`background_job.heartbeat_failed jobId=${job.id}`, error)
      );
    }, Math.max(1_000, Math.floor(handlerLeaseMs / 3)));
    heartbeat.unref();
    try {
      const result = await handler.execute(job, this.controller.signal);
      if (result.processedCount !== undefined) {
        await this.repository.reportProgress(job.id, owner, result.processedCount, result.processedCount);
      }
      const memoryEnd = snapshot();
      const durationMs = Date.now() - startedAt;
      await this.repository.complete(job.id, owner, new Date(), {
        memoryStart,
        memoryEnd,
        durationMs,
        processedCount: result.processedCount,
      });
      this.metrics?.jobFinished({ jobId: job.id, handler: job.type, outcome: "SUCCEEDED", durationMs, processedCount: result.processedCount, snapshot: memoryEnd });
    } catch (error) {
      const retryPolicy = handler.policy
        ? new BackgroundJobPolicy(
            handler.policy.retryBaseDelayMs,
            handler.policy.retryMaxDelayMs,
            handler.policy.retryJitterRatio
          )
        : this.policy;
      const delay = retryPolicy.retryDelayMs(job.attempts);
      const memoryEnd = snapshot();
      const durationMs = Date.now() - startedAt;
      await this.repository.retryOrFail(
        job.id,
        owner,
        new Date(Date.now() + delay),
        error instanceof Error ? error.name : "JOB_ERROR",
        redactResourceMessage(error instanceof Error ? error.message : "Background job failed"),
        new Date(),
        { memoryStart, memoryEnd, durationMs },
      );
      this.metrics?.jobFinished({ jobId: job.id, handler: job.type, outcome: "FAILED", durationMs, snapshot: memoryEnd });
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  }

  private async loop(): Promise<void> {
    while (!this.controller.signal.aborted) {
      const processed = await this.runOnce();
      if (!processed) await abortableDelay(this.pollIntervalMs, this.controller.signal);
    }
  }

  private admittedPriorities(): BackgroundJobPriority[] {
    return (["CRITICAL", "HIGH", "NORMAL", "LOW"] as BackgroundJobPriority[]).filter((priority) =>
      this.pressure.canAdmit(priority)
    );
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, milliseconds);
    timer.unref();
    signal.addEventListener("abort", done, { once: true });
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
