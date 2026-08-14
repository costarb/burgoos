import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExportContext, ExportJobStatus, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { CreateExportJobDto } from "./dto/export-job.dto";
import { ExportJobWorker } from "./export-job.worker";
import { BackgroundJobService } from "../../common/background-jobs/background-job.service";
import { ASSET_STORAGE, AssetStorage } from "../../common/storage/asset-storage";

@Injectable()
export class ExportJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExportJobWorker) private readonly exportJobWorker: ExportJobWorker,
    @Optional() private readonly backgroundJobs?: BackgroundJobService,
    @Optional() private readonly config?: ConfigService,
    @Inject(ASSET_STORAGE) private readonly assetStorage?: AssetStorage,
  ) {}

  async create(user: AuthUser, dto: CreateExportJobDto) {
    this.assertSupportedContext(dto.context);
    const fingerprint = exportFingerprint(user, dto);

    if (this.durableEnabled()) {
      const active = await this.prisma.exportJob.findFirst({
        where: {
          tenantId: user.tenantId,
          requestedByUserId: user.id,
          fingerprint,
          status: { in: [ExportJobStatus.PENDING, ExportJobStatus.PROCESSING] },
        },
        orderBy: { requestedAt: "desc" },
      });
      if (active) return this.toResponse(active);
    }

    const job = await this.prisma.exportJob.create({
      data: {
        tenantId: user.tenantId,
        requestedByUserId: user.id,
        context: dto.context,
        format: dto.format,
        filtersSnapshot: dto.filters as Prisma.InputJsonObject,
        columnsSnapshot: dto.columns ? dto.columns : Prisma.JsonNull,
        fingerprint,
      },
    });

    if (this.durableEnabled()) {
      if (!this.backgroundJobs) throw new Error("Background jobs are unavailable");
      const backgroundJob = await this.backgroundJobs.enqueue({
        tenantId: user.tenantId,
        type: "EXPORT",
        priority: "LOW",
        targetType: "ExportJob",
        targetId: job.id,
        dedupeKey: fingerprint,
        payload: {},
      });
      if (backgroundJob.targetId !== job.id) {
        await this.prisma.exportJob.delete({ where: { id: job.id } });
        const existing = await this.prisma.exportJob.findFirst({
          where: {
            id: backgroundJob.targetId,
            tenantId: user.tenantId,
            requestedByUserId: user.id,
            fingerprint,
          },
        });
        if (!existing) throw new ConflictException("Exportacao equivalente em processamento");
        return this.toResponse(existing);
      }
      const linked = await this.prisma.exportJob.update({
        where: { id: job.id },
        data: { backgroundJobId: backgroundJob.id },
      });
      return this.toResponse(linked);
    }

    void this.exportJobWorker.process(job.id).catch(() => undefined);

    return this.toResponse(job);
  }

  async get(tenantId: string, requestedByUserId: string, exportId: string) {
    const job = await this.prisma.exportJob.findFirst({
      where: { id: exportId, tenantId, requestedByUserId },
    });

    if (!job) {
      throw new NotFoundException("Exportacao nao encontrada");
    }

    return this.toResponse(job);
  }

  async getDownload(tenantId: string, requestedByUserId: string, exportId: string) {
    const job = await this.prisma.exportJob.findFirst({
      where: { id: exportId, tenantId, requestedByUserId },
    });

    if (!job) {
      throw new NotFoundException("Exportacao nao encontrada");
    }

    if (
      job.status !== ExportJobStatus.COMPLETED ||
      !job.fileStorageKey ||
      !job.fileName ||
      !job.fileMimeType
    ) {
      throw new ConflictException("Exportacao ainda nao esta pronta para download");
    }

    try {
      const stored = await this.assetStorage?.read(job.fileStorageKey);
      if (!stored) throw new Error("Asset storage is unavailable");
      return {
        body: stored.body,
        contentLength: stored.contentLength,
        fileName: job.fileName,
        mimeType: stored.contentType ?? job.fileMimeType,
      };
    } catch {
      throw new NotFoundException("Arquivo de exportacao nao encontrado");
    }
  }

  private assertSupportedContext(context: ExportContext) {
    if (context !== ExportContext.PAYABLES && context !== ExportContext.MANAGEMENT_REPORT) {
      throw new BadRequestException("Contexto de exportacao nao suportado");
    }
  }

  private durableEnabled(): boolean {
    return this.config?.get<string>("EXPORT_DURABLE_JOBS_ENABLED") === "true";
  }

  private toResponse(job: {
    id: string;
    context: ExportContext;
    format: string;
    status: ExportJobStatus;
    filtersSnapshot: Prisma.JsonValue;
    columnsSnapshot: Prisma.JsonValue | null;
    requestedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    errorMessage: string | null;
    fileName: string | null;
    fileMimeType: string | null;
    fileSizeBytes: number | null;
    processedRows: number;
    totalRows: number | null;
    expiresAt: Date | null;
  }) {
    return {
      id: job.id,
      context: job.context,
      format: job.format,
      status: job.status,
      filtersSnapshot: job.filtersSnapshot,
      columnsSnapshot: Array.isArray(job.columnsSnapshot) ? job.columnsSnapshot : null,
      requestedAt: job.requestedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      failedAt: job.failedAt?.toISOString() ?? null,
      errorMessage: job.errorMessage,
      fileName: job.fileName,
      fileMimeType: job.fileMimeType,
      fileSizeBytes: job.fileSizeBytes,
      progress: {
        processedRows: job.processedRows,
        totalRows: job.totalRows,
        message: progressMessage(job.status),
      },
      expiresAt: job.expiresAt?.toISOString() ?? null,
      downloadUrl:
        job.status === ExportJobStatus.COMPLETED ? `/api/admin/exports/${job.id}/download` : null,
    };
  }
}

function progressMessage(status: ExportJobStatus): string | null {
  switch (status) {
    case ExportJobStatus.PENDING:
      return "Aguardando processamento";
    case ExportJobStatus.PROCESSING:
      return "Gerando arquivo";
    case ExportJobStatus.COMPLETED:
      return "Arquivo pronto";
    case ExportJobStatus.FAILED:
      return "Falha ao gerar arquivo";
    case ExportJobStatus.EXPIRED:
      return "Arquivo expirado";
  }
}

function exportFingerprint(user: AuthUser, dto: CreateExportJobDto): string {
  const value = stableJson({
    tenantId: user.tenantId,
    requestedByUserId: user.id,
    context: dto.context,
    format: dto.format,
    filters: dto.filters,
    columns: dto.columns ?? null,
  });
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
