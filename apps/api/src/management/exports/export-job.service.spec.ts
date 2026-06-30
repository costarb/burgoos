import { ConflictException, NotFoundException } from "@nestjs/common";
import { ExportContext, ExportFormat, ExportJobStatus, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
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
});

function createPrismaMock(overrides: { findFirst?: unknown } = {}) {
  return {
    exportJob: {
      create: vi.fn().mockResolvedValue(exportJob()),
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
    status: ExportJobStatus.PENDING,
    filtersSnapshot: { categoryId: "category-1" },
    columnsSnapshot: null,
    requestedAt: new Date("2026-06-29T21:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
    fileName: null,
    fileMimeType: null,
    fileStorageKey: null,
    fileSizeBytes: null,
    expiresAt: null,
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
