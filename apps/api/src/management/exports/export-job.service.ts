import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ExportContext, ExportJobStatus, Prisma } from "@prisma/client";
import { AuthUser } from "../../platform/auth/auth.types";
import { PrismaService } from "../../platform/database/prisma.service";
import { CreateExportJobDto } from "./dto/export-job.dto";

@Injectable()
export class ExportJobService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
