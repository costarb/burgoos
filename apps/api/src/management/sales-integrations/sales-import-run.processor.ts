import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BackgroundJob } from "@prisma/client";
import { BackgroundJobRegistry } from "../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../common/background-jobs/background-job.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { SalesImportConfirmationService } from "./sales-import-confirmation.service";
import { SalesImportPreviewService } from "./sales-import-preview.service";

@Injectable()
export class SalesImportRunProcessor implements OnModuleInit {
  private readonly logger = new Logger(SalesImportRunProcessor.name);
  private readonly active = new Set<string>();
  private readonly policy = { leaseMs: 300_000, retryBaseDelayMs: 10_000, retryMaxDelayMs: 600_000 };
  constructor(
    private readonly prisma: PrismaService,
    private readonly preview: SalesImportPreviewService,
    private readonly confirmation: SalesImportConfirmationService,
    @Optional() private readonly jobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async onModuleInit() {
    if (!this.prisma?.salesImportRun) return;
    if (!this.durableEnabled()) {
      const recoverable = await this.prisma.salesImportRun.findMany({
        where: { status: { in: ["PENDING", "FETCHING", "IMPORTING"] } },
        select: { id: true, tenantId: true, status: true },
      });
      recoverable.forEach((run) => run.status === "IMPORTING"
        ? this.queueConfirmation(run.id, run.tenantId)
        : this.queuePreview(run.id, run.tenantId));
      return;
    }
    if (!this.jobs || !this.registry) throw new Error("Durable sales imports require BackgroundJobsModule");
    this.registry.register({ type: "SALES_IMPORT_PREVIEW", policy: this.policy, execute: (job) => this.execute(job) });
    this.registry.register({ type: "SALES_IMPORT_CONFIRM", policy: this.policy, execute: (job) => this.execute(job) });
    await this.enqueueRecoverableRuns();
  }

  async queuePreview(runId: string, tenantId: string): Promise<void> {
    if (this.durableEnabled()) return this.enqueue(runId, tenantId, "SALES_IMPORT_PREVIEW");
    this.runOnce(runId, tenantId, "preview");
  }
  async queueConfirmation(runId: string, tenantId: string): Promise<void> {
    if (this.durableEnabled()) return this.enqueue(runId, tenantId, "SALES_IMPORT_CONFIRM");
    this.runOnce(runId, tenantId, "confirmation");
  }

  async enqueueRecoverableRuns(): Promise<void> {
    let after: string | undefined;
    do {
      const page = await this.findRecoverablePage(after);
      for (const run of page) {
        await this.enqueue(run.id, run.tenantId, run.status === "IMPORTING" ? "SALES_IMPORT_CONFIRM" : "SALES_IMPORT_PREVIEW");
      }
      after = page.length === 25 ? page[page.length - 1]?.id : undefined;
    } while (after);
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    if (!job.tenantId) return { processedCount: 0 };
    if (job.type === "SALES_IMPORT_CONFIRM") await this.confirmation.confirm(job.tenantId, job.targetId, true);
    else await this.preview.process(job.targetId, job.tenantId);
    return { processedCount: 1 };
  }

  private findRecoverablePage(after?: string) {
    return this.prisma.salesImportRun.findMany({
      where: { status: { in: ["PENDING", "FETCHING", "IMPORTING"] } },
      select: { id: true, tenantId: true, status: true },
      orderBy: { id: "asc" },
      take: 25,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });
  }

  private async enqueue(runId: string, tenantId: string, type: "SALES_IMPORT_PREVIEW" | "SALES_IMPORT_CONFIRM"): Promise<void> {
    if (!this.jobs) throw new Error("Background jobs are unavailable");
    await this.jobs.enqueue({ tenantId, type, priority: "NORMAL", targetType: "SalesImportRun", targetId: runId, dedupeKey: runId, payload: {} });
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("SALES_IMPORT_DURABLE_JOBS_ENABLED") === "true";
  }

  private runOnce(runId: string, tenantId: string, operation: "preview" | "confirmation") {
    if (this.active.has(runId)) return;
    this.active.add(runId);
    void (
      operation === "preview"
        ? this.preview.process(runId, tenantId)
        : this.confirmation.confirm(tenantId, runId, true)
    )
      .then((result) =>
        this.logger.log(
          JSON.stringify({
            event: `sales_import_${operation}_completed`,
            tenantId,
            runId,
            provider: result.provider,
            startDate: result.startDate,
            endDate: result.endDate,
            status: result.status,
            counts: result.counts,
          })
        )
      )
      .catch(async () => {
        await this.prisma.salesImportRun.updateMany({
          where: { id: runId, tenantId },
          data: {
            status: "FAILED",
            errorCode: "PROCESSING_FAILED",
            errorMessage: "Falha interna durante o processamento",
            completedAt: new Date(),
          },
        });
        this.logger.error(
          JSON.stringify({
            event: `sales_import_${operation}_failed`,
            tenantId,
            runId,
            code: "PROCESSING_FAILED",
          })
        );
      })
      .finally(() => this.active.delete(runId));
  }
}
