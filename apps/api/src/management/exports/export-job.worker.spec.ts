import { Logger } from "@nestjs/common";
import { ExportContext, ExportFormat, ExportJobStatus } from "@prisma/client";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportJobWorker } from "./export-job.worker";

describe("ExportJobWorker", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(join(process.cwd(), "tmp", "exports", "tenant-1"), {
      force: true,
      recursive: true,
    });
  });

  it.each([
    [ExportFormat.CSV, ".csv", "text/csv; charset=utf-8"],
    [ExportFormat.PDF, ".pdf", "application/pdf"],
    [
      ExportFormat.XLSX,
      ".xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  ] as Array<[ExportFormat, string, string]>)(
    "generates %s export files and completion notifications",
    async (format, extension, mime) => {
      const prisma = createPrismaMock(exportJob({ format }));
      const notifications = { create: vi.fn().mockResolvedValue(null) };
      const registry = {
        get: vi.fn().mockReturnValue({
          build: vi.fn().mockResolvedValue({
            title: "Contas a pagar",
            columns: [
              { key: "description", label: "Conta" },
              { key: "expectedAmount", label: "Previsto" },
            ],
            rows: [{ description: "Compra de insumos", expectedAmount: "120.00" }],
          }),
        }),
      };
      const worker = new ExportJobWorker(
        prisma as never,
        registry as never,
        notifications as never
      );

      await worker.process("export-1");

      expect(prisma.exportJob.update).toHaveBeenCalledWith({
        where: { id: "export-1" },
        data: expect.objectContaining({ status: ExportJobStatus.PROCESSING }),
      });
      expect(prisma.exportJob.update).toHaveBeenLastCalledWith({
        where: { id: "export-1" },
        data: expect.objectContaining({
          status: ExportJobStatus.COMPLETED,
          fileName: expect.stringContaining(extension),
          fileMimeType: mime,
          fileStorageKey: expect.stringContaining("tenant-1/export-1/"),
          fileSizeBytes: expect.any(Number),
        }),
      });
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          recipientUserId: "user-1",
          severity: "SUCCESS",
          actionUrl: "/api/admin/exports/export-1/download",
        })
      );

      const completed = prisma.exportJob.update.mock.calls.at(-1)?.[0].data as {
        fileStorageKey: string;
      };
      const file = await readFile(join(process.cwd(), "tmp", "exports", completed.fileStorageKey));
      expect(file.byteLength).toBeGreaterThan(0);
    }
  );

  it("marks job as failed and emits a safe failure notification", async () => {
    const prisma = createPrismaMock(exportJob());
    const notifications = { create: vi.fn().mockResolvedValue(null) };
    const registry = {
      get: vi.fn().mockReturnValue({
        build: vi.fn().mockRejectedValue(new Error("database stack trace")),
      }),
    };
    const worker = new ExportJobWorker(prisma as never, registry as never, notifications as never);

    await worker.process("export-1");

    expect(prisma.exportJob.update).toHaveBeenLastCalledWith({
      where: { id: "export-1" },
      data: expect.objectContaining({
        status: ExportJobStatus.FAILED,
        errorMessage: "Nao foi possivel gerar a exportacao.",
      }),
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "ERROR",
        message: "Nao foi possivel gerar a exportacao.",
      })
    );
  });

  it("renders PDF exports with a readable table layout", async () => {
    const prisma = createPrismaMock(exportJob({ format: ExportFormat.PDF }));
    const notifications = { create: vi.fn().mockResolvedValue(null) };
    const registry = {
      get: vi.fn().mockReturnValue({
        build: vi.fn().mockResolvedValue({
          title: "Contas a pagar",
          columns: [
            { key: "description", label: "Conta" },
            { key: "supplierName", label: "Fornecedor" },
            { key: "expectedAmount", label: "Previsto" },
          ],
          rows: [
            {
              description: "Pao de acucar",
              supplierName: "Prestador de Servico",
              expectedAmount: "120.00",
            },
          ],
        }),
      }),
    };
    const worker = new ExportJobWorker(prisma as never, registry as never, notifications as never);

    await worker.process("export-1");

    const completed = prisma.exportJob.update.mock.calls.at(-1)?.[0].data as {
      fileStorageKey: string;
    };
    const file = await readFile(join(process.cwd(), "tmp", "exports", completed.fileStorageKey));
    const pdfContent = file.toString("utf8");

    expect(pdfContent).toContain("/MediaBox [0 0 842 595]");
    expect(pdfContent).toContain("/WinAnsiEncoding");
    expect(pdfContent).toContain(`<${pdfHex("Contas a pagar")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Conta")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Fornecedor")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Previsto")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Prestador de Servico")}> Tj`);
    expect(pdfContent).not.toContain("Conta | Fornecedor | Previsto");
  });
});

function pdfHex(value: string): string {
  return Buffer.from(value, "latin1").toString("hex").toUpperCase();
}

function createPrismaMock(job: ReturnType<typeof exportJob>) {
  return {
    exportJob: {
      findUnique: vi.fn().mockResolvedValue(job),
      update: vi.fn().mockResolvedValue(job),
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
    filtersSnapshot: {},
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
