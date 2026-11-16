import { Inject, Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { BackgroundJob, FiscalDocument } from "@prisma/client";
import { BackgroundJobRegistry, RuntimeBackgroundJobHandler } from "../../../common/background-jobs/background-job.registry";
import { BackgroundJobService } from "../../../common/background-jobs/background-job.service";
import { ASSET_STORAGE, AssetStorage } from "../../../common/storage/asset-storage";
import { RuntimeRoleService } from "../../../config/runtime-role.service";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FiscalAuditService } from "./fiscal-audit.service";
import { FiscalDocumentStateService } from "./fiscal-document-state.service";

const JOB_TYPE = "FISCAL_FILE_RECOVERY" as const;
/** Time budget of one job run; the rest continues in a new job from the last document checked. */
const RUN_BUDGET_MS = 8 * 60_000;
const PAGE = 50;
const RECOVERABLE_STATUSES = ["AUTHORIZED", "CANCELLED"] as const;

export interface FiscalFileRecoveryStatus {
  status: "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  documents: number;
  missing: number;
  finishedAt: string | null;
}

/**
 * Spec 030 (US3): until 2026-11-16 the production storage was the local disk, wiped on every deploy,
 * so the XML copies of authorized notes were lost. This job checks every authorized or cancelled
 * note, downloads again from the provider what is missing (new bucket layout) and flags the notes it
 * cannot recover (pending reason FILES_MISSING). One document at a time, respecting provider limits.
 */
