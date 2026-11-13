import { Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import type { BackgroundJob, FiscalDocument } from "@prisma/client";
import { BackgroundJobRegistry, RuntimeBackgroundJobHandler } from "../../../common/background-jobs/background-job.registry";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalProviderError, NfceDraft } from "../providers/fiscal-provider.adapter";
import { FiscalProviderContextService } from "../providers/fiscal-provider-context.service";
import { FiscalProviderRegistry } from "../providers/fiscal-provider.registry";
import { FiscalAuditService } from "./fiscal-audit.service";
import { FiscalCancellationService } from "./fiscal-cancellation.service";
import { FiscalDocumentStateService } from "./fiscal-document-state.service";

/**
 * FISCAL_EMISSION handler: create at the provider (externalId persisted before submitting, so
 * retries never duplicate), submit, apply the state. A timeout on `create` looks the document
 * up by reference before any new attempt. Retryable failures use the job retry policy; the last
 * attempt leaves the document in ERROR (kept active: it may exist at the provider).
 */
@Injectable()
export class FiscalEmissionProcessor implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = "FISCAL_EMISSION" as const;
  readonly policy = { leaseMs: 2 * 60_000, retryBaseDelayMs: 10_000, retryMaxDelayMs: 5 * 60_000 };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalProviderRegistry) private readonly registry: FiscalProviderRegistry,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService,
    @Inject(FiscalDocumentStateService) private readonly states: FiscalDocumentStateService,
    @Inject(FiscalCancellationService) private readonly cancellations: FiscalCancellationService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Optional() @Inject(BackgroundJobRegistry) private readonly jobRegistry?: BackgroundJobRegistry
  ) {}

  onModuleInit(): void {
    if (this.jobRegistry?.consumerEnabled) this.jobRegistry.register(this);
  }

  async execute(job: Pick<BackgroundJob, "targetId" | "tenantId" | "attempts" | "maxAttempts">): Promise<{ processedCount: number }> {
    const document = await this.prisma.fiscalDocument.findFirst({
      where: { id: job.targetId, tenantId: job.tenantId ?? undefined },
    });
    if (!document || !["PENDING", "PROCESSING", "ERROR"].includes(document.status)) return { processedCount: 0 };
    try {
      await this.process(document);
      return { processedCount: 1 };
    } catch (error) {
      return this.handleFailure(document, error, job.attempts >= job.maxAttempts);
    }
  }

  async process(document: FiscalDocument): Promise<void> {
    const adapter = this.registry.get(document.provider);
    const draft = document.payloadSnapshot as unknown as NfceDraft;
    const state = await this.contexts.run(document.tenantId, document.provider, document.environment, async (ctx) => {
      let externalId = document.externalId;
      if (!externalId) {
        try {
          externalId = (await adapter.create(ctx, draft)).externalId;
        } catch (error) {
          if (!(error instanceof FiscalProviderError) || error.code !== "TIMEOUT") throw error;
          externalId = (await adapter.findByReference(ctx, draft))?.externalId ?? null;
          if (!externalId) throw error;
        }
        await this.prisma.fiscalDocument.update({
          where: { id: document.id },
          data: { externalId, attempts: { increment: 1 } },
        });
        await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "SUBMITTED", metadata: { externalId } });
        document = { ...document, externalId };
      } else {
        await this.prisma.fiscalDocument.update({ where: { id: document.id }, data: { attempts: { increment: 1 } } });
        // Already created: it may have been submitted before a crash, so check first.
        const current = await adapter.get(ctx, externalId);
        if (current.status !== "PROCESSING") return current;
      }
      return adapter.submit(ctx, externalId);
    });
    const outcome = await this.states.apply(document, state, "EMISSION");
    if (outcome === "AUTHORIZED") await this.cancellations.continueAfterAuthorization(document.id);
  }

  private async handleFailure(document: FiscalDocument, error: unknown, finalAttempt: boolean): Promise<{ processedCount: number }> {
    const providerError = error instanceof FiscalProviderError ? error : null;
    const code = providerError?.providerCode ?? providerError?.code ?? "INTERNAL_ERROR";
    const retryable = providerError ? providerError.retryable : true;
    const message = (error as Error).message ?? "Falha na emissao";
    this.audit.log(
      "fiscal.document.error",
      { tenantId: document.tenantId, documentId: document.id, provider: document.provider, errorCode: code, retryable, finalAttempt },
      "error"
    );
    if (providerError?.code === "VALIDATION") {
      await this.states.apply(document, { status: "REJECTED", externalId: document.externalId, code, message }, "EMISSION");
      return { processedCount: 0 };
    }
    if (!retryable || finalAttempt) {
      await this.prisma.fiscalDocument.update({
        where: { id: document.id },
        data: { status: "ERROR", rejectionCode: code.slice(0, 40), rejectionMessage: message.slice(0, 500) },
      });
      await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "ERROR", code, message });
      return { processedCount: 0 };
    }
    await this.audit.event({ tenantId: document.tenantId, documentId: document.id, type: "RETRY_SCHEDULED", code, message });
    throw error;
  }
}
