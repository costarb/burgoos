import { ExportContext } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ManagementReportExportProvider } from "./management-report-export.provider";

describe("ManagementReportExportProvider", () => {
  it("builds readable management report rows from the consolidated report", async () => {
    const service = {
      getReport: vi.fn().mockResolvedValue(reportFixture()),
    };
    const provider = new ManagementReportExportProvider(service as never);

    const job = {
      id: "export-1",
      tenantId: "tenant-1",
      requestedByUserId: "user-1",
      filtersSnapshot: { start: "2026-06-01", end: "2026-06-30" },
      columnsSnapshot: null,
    };
    const descriptor = await provider.describe(job);
    const batch = await provider.readBatch(job, null, 250);
    const dataset = { ...descriptor, rows: batch.rows };

    expect(provider.context).toBe(ExportContext.MANAGEMENT_REPORT);
    expect(service.getReport).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ start: "2026-06-01", end: "2026-06-30" })
    );
    expect(dataset.title).toBe("Relatorio gerencial 2026-06-01 a 2026-06-30");
    expect(dataset.layout).toBe("MANAGEMENT_REPORT");
    expect(dataset.metadata?.report).toEqual(reportFixture());
    expect(dataset.totalRows).toBe(dataset.rows.length);
    expect(batch.nextCursor).toBeNull();
    expect(dataset.columns.map((column) => column.label)).toEqual([
      "Secao",
      "Indicador",
      "Valor",
      "Detalhe",
    ]);
    expect(dataset.rows).toEqual(
      expect.arrayContaining([
        {
          section: "Resumo executivo",
          indicator: "Leitura gerencial",
          value: "Resumo do periodo.",
          detail: "",
        },
        {
          section: "Caixa",
          indicator: "Saldo final",
          value: "R$ 1600.00",
          detail: "",
        },
        {
          section: "Vendas",
          indicator: "Ticket medio",
          value: "R$ 500.00",
          detail: "",
        },
        {
          section: "Despesas por categoria",
          indicator: "Taxas",
          value: "R$ 300.00",
          detail: "Pago R$ 200.00 | Aberto R$ 100.00 | Vencido R$ 100.00",
        },
      ])
    );
  });
});

function reportFixture() {
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
      periodNarrative: "Resumo do periodo.",
    },
    cashFlow: {
      credits: "800.00",
      debits: "200.00",
      net: "600.00",
      finalBalance: "1600.00",
      balancesByAccount: [
        { accountId: "account-1", accountName: "Conta Caixa", balance: "1600.00" },
      ],
    },
    sales: {
      orders: 2,
      grossRevenue: "1000.00",
      netRevenue: "920.00",
      releasedAmount: "800.00",
      receivableAmount: "120.00",
      feeAmount: "80.00",
      averageTicket: "500.00",
      daily: [],
      byInstitution: [
        {
          key: "MERCADO_PAGO",
          label: "Mercado Pago",
          orders: 2,
          grossRevenue: "1000.00",
          netRevenue: "920.00",
          shareOfGrossRevenue: 1,
        },
      ],
      byPaymentMethod: [],
      byChannel: [],
    },
    payables: {
      expected: "500.00",
      paid: "200.00",
      open: "300.00",
      overdue: "100.00",
      openCount: 2,
      overdueCount: 1,
      byCategory: [
        {
          categoryId: "category-tax",
          categoryName: "Taxas",
          expected: "300.00",
          paid: "200.00",
          open: "100.00",
          overdue: "100.00",
          shareOfExpected: 0.6,
        },
      ],
    },
  };
}
