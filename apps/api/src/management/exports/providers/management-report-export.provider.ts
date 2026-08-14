import { Inject, Injectable } from "@nestjs/common";
import { ExportContext, Prisma } from "@prisma/client";
import { ManagementReportService } from "../../reports/management-report.service";
import { parseManagementReportQuery } from "../../reports/management-report.types";
import { ExportDescriptor, ExportProvider, ExportProviderJob, ExportRowBatch } from "../export-provider.registry";

const managementReportColumns = [
  { key: "section", label: "Secao" },
  { key: "indicator", label: "Indicador" },
  { key: "value", label: "Valor" },
  { key: "detail", label: "Detalhe" },
];

@Injectable()
export class ManagementReportExportProvider implements ExportProvider {
  readonly context = ExportContext.MANAGEMENT_REPORT;
  private readonly prepared = new Map<string, Awaited<ReturnType<ManagementReportService["getReport"]>>>();

  constructor(
    @Inject(ManagementReportService)
    private readonly managementReportService: ManagementReportService
  ) {}

  async describe(job: ExportProviderJob): Promise<ExportDescriptor> {
    const report = await this.loadReport(job);
    return {
      title: `Relatorio gerencial ${report.period.start} a ${report.period.end}`,
      layout: "MANAGEMENT_REPORT",
      metadata: { report },
      columns: managementReportColumns,
      totalRows: managementRows(report).length,
    };
  }

  async readBatch(
    job: ExportProviderJob,
    cursor: string | null,
    limit: number,
  ): Promise<ExportRowBatch> {
    const report = await this.loadReport(job);
    const rows = managementRows(report);
    const offset = cursor ? Number(cursor) : 0;
    const batch = rows.slice(offset, offset + limit);
    const nextOffset = offset + batch.length;
    if (nextOffset >= rows.length) this.prepared.delete(job.id);
    return { rows: batch, nextCursor: nextOffset < rows.length ? String(nextOffset) : null };
  }

  private async loadReport(job: ExportProviderJob) {
    const cached = this.prepared.get(job.id);
    if (cached) return cached;
    const filters = normalizeManagementReportFilters(job.filtersSnapshot);
    const report = await this.managementReportService.getReport(
      job.tenantId,
      parseManagementReportQuery(filters)
    );

    this.prepared.set(job.id, report);
    return report;
  }
}

function managementRows(report: Awaited<ReturnType<ManagementReportService["getReport"]>>) {
  return [
        row("Resumo executivo", "Periodo", `${report.period.start} a ${report.period.end}`),
        row("Resumo executivo", "Leitura gerencial", report.executiveSummary.periodNarrative),
        row("Resumo executivo", "Receita bruta", money(report.executiveSummary.grossRevenue)),
        row("Resumo executivo", "Receita liquida", money(report.executiveSummary.netRevenue)),
        row("Resumo executivo", "Liquido caixa", money(report.executiveSummary.cashNet)),
        row("Resumo executivo", "Saldo final", money(report.executiveSummary.finalBalance)),
        row("Resumo executivo", "Contas em aberto", money(report.executiveSummary.payablesOpen)),
        row("Resumo executivo", "Contas vencidas", money(report.executiveSummary.payablesOverdue)),
        row(
          "Resumo executivo",
          "Valores a receber",
          money(report.executiveSummary.receivableAmount)
        ),
        row("Caixa", "Creditos", money(report.cashFlow.credits)),
        row("Caixa", "Debitos", money(report.cashFlow.debits)),
        row("Caixa", "Liquido", money(report.cashFlow.net)),
        row("Caixa", "Saldo final", money(report.cashFlow.finalBalance)),
        ...report.cashFlow.balancesByAccount.map((account) =>
          row("Saldos por conta", account.accountName, money(account.balance))
        ),
        row("Vendas", "Pedidos", report.sales.orders),
        row("Vendas", "Receita bruta", money(report.sales.grossRevenue)),
        row("Vendas", "Receita liquida", money(report.sales.netRevenue)),
        row("Vendas", "Liberado/disponivel", money(report.sales.releasedAmount)),
        row("Vendas", "Valores a receber", money(report.sales.receivableAmount)),
        row("Vendas", "Taxas", money(report.sales.feeAmount)),
        row("Vendas", "Ticket medio", money(report.sales.averageTicket)),
        ...report.sales.byInstitution.map((item) =>
          row(
            "Vendas por instituicao",
            item.label,
            money(item.grossRevenue),
            `${item.orders} pedido(s)`
          )
        ),
        ...report.sales.byPaymentMethod.map((item) =>
          row("Vendas por meio", item.label, money(item.grossRevenue), `${item.orders} pedido(s)`)
        ),
        ...report.sales.byChannel.map((item) =>
          row("Vendas por canal", item.label, money(item.grossRevenue), `${item.orders} pedido(s)`)
        ),
        row("Contas a pagar", "Previsto", money(report.payables.expected)),
        row("Contas a pagar", "Pago", money(report.payables.paid)),
        row("Contas a pagar", "Em aberto", money(report.payables.open)),
        row("Contas a pagar", "Vencido", money(report.payables.overdue)),
        ...report.payables.byCategory.map((category) =>
          row(
            "Despesas por categoria",
            category.categoryName,
            money(category.expected),
            `Pago ${money(category.paid)} | Aberto ${money(category.open)} | Vencido ${money(category.overdue)}`
          )
        ),
  ];
}

function normalizeManagementReportFilters(value: Prisma.JsonValue): {
  start?: string;
  end?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  return {
    start: toOptionalString(source.start),
    end: toOptionalString(source.end),
  };
}

function row(
  section: string,
  indicator: string,
  value: string | number,
  detail = ""
): Record<string, string | number> {
  return { section, indicator, value, detail };
}

function money(value: string): string {
  return `R$ ${value}`;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
