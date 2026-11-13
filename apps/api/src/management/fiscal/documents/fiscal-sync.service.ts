import { Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { BackgroundJob, FiscalDocument } from "@prisma/client";
import { BackgroundJobRegistry, RuntimeBackgroundJobHandler } from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { RuntimeRoleService } from "../../../config/runtime-role.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalProviderContextService } from "../providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { FiscalAuditService } from "./fiscal-audit.service";
import { FiscalCancellationService } from "./fiscal-cancellation.service";
import { FiscalDocumentStateService, nextSyncAt } from "./fiscal-document-state.service";

const BATCH = 100;
const SYNCED_STATUSES = ["PROCESSING", "CANCEL_PENDING", "CANCEL_FAILED"] as const;

/**
 * Polls the provider for documents still waiting on SEFAZ or on a cancellation (including the
 * assisted cancellation done directly in the Bling panel), sends deadline reminders and marks
 * overdue cancellations. Cadence per document is `nextSyncAt` (see nextSyncAt()).
 */
@Injectable()
export class FiscalSyncService implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = "FISCAL_SYNC" as const;
  readonly policy = { leaseMs: 2 * 60_000, retryBaseDelayMs: 30_000, retryMaxDelayMs: 5 * 60_000 };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService,
    @Inject(FiscalDocumentStateService) private readonly states: FiscalDocumentStateService,
    @Inject(FiscalCancellationService) private readonly cancellations: FiscalCancellationService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Inject(BackgroundJobService) private readonly jobs: BackgroundJobService,
    @Optional() @Inject(BackgroundJobRegistry) private readonly jobRegistry?: BackgroundJobRegistry,
    @Optional() @Inject(RuntimeRoleService) private readonly runtimeRole?: RuntimeRoleService
  ) {}

  onModuleInit(): void {
    if (this.jobRegistry?.consumerEnabled) this.jobRegistry.register(this);
  }

  @Cron("30 * * * * *")
  async tick(): Promise<void> {
    if (this.runtimeRole && !this.runtimeRole.consumesBackgroundJobs) return;
    try {
      await this.enqueueDue();
      await this.sendReminders();
    } catch (error) {
      this.audit.log("fiscal.sync.tick_failed", { reason: (error as Error).message }, "error");
    }
  }

  async enqueueDue(now = new Date()): Promise<number> {
    const due = await this.prisma.fiscalDocument.findMany({
      where: { status: { in: [...SYNCED_STATUSES] }, nextSyncAt: { lte: now } },
      orderBy: { nextSyncAt: "asc" },
      take: BATCH,
      select: { id: true, tenantId: true },
    });
    for (const document of due) {
      await this.jobs.enqueue({
        tenantId: document.tenantId,
        type: "FISCAL_SYNC",
        priority: "HIGH",
        targetType: "FISCAL_DOCUMENT",
        targetId: document.id,
        dedupeKey: `sync:${document.id}`,
        maxAttempts: 3,
      });
    }
    return due.length;
  }

  async sendReminders(now = new Date()): Promise<void> {
    const due = await this.prisma.fiscalDocument.findMany({
      where: { status: "CANCEL_PENDING", cancelReminderAt: { lte: now } },
      take: BATCH,
    });
    for (const document of due) await this.cancellations.remind(document);
  }

  async execute(job: Pick<BackgroundJob, "targetId" | "tenantId">): Promise<{ processedCount: number }> {
    const document = await this.prisma.fiscalDocument.findFirst({ where: { id: job.targetId, tenantId: job.tenantId ?? undefined } });
    if (!document || !(SYNCED_STATUSES as readonly string[]).includes(document.status) || !document.externalId) {
      return { processedCount: 0 };
    }
    await this.sync(document);
    return { processedCount: 1 };
  }

  async sync(document: FiscalDocument, now = new Date()): Promise<void> {
    const adapter = this.registry.get(document.provider);
    const state = await this.contexts.run(document.tenantId, document.provider, document.environment, (ctx) =>
      adapter.get(ctx, document.externalId as string)
    );
    const outcome = await this.states.apply(document, state, "SYNC");
    await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "SYNCED", providerStatus: state.status });
    if (outcome === "AUTHORIZED") {
      await this.cancellations.continueAfterAuthorization(document.id);
      return;
    }
    if (outcome === "CANCELLED" || outcome === "REJECTED") return;

    const reference = document.cancelRequestedAt ?? document.createdAt;
    const next = nextSyncAt(reference, now);
    if (document.status === "CANCEL_PENDING" && document.cancelDeadlineAt && document.cancelDeadlineAt < now) {
      await this.cancellations.fail(document, "CANCEL_DEADLINE_EXPIRED", "Prazo de cancelamento expirado sem confirmacao do provedor");
    } else if (document.status === "PROCESSING" && !next) {
      await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: { status: "ERROR", rejectionCode: "NO_PROVIDER_RESPONSE", rejectionMessage: "Provedor nao concluiu a autorizacao em 7 dias", nextSyncAt: null },
      });
      await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "ERROR", code: "NO_PROVIDER_RESPONSE" });
      return;
    }
    await this.prisma.fiscalDocument.update({ where: { id: document.id }, data: { nextSyncAt: next } });
  }
}
