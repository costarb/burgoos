import { ConflictException, NotFoundException } from "@nestjs/common";
import { ExportContext, ExportFormat, ExportJobStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { AuthUser } from "../../platform/auth/auth.types";
import { ExportJobService } from "./export-job.service";

describe("ExportJobService", () => {
  it("accepts a job with filter snapshot and dispatches background processing", async () => {
    const prisma = createPrismaMock();
    const worker = { process: vi.fn().mockResolvedValue(undefined) };
    const service = new ExportJobService(prisma as never, worker as never);

    const response = await service.create(user(), {
      context: ExportContext.PAYABLES,
      format: ExportFormat.CSV,
      filters: { categoryId: "category-1" },
    });

    expect(prisma.exportJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        requestedByUserId: "user-1",
        context: ExportContext.PAYABLES,
        format: ExportFormat.CSV,
        filtersSnapshot: { categoryId: "category-1" },
      }),
    });
    expect(worker.process).toHaveBeenCalledWith("export-1");
    expect(response).toEqual(expect.objectContaining({ id: "export-1", status: "PENDING" }));
  });

  it("enqueues and links a durable export using a stable fingerprint", async () => {
    const prisma = createPrismaMock({ findFirst: null });
    const enqueue = vi.fn().mockResolvedValue({ id: "background-1", targetId: "export-1" });
    const service = new ExportJobService(
      prisma as never,
      { process: vi.fn() } as never,
      { enqueue } as never,
      { get: vi.fn().mockReturnValue("true") } as never,
    );

    const response = await service.create(user(), {
      context: ExportContext.PAYABLES,
      format: ExportFormat.CSV,
      filters: { status: "OPEN", categoryId: "category-1" },
    });

    const fingerprint = prisma.exportJob.create.mock.calls[0][0].data.fingerprint;
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-1",
      type: "EXPORT",
      targetId: "export-1",
      dedupeKey: fingerprint,
      payload: {},
    }));
    expect(prisma.exportJob.update).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { backgroundJobId: "background-1" },
    });
    expect(response.id).toBe("export-1");
  });

  it("reuses an active export with the same canonical request", async () => {
    const active = exportJob({ id: "active-export" });
    const prisma = createPrismaMock({ findFirst: active });
    const enqueue = vi.fn();
    const service = new ExportJobService(
      prisma as never,
      { process: vi.fn() } as never,
      { enqueue } as never,
      { get: vi.fn().mockReturnValue("true") } as never,
    );

    const response = await service.create(user(), {
      context: ExportContext.PAYABLES,
      format: ExportFormat.CSV,
      filters: { categoryId: "category-1" },
    });

    expect(response.id).toBe("active-export");
    expect(prisma.exportJob.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("only returns jobs scoped to the requesting tenant and user", async () => {
    const prisma = createPrismaMock({ findFirst: null });
    const service = new ExportJobService(prisma as never, { process: vi.fn() } as never);

    await expect(service.get("tenant-1", "user-1", "other-export")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.exportJob.findFirst).toHaveBeenCalledWith({
      where: { id: "other-export", tenantId: "tenant-1", requestedByUserId: "user-1" },
    });
  });

  it("blocks download until the completed job has file metadata", async () => {
    const prisma = createPrismaMock({ findFirst: exportJob({ status: ExportJobStatus.PENDING }) });
    const service = new ExportJobService(prisma as never, { process: vi.fn() } as never);

    await expect(service.getDownload("tenant-1", "user-1", "export-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("recovers a completed export from asset storage and returns a download stream", async () => {
    const prisma = createPrismaMock({
      findFirst: exportJob({
        status: ExportJobStatus.COMPLETED,
        fileStorageKey: "tenant-1/export-1/export.csv",
        fileName: "export.csv",
        fileMimeType: "text/csv; charset=utf-8",
      }),
    });
    const read = vi.fn().mockResolvedValue({
      body: Readable.from(["header\r\nvalue\r\n"]),
      contentType: "text/csv; charset=utf-8",
      contentLength: 15,
    });
    const service = new ExportJobService(
      prisma as never,
      { process: vi.fn() } as never,
      undefined,
      undefined,
      { read } as never,
    );

    const download = await service.getDownload("tenant-1", "user-1", "export-1");

    expect(read).toHaveBeenCalledWith("tenant-1/export-1/export.csv");
    expect(download).toEqual(expect.objectContaining({
      fileName: "export.csv",
      mimeType: "text/csv; charset=utf-8",
      contentLength: 15,
      body: expect.any(Readable),
    }));
  });
});

function createPrismaMock(overrides: { findFirst?: unknown } = {}) {
  return {
    exportJob: {
      create: vi.fn().mockResolvedValue(exportJob()),
      update: vi.fn().mockResolvedValue(exportJob()),
      delete: vi.fn().mockResolvedValue(exportJob()),
      findFirst: vi
        .fn()
        .mockResolvedValue(
          Object.prototype.hasOwnProperty.call(overrides, "findFirst")
            ? overrides.findFirst
            : exportJob()
        ),
    },
  };
}

function exportJob(overrides: Partial<ReturnType<typeof baseExportJob>> = {}) {
  return { ...baseExportJob(), ...overrides };
}

function baseExportJob() {
  return {
    id: "export-1",
    tenantId: "tenant-1",
    requestedByUserId: "user-1",
    context: ExportContext.PAYABLES,
    format: ExportFormat.CSV as ExportFormat,
    status: ExportJobStatus.PENDING as ExportJobStatus,
    filtersSnapshot: { categoryId: "category-1" },
    columnsSnapshot: null,
    requestedAt: new Date("2026-06-29T21:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
    fileName: null as string | null,
    fileMimeType: null as string | null,
    fileStorageKey: null as string | null,
    fileSizeBytes: null,
    expiresAt: null as Date | null,
    processedRows: 0,
    totalRows: null as number | null,
  };
}

function user(): AuthUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    role: UserRole.ADMIN,
    email: "admin@example.com",
    name: "Admin",
  };
}
