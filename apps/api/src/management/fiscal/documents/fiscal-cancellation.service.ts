import { Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import type { BackgroundJob, FiscalDocument } from "@prisma/client";
import { BackgroundJobRegistry, RuntimeBackgroundJobHandler } from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FISCAL_PERMISSIONS } from "../fiscal-permissions";
import { FiscalProviderError } from "../providers/fiscal-provider.adapter";
import { FiscalProviderContextService } from "../providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { CANCEL_REMINDER_MINUTES, cancelDeadline, cancelReason } from "./cancel-deadlines";
import { FiscalAuditService } from "./fiscal-audit.service";
import { FiscalDocumentStateService, nextSyncAt } from "./fiscal-document-state.service";
import { FiscalNotifierService } from "./fiscal-notifier.service";

export type CancellationOrigin = "ORDER_CANCELLED" | "ORDER_DELETED" | "TAB_CANCELLED" | "MANUAL";

const PENDING_URL = "/admin/fiscal?tab=pendencias";
const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(date);

/**
 * Cancels the NFC-e when its sale is cancelled. Providers with API cancellation get a job;
 * the others (Bling) get an assisted flow: urgent notification + detection by the sync job.
 */
@Injectable()
export class FiscalCancellationService implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = "FISCAL_CANCELLATION" as const;
  readonly policy = { leaseMs: 2 * 60_000, retryBaseDelayMs: 15_000, retryMaxDelayMs: 2 * 60_000 };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService,
    @Inject(FiscalDocumentStateService) private readonly states: FiscalDocumentStateService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Inject(FiscalNotifierService) private readonly notifier: FiscalNotifierService,
    @Inject(BackgroundJobService) private readonly jobs: BackgroundJobService,
    @Optional() @Inject(BackgroundJobRegistry) private readonly jobRegistry?: BackgroundJobRegistry
  ) {}

  onModuleInit(): void {
    if (this.jobRegistry?.consumerEnabled) this.jobRegistry.register(this);
  }

  /** Order cancelled or deleted: cancels the document of the order or of its tab. Never throws. */
  async requestForOrder(tenantId: string, orderId: string, reason: string | null, actorUserId: string | null, origin: CancellationOrigin) {
    try {
      const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId }, select: { serviceTabId: true } });
      if (!order) return null;
      const keys = [`order:${orderId}`, ...(order.serviceTabId ? [`tab:${order.serviceTabId}`] : [])];
      const document = await this.prisma.fiscalDocument.findFirst({ where: { tenantId, activeKey: { in: keys } } });
      return document ? await this.start(document, reason, actorUserId, origin) : null;
    } catch (error) {
      this.audit.log("fiscal.cancellation.hook_failed", { tenantId, orderId, origin, reason: (error as Error).message }, "error");
      return null;
    }
  }

  async requestForTab(tenantId: string, tabId: string, reason: string | null, actorUserId: string | null) {
    try {
      const document = await this.prisma.fiscalDocument.findFirst({ where: { tenantId, activeKey: `tab:${tabId}` } });
      return document ? await this.start(document, reason, actorUserId, "TAB_CANCELLED") : null;
    } catch (error) {
      this.audit.log("fiscal.cancellation.hook_failed", { tenantId, tabId, origin: "TAB_CANCELLED", reason: (error as Error).message }, "error");
      return null;
    }
  }

  async start(document: FiscalDocument, reason: string | null, actorUserId: string | null, origin: CancellationOrigin): Promise<FiscalDocument> {
    const configuration = await this.prisma.fiscalConfiguration.findUnique({ where: { tenantId: document.tenantId } });
    const justification = cancelReason(reason, configuration?.defaultCancelReason ?? "Venda cancelada a pedido do cliente");

    if (["PENDING", "PROCESSING", "ERROR"].includes(document.status)) {
      const updated = await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: { cancelRequestedAt: new Date(), cancelReason: justification },
      });
      await this.audit.event({
        tenantId: document.tenantId,
        documentId: document.id,
        type: "CANCEL_REQUESTED",
        actorUserId,
        message: "Cancelamento sera feito apos a autorizacao",
        metadata: { origin, status: document.status },
      });
      return updated;
    }
    if (document.status !== "AUTHORIZED") return document;

    const now = new Date();
    const state = (document.issuerSnapshot as { address?: { state?: string } } | null)?.address?.state;
    const deadline = cancelDeadline(document.authorizedAt ?? now, state);
    const adapter = this.registry.get(document.provider);
    const viaApi = adapter.capabilities.cancelViaApi && Boolean(adapter.cancel);
    const updated = await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: {
        status: "CANCEL_PENDING",
        cancelReason: justification,
        cancelRequestedAt: document.cancelRequestedAt ?? now,
        cancelDeadlineAt: deadline,
        cancelReminderAt: viaApi ? null : new Date(deadline.getTime() - CANCEL_REMINDER_MINUTES * 60_000),
        nextSyncAt: nextSyncAt(now, now),
      },
    });
    await this.audit.event({
      tenantId: document.tenantId,
      documentId: document.id,
      type: viaApi ? "CANCEL_REQUESTED" : "CANCEL_MANUAL_REQUIRED",
      actorUserId,
      metadata: { origin, deadline: deadline.toISOString() },
    });

    if (viaApi) {
      await this.jobs.enqueue({
        tenantId: document.tenantId,
        type: "FISCAL_CANCELLATION",
        priority: "CRITICAL",
        targetType: "FISCAL_DOCUMENT",
        targetId: document.id,
        dedupeKey: `cancel:${document.id}`,
        maxAttempts: 6,
      });
      return updated;
    }

    this.audit.log(
      "fiscal.document.cancel_manual_required",
      { tenantId: document.tenantId, documentId: document.id, provider: document.provider, cancelDeadlineAt: deadline.toISOString(), origin },
      "warn"
    );
    await this.notifier.notify(document.tenantId, FISCAL_PERMISSIONS.cancel, {
      type: "FISCAL_CANCEL_MANUAL_REQUIRED",
      severity: "ERROR",
      title: `Cancelar NFC-e ${document.number ?? ""} no ${document.provider === "BLING" ? "Bling" : "provedor"} ate ${formatTime(deadline)}`.replace("  ", " "),
      message: `A venda foi cancelada. Cancele a NFC-e no painel do provedor com a justificativa: "${justification}".`,
      actionLabel: "Ver pendencias fiscais",
      actionUrl: PENDING_URL,
      relatedEntityType: "FISCAL_DOCUMENT",
      relatedEntityId: document.id,
    });
    return updated;
  }

  /** Cancellation requested while the document was still being authorized. */
  async continueAfterAuthorization(documentId: string): Promise<void> {
    const document = await this.prisma.fiscalDocument.findUnique({ where: { id: documentId } });
    if (document?.status === "AUTHORIZED" && document.cancelRequestedAt) {
      await this.start(document, document.cancelReason, null, "ORDER_CANCELLED");
    }
  }

  async execute(job: BackgroundJob): Promise<{ processedCount: number }> {
    const document = await this.prisma.fiscalDocument.findFirst({ where: { id: job.targetId, tenantId: job.tenantId ?? undefined } });
    if (!document || document.status !== "CANCEL_PENDING" || !document.externalId) return { processedCount: 0 };
    const adapter = this.registry.get(document.provider);
    try {
      const state = await this.contexts.run(document.tenantId, document.provider, document.environment, (ctx) =>
        adapter.cancel!(ctx, document.externalId as string, document.cancelReason ?? "Venda cancelada a pedido do cliente")
      );
      if (state.status === "CANCELLED") {
        await this.states.apply(document, state, "CANCELLATION");
      } else if (state.status === "REJECTED") {
        await this.fail(document, state.code, state.message);
      }
      return { processedCount: 1 };
    } catch (error) {
      const final = job.attempts >= job.maxAttempts;
      if (error instanceof FiscalProviderError && (!error.retryable || final)) {
        await this.fail(document, error.providerCode ?? error.code, error.message);
        return { processedCount: 0 };
      }
      throw error;
    }
  }

  /** Sync found the deadline passed without cancellation, or the provider refused it. */
  async fail(document: FiscalDocument, code: string, message: string): Promise<void> {
    await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: { status: "CANCEL_FAILED", rejectionCode: code.slice(0, 40), rejectionMessage: message.slice(0, 500) },
    });
    await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "CANCEL_FAILED", code, message });
    this.audit.log("fiscal.document.cancel_failed", { tenantId: document.tenantId, documentId: document.id, provider: document.provider, reason: code }, "error");
    await this.notifier.notify(document.tenantId, FISCAL_PERMISSIONS.cancel, {
      type: "FISCAL_CANCEL_FAILED",
      severity: "ERROR",
      title: `NFC-e ${document.number ?? ""} nao foi cancelada`.replace("  ", " "),
      message: `${message}. Trate a pendencia com o contador.`,
      actionLabel: "Ver pendencias fiscais",
      actionUrl: PENDING_URL,
      relatedEntityType: "FISCAL_DOCUMENT",
      relatedEntityId: document.id,
    });
  }

  /** Reminder before the deadline of an assisted cancellation. */
  async remind(document: FiscalDocument): Promise<void> {
    await this.prisma.fiscalDocument.update({ where: { id: document.id }, data: { cancelReminderAt: null } });
    await this.notifier.notify(document.tenantId, FISCAL_PERMISSIONS.cancel, {
      type: "FISCAL_CANCEL_REMINDER",
      severity: "ERROR",
      title: `Faltam ${CANCEL_REMINDER_MINUTES} minutos para cancelar a NFC-e ${document.number ?? ""}`.trim(),
      message: `Cancele no painel do provedor com a justificativa: "${document.cancelReason ?? ""}".`,
      actionLabel: "Ver pendencias fiscais",
      actionUrl: PENDING_URL,
      relatedEntityType: "FISCAL_DOCUMENT",
      relatedEntityId: document.id,
    });
  }
}
