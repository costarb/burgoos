import { Logger } from "@nestjs/common";
import { ExportContext, ExportFormat, ExportJobStatus } from "@prisma/client";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportJobWorker } from "./export-job.worker";
import { LocalAssetStorageService } from "../../common/storage/local-asset-storage.service";

const testAssetStorage = new LocalAssetStorageService({
  get: vi.fn((key: string) =>
    key === "ASSET_LOCAL_ROOT" ? join(process.cwd(), "tmp", "exports") : undefined
  ),
} as never);

describe("ExportJobWorker", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(join(process.cwd(), "tmp", "exports", "tenant-1"), {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 50,
    });
  });

  it("registers the durable handler and recovers pending exports in bounded pages", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      exportJob: {
        findMany: vi.fn().mockResolvedValueOnce([
          { id: "export-1", tenantId: "tenant-1", fingerprint: "fingerprint-1" },
        ]),
        update,
      },
    };
    const enqueue = vi.fn().mockResolvedValue({ id: "background-1", targetId: "export-1" });
    const register = vi.fn();
    const worker = new ExportJobWorker(
      prisma as never,
      {} as never,
      {} as never,
      { enqueue } as never,
      { register } as never,
      { get: vi.fn().mockReturnValue("true") } as never,
    );

    await worker.onModuleInit();

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ type: "EXPORT" }));
    expect(prisma.exportJob.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "EXPORT",
      targetId: "export-1",
      dedupeKey: "fingerprint-1",
    }));
    expect(update).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { backgroundJobId: "background-1" },
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
        get: vi.fn().mockReturnValue(
          providerFor({
            title: "Contas a pagar",
            columns: [
              { key: "description", label: "Conta" },
              { key: "expectedAmount", label: "Previsto" },
            ],
            rows: [{ description: "Compra de insumos", expectedAmount: "120.00" }],
          }),
        ),
      };
      const worker = new ExportJobWorker(
        prisma as never,
        registry as never,
        notifications as never,
        undefined,
        undefined,
        undefined,
        testAssetStorage,
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
        describe: vi.fn().mockRejectedValue(new Error("database stack trace")),
        readBatch: vi.fn(),
      }),
    };
    const worker = new ExportJobWorker(
      prisma as never, registry as never, notifications as never,
      undefined, undefined, undefined, testAssetStorage,
    );

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
      get: vi.fn().mockReturnValue(
        providerFor({
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
      ),
    };
    const worker = new ExportJobWorker(
      prisma as never, registry as never, notifications as never,
      undefined, undefined, undefined, testAssetStorage,
    );

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

  it("renders management report PDF with the same executive sections as the screen", async () => {
    const prisma = createPrismaMock(
      exportJob({ context: ExportContext.MANAGEMENT_REPORT, format: ExportFormat.PDF })
    );
    const notifications = { create: vi.fn().mockResolvedValue(null) };
    const registry = {
      get: vi.fn().mockReturnValue(
        providerFor({
          title: "Relatorio gerencial 2026-06-01 a 2026-06-30",
          layout: "MANAGEMENT_REPORT",
          metadata: { report: managementReportFixture() },
          columns: [],
          rows: [],
        }),
      ),
    };
    const worker = new ExportJobWorker(
      prisma as never, registry as never, notifications as never,
      undefined, undefined, undefined, testAssetStorage,
    );

    await worker.process("export-1");

    const completed = prisma.exportJob.update.mock.calls.at(-1)?.[0].data as {
      fileStorageKey: string;
    };
    const file = await readFile(join(process.cwd(), "tmp", "exports", completed.fileStorageKey));
    const pdfContent = file.toString("utf8");

    expect(pdfContent).toContain(`<${pdfHex("Resumo executivo")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Receita bruta")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Receita recebida")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Valores a receber")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Saldo atual")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("R$ 1600.00")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Caixa")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Vendas")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Receita bruta por dia")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("R$ 1.0k")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Contas a pagar")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Por instituicao")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Por meio")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Por canal")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Despesas por categoria")}> Tj`);
    expect(pdfContent).toContain(`<${pdfHex("Mercado Pago")}> Tj`);
    expect(pdfContent).not.toContain("Secao | Indicador | Valor");
  });

  it("reads CSV rows in cursor batches using the configured batch size", async () => {
    const prisma = createPrismaMock(exportJob());
    const readBatch = vi.fn()
      .mockResolvedValueOnce({ rows: [{ value: "one" }], nextCursor: "cursor-1" })
      .mockResolvedValueOnce({ rows: [{ value: "two" }], nextCursor: null });
    const registry = {
      get: vi.fn().mockReturnValue({
        describe: vi.fn().mockResolvedValue({
          title: "Cursor export",
          columns: [{ key: "value", label: "Value" }],
          totalRows: 2,
        }),
        readBatch,
      }),
    };
    const worker = new ExportJobWorker(
      prisma as never,
      registry as never,
      { create: vi.fn().mockResolvedValue(null) } as never,
      undefined,
      undefined,
      { get: vi.fn().mockReturnValue(1) } as never,
      testAssetStorage,
    );

    await worker.process("export-1");

    expect(readBatch).toHaveBeenNthCalledWith(1, expect.anything(), null, 1);
    expect(readBatch).toHaveBeenNthCalledWith(2, expect.anything(), "cursor-1", 1);
  });

  it.each([
    [ExportFormat.PDF, 1_001],
    [ExportFormat.XLSX, 50_001],
  ])("rejects %s exports above the row limit before reading rows", async (format, totalRows) => {
    const prisma = createPrismaMock(exportJob({ format }));
    const readBatch = vi.fn();
    const registry = {
      get: vi.fn().mockReturnValue({
        describe: vi.fn().mockResolvedValue({ title: "Large", columns: [], totalRows }),
        readBatch,
      }),
    };
    const worker = new ExportJobWorker(
      prisma as never,
      registry as never,
      { create: vi.fn().mockResolvedValue(null) } as never,
      undefined,
      undefined,
      undefined,
      testAssetStorage,
    );

    await worker.process("export-1");

    expect(readBatch).not.toHaveBeenCalled();
    expect(prisma.exportJob.update).toHaveBeenLastCalledWith({
      where: { id: "export-1" },
      data: expect.objectContaining({ status: ExportJobStatus.FAILED }),
    });
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

function providerFor(dataset: {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null>>;
  layout?: "MANAGEMENT_REPORT";
  metadata?: Record<string, unknown>;
}) {
  return {
    describe: vi.fn().mockResolvedValue({
      title: dataset.title,
      columns: dataset.columns,
      layout: dataset.layout,
      metadata: dataset.metadata,
      totalRows: dataset.rows.length,
    }),
    readBatch: vi.fn().mockResolvedValue({ rows: dataset.rows, nextCursor: null }),
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
    context: ExportContext.PAYABLES as ExportContext,
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

function managementReportFixture() {
  return {
    period: { start: "2026-06-01", end: "2026-06-30" },
    executiveSummary: {
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      cashNet: "600.00",
      finalBalance: "1600.00",
      payablesOpen: "300.00",
      payablesOverdue: "100.00",
      receivableAmount: "120.00",
      periodNarrative:
        "No periodo de 2026-06-01 a 2026-06-30, a operacao registrou receita liquida.",
    },
    cashFlow: {
      credits: "800.00",
      debits: "200.00",
      net: "600.00",
      finalBalance: "1600.00",
      balancesByAccount: [{ accountName: "Conta Caixa", balance: "1600.00" }],
    },
    sales: {
      orders: 2,
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      releasedAmount: "800.00",
      receivableAmount: "120.00",
      feeAmount: "80.00",
      averageTicket: "500.00",
      daily: [{ date: "2026-06-01", orders: 2, grossRevenue: "1000.00", netRevenue: "920.00" }],
      byInstitution: [{ label: "Mercado Pago", orders: 2, grossRevenue: "1000.00" }],
      byPaymentMethod: [{ label: "Pix", orders: 2, grossRevenue: "1000.00" }],
      byChannel: [{ label: "Balcao", orders: 2, grossRevenue: "1000.00" }],
    },
    payables: {
      expected: "500.00",
      paid: "200.00",
      open: "300.00",
      overdue: "100.00",
      byCategory: [
        {
          categoryName: "Taxas",
          expected: "300.00",
          paid: "200.00",
          open: "100.00",
          overdue: "100.00",
        },
      ],
    },
  };
}