@Injectable()
export class FiscalFileRecoveryService implements OnModuleInit, RuntimeBackgroundJobHandler {
  readonly type = JOB_TYPE;
  readonly policy = { leaseMs: 10 * 60_000, retryBaseDelayMs: 60_000, retryMaxDelayMs: 15 * 60_000 };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FiscalDocumentStateService) private readonly states: FiscalDocumentStateService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Inject(BackgroundJobService) private readonly jobs: BackgroundJobService,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStorage,
    @Optional() @Inject(BackgroundJobRegistry) private readonly jobRegistry?: BackgroundJobRegistry,
    @Optional() @Inject(RuntimeRoleService) private readonly runtimeRole?: RuntimeRoleService
  ) {}

  onModuleInit(): void {
    if (this.jobRegistry?.consumerEnabled) this.jobRegistry.register(this);
  }

  /** Weekly check, Sundays 04:00 in São Paulo (07:00 UTC). */
  @Cron("0 0 7 * * 0")
  async weekly(): Promise<number> {
    if (this.runtimeRole && !this.runtimeRole.consumesBackgroundJobs) return 0;
    const tenants = await this.prisma.fiscalDocument.findMany({
      where: { status: { in: [...RECOVERABLE_STATUSES] } },
      distinct: ["tenantId"],
      select: { tenantId: true },
    });
    for (const { tenantId } of tenants) await this.request(tenantId);
    return tenants.length;
  }

  /** Idempotent: while a recovery of the store is active the same job is returned. */
  async request(tenantId: string, afterId?: string): Promise<{ jobId: string; status: "QUEUED" | "RUNNING" }> {
    const job = await this.jobs.enqueue({
      tenantId,
      type: JOB_TYPE,
      priority: "LOW",
      targetType: "TENANT",
      targetId: tenantId,
      dedupeKey: `fiscal-file-recovery:${tenantId}${afterId ? `:${afterId}` : ""}`,
      maxAttempts: 3,
      payload: afterId ? { afterId } : {},
    });
    return { jobId: job.id, status: job.status === "RUNNING" ? "RUNNING" : "QUEUED" };
  }

  async status(tenantId: string): Promise<FiscalFileRecoveryStatus> {
    const [job, documents, missing] = await Promise.all([
      this.prisma.backgroundJob.findFirst({
        where: { tenantId, type: JOB_TYPE },
        orderBy: { createdAt: "desc" },
        select: { status: true, completedAt: true },
      }),
      this.prisma.fiscalDocument.count({ where: { tenantId, status: { in: [...RECOVERABLE_STATUSES] } } }),
      this.prisma.fiscalDocument.count({ where: { tenantId, filesMissingAt: { not: null } } }),
    ]);
    const status: FiscalFileRecoveryStatus["status"] = !job
      ? "IDLE"
      : job.status === "SUCCEEDED"
        ? "COMPLETED"
        : job.status === "RUNNING"
          ? "RUNNING"
          : job.status === "FAILED"
            ? "FAILED"
            : "QUEUED";
    return { status, documents, missing, finishedAt: job?.completedAt?.toISOString() ?? null };
  }

  async execute(job: Pick<BackgroundJob, "tenantId" | "targetId" | "payload">): Promise<{ processedCount: number }> {
    const tenantId = job.tenantId ?? job.targetId;
    const afterId = (job.payload as { afterId?: string } | null)?.afterId;
    const result = await this.run(tenantId, afterId);
    if (result.nextAfterId) await this.request(tenantId, result.nextAfterId);
    return { processedCount: result.checked };
  }

  /** Checks documents in id order until the time budget ends; returns where to continue. */
  async run(
    tenantId: string,
    afterId?: string,
    deadline = Date.now() + RUN_BUDGET_MS
  ): Promise<{ checked: number; recovered: number; missing: number; nextAfterId: string | null }> {
    const startedAt = Date.now();
    let cursor = afterId;
    let checked = 0;
    let recovered = 0;
    let missing = 0;
    for (;;) {
      const page = await this.prisma.fiscalDocument.findMany({
        where: { tenantId, status: { in: [...RECOVERABLE_STATUSES] }, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: PAGE,
      });
      if (!page.length) break;
      for (const document of page) {
        if (Date.now() >= deadline) {
          this.logCompleted(tenantId, { checked, recovered, missing }, startedAt, cursor ?? null);
          return { checked, recovered, missing, nextAfterId: cursor ?? null };
        }
        const outcome = await this.recover(document);
        checked += 1;
        if (outcome === "RECOVERED") recovered += 1;
        if (outcome === "MISSING") missing += 1;
        cursor = document.id;
      }
    }
    this.logCompleted(tenantId, { checked, recovered, missing }, startedAt, null);
    return { checked, recovered, missing, nextAfterId: null };
  }

  /** OK = files present; RECOVERED = downloaded again; MISSING = could not be recovered (flagged). */
  async recover(document: FiscalDocument): Promise<"OK" | "RECOVERED" | "MISSING"> {
    const needsXml = !(await this.present(document.xmlAssetKey));
    const needsCancelXml = document.status === "CANCELLED" && !(await this.present(document.cancelXmlAssetKey));
    if (!needsXml && !needsCancelXml) {
      if (document.filesMissingAt) await this.markRecovered(document.id);
      return "OK";
    }
    if (needsXml) await this.states.storeFiles(document, "AUTHORIZATION", { checkTaxes: false });
    if (needsCancelXml) await this.states.storeFiles(document, "CANCELLATION", { checkTaxes: false });

    const fresh = await this.prisma.fiscalDocument.findUnique({
      where: { id: document.id },
      select: { xmlAssetKey: true, cancelXmlAssetKey: true },
    });
    const xmlOk = !needsXml || (await this.present(fresh?.xmlAssetKey ?? null));
    const cancelOk = !needsCancelXml || (await this.present(fresh?.cancelXmlAssetKey ?? null));
    if (xmlOk && cancelOk) {
      await this.markRecovered(document.id);
      return "RECOVERED";
    }
    const reason = !document.externalId
      ? "Nota sem identificador no provedor"
      : !xmlOk
        ? "Provedor nao retornou o XML da autorizacao"
        : "Provedor nao retornou o XML do cancelamento";
    await this.prisma.fiscalDocument.update({
      where: { id: document.id },
      data: { filesMissingAt: new Date(), filesMissingReason: reason },
    });
    this.audit.log("fiscal.files.missing", { tenantId: document.tenantId, documentId: document.id, reason }, "warn");
    return "MISSING";
  }

  private async present(key: string | null): Promise<boolean> {
    if (!key) return false;
    try {
      return await this.storage.exists(key);
    } catch {
      return false;
    }
  }

  private async markRecovered(documentId: string): Promise<void> {
    await this.prisma.fiscalDocument.update({
      where: { id: documentId },
      data: { filesMissingAt: null, filesMissingReason: null },
    });
  }

  private logCompleted(
    tenantId: string,
    counts: { checked: number; recovered: number; missing: number },
    startedAt: number,
    nextAfterId: string | null
  ): void {
    this.audit.log("fiscal.files.recovery_completed", {
      tenantId,
      ...counts,
      durationMs: Date.now() - startedAt,
      hasMore: Boolean(nextAfterId),
    });
  }
}
