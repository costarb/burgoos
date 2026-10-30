import { Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { BackgroundJob, SalesIntegration } from "@prisma/client";
import { BackgroundJobRegistry, RuntimeBackgroundJobHandler } from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { RuntimeRoleService } from "../../../config/runtime-role.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { SalesImportConfirmationService } from "../sales-import-confirmation.service";
import { SalesImportPreviewService } from "../sales-import-preview.service";

const PROVIDERS = ["MERCADO_PAGO", "PAGBANK"] as const;
const DEGRADED_FAILURES = 3;
const DEGRADED_LAG_SECONDS = 15 * 60;
const ALERT_INTERVAL_MS = 60 * 60_000;
/** Just after midnight the previous day is also fetched, so late sales of the night are not lost. */
const PREVIOUS_DAY_WINDOW_MS = 10 * 60_000;

export type AutoImportCycleResult = "success" | "skipped" | "failed";

function businessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

/**
 * Automatic sales import every 2 minutes (spec 029, US5): one durable job per integration, so a
 * failing provider or tenant never blocks the others. Each cycle imports the current business day
 * (deduplicated by ExternalSaleIdentity), logs `sales.auto_import.cycle` and, after repeated
 * failures or data lag, `sales.auto_import.degraded` plus an hourly-limited notification.
 * Created orders trigger the automatic NFC-e through the confirmation hook.
 */
@Injectable()
export class SalesAutoImportService implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = "SALES_AUTO_IMPORT" as const;
  readonly policy = { leaseMs: 5 * 60_000, retryBaseDelayMs: 30_000, retryMaxDelayMs: 2 * 60_000 };
  private readonly logger = new Logger("SalesAutoImport");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SalesImportPreviewService) private readonly preview: SalesImportPreviewService,
    @Inject(SalesImportConfirmationService) private readonly confirmation: SalesImportConfirmationService,
    @Inject(BackgroundJobService) private readonly jobs: BackgroundJobService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Optional() @Inject(BackgroundJobRegistry) private readonly jobRegistry?: BackgroundJobRegistry,
    @Optional() @Inject(RuntimeRoleService) private readonly runtimeRole?: RuntimeRoleService
  ) {}

  onModuleInit(): void {
    if (this.jobRegistry?.consumerEnabled) this.jobRegistry.register(this);
  }

  @Cron("0 */2 * * * *")
  async schedule(): Promise<number> {
    if (this.runtimeRole && !this.runtimeRole.consumesBackgroundJobs) return 0;
    try {
      const integrations = await this.prisma.salesIntegration.findMany({
        where: { autoImportEnabled: true, status: "ACTIVE", provider: { in: [...PROVIDERS] } },
        select: { id: true, tenantId: true },
      });
      for (const integration of integrations) {
        await this.jobs.enqueue({
          tenantId: integration.tenantId,
          type: "SALES_AUTO_IMPORT",
          priority: "HIGH",
          targetType: "SALES_INTEGRATION",
          targetId: integration.id,
          // One active job per integration: a slow cycle is never overlapped by the next one.
          dedupeKey: `auto-import:${integration.id}`,
          maxAttempts: 1,
        });
      }
      return integrations.length;
    } catch (error) {
      this.log("sales.auto_import.schedule_failed", { reason: (error as Error).message }, "error");
      return 0;
    }
  }

  async execute(job: Pick<BackgroundJob, "targetId" | "tenantId">): Promise<{ processedCount: number }> {
    const result = await this.runCycle(job.tenantId ?? "", job.targetId);
    return { processedCount: result === "success" ? 1 : 0 };
  }

  /** Never throws: every outcome is recorded on the integration and logged. */
  async runCycle(tenantId: string, integrationId: string, now = new Date()): Promise<AutoImportCycleResult> {
    const startedAt = Date.now();
    const integration = await this.prisma.salesIntegration.findFirst({ where: { id: integrationId, tenantId } });
    if (!integration || !integration.autoImportEnabled || integration.status !== "ACTIVE") return "skipped";
    const base = { tenantId, integrationId, provider: integration.provider };
    await this.prisma.salesIntegration.update({ where: { id: integrationId }, data: { autoImportLastAttemptAt: now } });

    const today = businessDate(now);
    const startDate = businessDate(new Date(now.getTime() - PREVIOUS_DAY_WINDOW_MS));
    let runId: string | null = null;
    try {
      const run = await this.preview.create(
        tenantId,
        null,
        {
          integrationId,
          startDate,
          endDate: today,
          strategy: (integration.autoImportStrategy ?? "PRICE_WEIGHTED") as "PRICE_WEIGHTED" | "FIXED_PRODUCT",
          fixedProductId: integration.autoImportFixedProductId ?? undefined,
        } as never,
        "AUTOMATIC"
      );
      runId = run.id;
    } catch (error) {
      // A manual import of the same period is running: not a failure, try again next cycle.
      if ((error as { status?: number }).status === 409) {
        this.log("sales.auto_import.cycle", { ...base, result: "skipped", reason: "OVERLAP", durationMs: Date.now() - startedAt });
        return "skipped";
      }
      return this.fail(integration, base, errorCode(error), startedAt, now);
    }

    try {
      const previewed = await this.preview.process(runId, tenantId);
      if (previewed.status === "FAILED") {
        const day = await this.prisma.salesImportDay.findFirst({ where: { runId, status: "FAILED" }, orderBy: { movementDate: "desc" } });
        return this.fail(integration, { ...base, runId }, day?.errorCode ?? "PREVIEW_FAILED", startedAt, now);
      }
      const confirmed = await this.confirmation.confirm(tenantId, runId);
      const counts = (confirmed.counts ?? {}) as Record<string, number>;
      const lagSeconds = await this.lagSeconds(integrationId, now);
      await this.prisma.salesIntegration.update({
        where: { id: integrationId },
        data: {
          autoImportLastSuccessAt: now,
          autoImportConsecutiveFailures: 0,
          autoImportLastErrorCode: null,
          autoImportLastLagSeconds: lagSeconds,
          lastSyncAt: now,
        },
      });
      this.log("sales.auto_import.cycle", {
        ...base,
        runId,
        result: "success",
        status: confirmed.status,
        found: Number(counts.found ?? 0),
        created: Number(counts.created ?? 0),
        duplicate: Number(counts.duplicate ?? 0),
        failed: Number(counts.failed ?? 0),
        lagSeconds,
        durationMs: Date.now() - startedAt,
      });
      if (lagSeconds !== null && lagSeconds > DEGRADED_LAG_SECONDS) {
        await this.degraded(integration, { ...base, lagSeconds, consecutiveFailures: 0, reason: "LAG" }, now);
      }
      return "success";
    } catch (error) {
      return this.fail(integration, { ...base, runId }, errorCode(error), startedAt, now);
    }
  }

  private async fail(
    integration: SalesIntegration,
    base: Record<string, unknown>,
    code: string,
    startedAt: number,
    now: Date
  ): Promise<AutoImportCycleResult> {
    const consecutiveFailures = integration.autoImportConsecutiveFailures + 1;
    await this.prisma.salesIntegration.update({
      where: { id: integration.id },
      data: { autoImportConsecutiveFailures: consecutiveFailures, autoImportLastErrorCode: code.slice(0, 40) },
    });
    this.log(
      "sales.auto_import.cycle",
      { ...base, result: "failed", errorCode: code, attempt: consecutiveFailures, durationMs: Date.now() - startedAt },
      "warn"
    );
    if (consecutiveFailures >= DEGRADED_FAILURES) {
      await this.degraded(integration, { ...base, consecutiveFailures, lagSeconds: integration.autoImportLastLagSeconds, reason: code }, now);
    }
    return "failed";
  }

  private async degraded(integration: SalesIntegration, fields: Record<string, unknown>, now: Date): Promise<void> {
    this.log("sales.auto_import.degraded", fields, "warn");
    const fresh = await this.prisma.salesIntegration.findUnique({ where: { id: integration.id }, select: { autoImportLastAlertAt: true } });
    if (fresh?.autoImportLastAlertAt && now.getTime() - fresh.autoImportLastAlertAt.getTime() < ALERT_INTERVAL_MS) return;
    await this.prisma.salesIntegration.update({ where: { id: integration.id }, data: { autoImportLastAlertAt: now } });
    const recipients = await this.prisma.user.findMany({
      where: { tenantId: integration.tenantId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
      select: { id: true },
    });
    const provider = integration.provider === "MERCADO_PAGO" ? "Mercado Pago" : "PagBank";
    for (const recipient of recipients) {
      await this.notifications.create({
        tenantId: integration.tenantId,
        recipientUserId: recipient.id,
        type: "SALES_AUTO_IMPORT_DEGRADED",
        severity: "WARNING",
        title: `Importacao automatica do ${provider} com falhas`,
        message:
          fields.reason === "LAG"
            ? `As vendas do ${provider} estao chegando com atraso. As NFC-e dessas vendas podem atrasar.`
            : `A importacao automatica do ${provider} falhou ${String(fields.consecutiveFailures)} vezes seguidas. Verifique a conexao.`,
        actionLabel: "Ver integracao",
        actionUrl: "/admin/orders/import",
        relatedEntityType: "SALES_INTEGRATION",
        relatedEntityId: integration.id,
      });
    }
  }

  /** Seconds between now and the most recent sale received from the provider today. */
  private async lagSeconds(integrationId: string, now: Date): Promise<number | null> {
    const latest = await this.prisma.externalSalesMovement.findFirst({
      where: { integrationId, kind: "SALE", occurredAt: { gte: new Date(`${businessDate(now)}T00:00:00-03:00`) } },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    });
    return latest?.occurredAt ? Math.max(0, Math.round((now.getTime() - latest.occurredAt.getTime()) / 1000)) : null;
  }

  private log(event: string, fields: Record<string, unknown>, level: "log" | "warn" | "error" = "log"): void {
    this.logger[level](JSON.stringify({ event, ...fields }));
  }
}

function errorCode(error: unknown): string {
  const candidate = error as { code?: unknown; status?: number; name?: string };
  if (typeof candidate?.code === "string") return candidate.code;
  if (typeof candidate?.status === "number") return `HTTP_${candidate.status}`;
  return candidate?.name ?? "INTERNAL_ERROR";
}
