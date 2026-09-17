import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import type { BackgroundJob } from "@prisma/client";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BackgroundJobRegistry } from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IfoodFinancialReconciliationService } from "./ifood-financial-reconciliation.service";

@Injectable()
export class IfoodFinancialReconciliationProcessor implements OnModuleInit {
  private readonly logger = new Logger(IfoodFinancialReconciliationProcessor.name);
  private readonly active = new Set<string>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: IfoodFinancialReconciliationService,
    @Optional() private readonly jobs?: BackgroundJobService,
    @Optional() private readonly registry?: BackgroundJobRegistry
  ) {}

  async onModuleInit() {
    if (this.registry)
      this.registry.register({
        type: "IFOOD_FINANCIAL_RECONCILIATION",
        policy: { leaseMs: 300_000, retryBaseDelayMs: 30_000, retryMaxDelayMs: 600_000 },
        execute: (job) => this.execute(job),
      });
    const pending = await this.prisma.financialReconciliationRun.findMany({
      where: { status: { in: ["PENDING", "FETCHING", "PARTIAL"] } },
      select: { id: true, tenantId: true },
    });
    for (const run of pending) await this.queue(run.id, run.tenantId);
  }

  async queue(runId: string, tenantId: string) {
    if (this.jobs) {
      await this.jobs.enqueue({
        tenantId,
        type: "IFOOD_FINANCIAL_RECONCILIATION",
        priority: "NORMAL",
        targetType: "FinancialReconciliationRun",
        targetId: runId,
        dedupeKey: runId,
        payload: {},
      });
      return;
    }
    if (this.active.has(runId)) return;
    this.active.add(runId);
    void this.service
      .process(tenantId, runId)
      .catch((error) =>
        this.logger.error(
          JSON.stringify({
            event: "ifood_financial_reconciliation_failed",
            tenantId,
            runId,
            error: error instanceof Error ? error.message : "unknown",
          })
        )
      )
      .finally(() => this.active.delete(runId));
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async daily() {
    const integrations = await this.prisma.salesIntegration.findMany({
      where: { provider: "IFOOD", status: "ACTIVE" },
      select: { id: true, tenantId: true },
    });
    const end = new Date();
    const start = new Date(end.getTime() - 32 * 86_400_000);
    for (const integration of integrations) {
      try {
        const run = await this.service.createRun(
          integration.tenantId,
          null,
          integration.id,
          start.toISOString().slice(0, 10),
          end.toISOString().slice(0, 10),
          "DAILY"
        );
        await this.queue(run.id, integration.tenantId);
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: "ifood_financial_daily_skipped",
            tenantId: integration.tenantId,
            integrationId: integration.id,
            reason: error instanceof Error ? error.message : "unknown",
          })
        );
      }
    }
  }

  async execute(job: BackgroundJob) {
    if (!job.tenantId) return { processedCount: 0 };
    await this.service.process(job.tenantId, job.targetId);
    return { processedCount: 1 };
  }
}
