import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExportContext, ExportJobStatus, Prisma } from "@prisma/client";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { CreateExportJobDto } from "./dto/export-job.dto";
import { ExportJobWorker } from "./export-job.worker";

const exportStorageRoot = join(process.cwd(), "tmp", "exports");

@Injectable()
export class ExportJobService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExportJobWorker) private readonly exportJobWorker: ExportJobWorker
  ) {}

  async create(user: AuthUser, dto: CreateExportJobDto) {
    this.assertSupportedContext(dto.context);

    const job = await this.prisma.exportJob.create({
      data: {
        tenantId: user.tenantId,
        requestedByUserId: user.id,
        context: dto.context,
        format: dto.format,
        filtersSnapshot: dto.filters as Prisma.InputJsonObject,
        columnsSnapshot: dto.columns ? dto.columns : Prisma.JsonNull,
      },
    });

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

    const absolutePath = join(exportStorageRoot, job.fileStorageKey);

    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException("Arquivo de exportacao nao encontrado");
    }

    return {
      absolutePath,
      fileName: job.fileName,
      mimeType: job.fileMimeType,
    };
  }

  private assertSupportedContext(context: ExportContext) {
    if (context !== ExportContext.PAYABLES) {
      throw new BadRequestException("Contexto de exportacao nao suportado");
    }
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
      downloadUrl:
        job.status === ExportJobStatus.COMPLETED ? `/api/admin/exports/${job.id}/download` : null,
    };
  }
}
