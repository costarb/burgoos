import { Inject, Injectable, Logger } from "@nestjs/common";
import { ExportFormat, ExportJobStatus, OperationalNotificationSeverity } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../../platform/database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ExportDataset, ExportProviderRegistry } from "./export-provider.registry";

const exportStorageRoot = join(process.cwd(), "tmp", "exports");

@Injectable()
export class ExportJobWorker {
  private readonly logger = new Logger(ExportJobWorker.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExportProviderRegistry) private readonly providerRegistry: ExportProviderRegistry,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  async process(exportId: string): Promise<void> {
    const job = await this.prisma.exportJob.findUnique({ where: { id: exportId } });

    if (!job || job.status !== ExportJobStatus.PENDING) {
      return;
    }

    try {
      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: { status: ExportJobStatus.PROCESSING, startedAt: new Date(), errorMessage: null },
      });

      const provider = this.providerRegistry.get(job.context);

      if (!provider) {
        throw new Error("Contexto de exportacao nao suportado");
      }

      const dataset = await provider.build(job);
      const file = renderExportFile(dataset, job.format);
      const storageKey = `${job.tenantId}/${job.id}/${file.fileName}`;
      const absolutePath = join(exportStorageRoot, storageKey);

      await mkdir(join(exportStorageRoot, job.tenantId, job.id), { recursive: true });
      await writeFile(absolutePath, file.content);

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportJobStatus.COMPLETED,
          completedAt: new Date(),
          fileName: file.fileName,
          fileMimeType: file.mimeType,
          fileStorageKey: storageKey,
          fileSizeBytes: file.content.byteLength,
          expiresAt: addDays(new Date(), 7),
        },
      });

      await this.notificationsService.create({
        tenantId: job.tenantId,
        recipientUserId: job.requestedByUserId,
        type: "PAYABLE_EXPORT_COMPLETED",
        severity: OperationalNotificationSeverity.SUCCESS,
        title: "Exportacao concluida",
        message: `O arquivo ${file.fileName} esta pronto para download.`,
        actionLabel: "Baixar arquivo",
        actionUrl: `/api/admin/exports/${job.id}/download`,
        relatedEntityType: "export_job",
        relatedEntityId: job.id,
        exportJobId: job.id,
      });
    } catch (error) {
      const message = "Nao foi possivel gerar a exportacao.";

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportJobStatus.FAILED,
          failedAt: new Date(),
          errorMessage: message,
        },
      });

      await this.notificationsService.create({
        tenantId: job.tenantId,
        recipientUserId: job.requestedByUserId,
        type: "PAYABLE_EXPORT_FAILED",
        severity: OperationalNotificationSeverity.ERROR,
        title: "Exportacao nao concluida",
        message,
        relatedEntityType: "export_job",
        relatedEntityId: job.id,
        exportJobId: job.id,
      });

      this.logger.error(
        `Export job ${job.id} failed`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}

interface RenderedExportFile {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

function renderExportFile(dataset: ExportDataset, format: ExportFormat): RenderedExportFile {
  const baseName = slugify(dataset.title);

  if (format === ExportFormat.CSV) {
    return {
      fileName: `${baseName}.csv`,
      mimeType: "text/csv; charset=utf-8",
      content: Buffer.from(renderCsv(dataset), "utf8"),
    };
  }

  if (format === ExportFormat.PDF) {
    return {
      fileName: `${baseName}.pdf`,
      mimeType: "application/pdf",
      content: renderPdf(dataset),
    };
  }

  return {
    fileName: `${baseName}.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: renderXlsx(dataset),
  };
}

function renderCsv(dataset: ExportDataset): string {
  const lines = [
    dataset.columns.map((column) => csvCell(column.label)).join(","),
    ...dataset.rows.map((row) =>
      dataset.columns.map((column) => csvCell(row[column.key] ?? "")).join(",")
    ),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string | number | null): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderPdf(dataset: ExportDataset): Buffer {
  if (dataset.layout === "MANAGEMENT_REPORT") {
    const report = dataset.metadata?.report;

    if (isManagementReportPdf(report)) {
      return renderManagementReportPdf(dataset.title, report);
    }
  }

  const page = { width: 842, height: 595, margin: 28 };
  const availableWidth = page.width - page.margin * 2;
  const visibleColumns = dataset.columns.slice(0, 8);
  const columnWidths = calculatePdfColumnWidths(visibleColumns, availableWidth);
  const rowHeight = 17;
  const headerY = 500;
  const maxRows = Math.max(Math.floor((headerY - page.margin) / rowHeight) - 2, 1);
  const tableHeight = 24 + rowHeight * Math.min(dataset.rows.length, maxRows);
  const stream: string[] = [
    "0.98 0.98 0.98 rg",
    `0 0 ${page.width} ${page.height} re f`,
    "0.12 0.16 0.22 rg",
    `${page.margin} 548 ${availableWidth} 1.2 re f`,
    "0.93 0.95 0.97 rg",
    `${page.margin} ${headerY - 6} ${availableWidth} 24 re f`,
    "0.78 0.82 0.88 RG",
    `${page.margin} ${headerY - tableHeight + 18} ${availableWidth} ${tableHeight} re S`,
  ];

  stream.push(...pdfTextAt(dataset.title, page.margin, 560, 16, true));
  stream.push(...pdfTextAt(`Gerado em ${formatPdfDate(new Date())}`, page.margin, 532, 8));

  visibleColumns.forEach((column, index) => {
    const x = page.margin + sumBefore(columnWidths, index);
    stream.push(
      ...pdfTextAt(
        truncatePdfText(column.label, Math.floor(columnWidths[index] / 4.8)),
        x + 5,
        headerY,
        7,
        true
      )
    );
  });

  dataset.rows.slice(0, maxRows).forEach((row, rowIndex) => {
    const y = headerY - 22 - rowIndex * rowHeight;

    if (rowIndex % 2 === 1) {
      stream.push(
        "0.97 0.98 0.99 rg",
        `${page.margin} ${y - 5} ${availableWidth} ${rowHeight} re f`
      );
    }

    stream.push("0.86 0.89 0.93 rg", `${page.margin} ${y - 6} ${availableWidth} 0.4 re f`);

    visibleColumns.forEach((column, columnIndex) => {
      const x = page.margin + sumBefore(columnWidths, columnIndex);
      stream.push(
        ...pdfTextAt(
          truncatePdfText(
            String(row[column.key] ?? ""),
            Math.floor(columnWidths[columnIndex] / 4.5)
          ),
          x + 5,
          y,
          7
        )
      );
    });
  });

  if (dataset.rows.length > maxRows) {
    stream.push(
      ...pdfTextAt(
        `Exibindo ${maxRows} de ${dataset.rows.length} registros neste arquivo.`,
        page.margin,
        page.margin,
        8
      )
    );
  }

  return buildPdf(stream.join("\n"), page);
}

interface ManagementReportPdf {
  period: { start: string; end: string };
  executiveSummary: {
    grossRevenue: string;
    netRevenue: string;
    cashNet: string;
    finalBalance: string;
    periodNarrative: string;
  };
  cashFlow: {
    credits: string;
    debits: string;
    net: string;
    finalBalance: string;
    balancesByAccount: Array<{ accountName: string; balance: string }>;
  };
  sales: {
    orders: number;
    grossRevenue: string;
    netRevenue: string;
    releasedAmount: string;
    receivableAmount: string;
    feeAmount: string;
    averageTicket: string;
    daily: Array<{ date: string; orders: number; grossRevenue: string; netRevenue: string }>;
    byInstitution: ManagementSalesPdfGroup[];
    byPaymentMethod: ManagementSalesPdfGroup[];
    byChannel: ManagementSalesPdfGroup[];
  };
  payables: {
    expected: string;
    paid: string;
    open: string;
    overdue: string;
    byCategory: Array<{
      categoryName: string;
      expected: string;
      paid: string;
      open: string;
      overdue: string;
    }>;
  };
}

interface ManagementSalesPdfGroup {
  label: string;
  orders: number;
  grossRevenue: string;
}

function renderManagementReportPdf(title: string, report: ManagementReportPdf): Buffer {
  const page = { width: 842, height: 595, margin: 28 };
  const contentWidth = page.width - page.margin * 2;
  const panelGap = 12;
  const panelWidth = (contentWidth - panelGap * 2) / 3;
  const pageOne: string[] = [
    "0.98 0.98 0.98 rg",
    `0 0 ${page.width} ${page.height} re f`,
    "0.12 0.16 0.22 rg",
    `${page.margin} 548 ${contentWidth} 1.2 re f`,
  ];

  pageOne.push(...pdfTextAt(title, page.margin, 563, 16, true));
  pageOne.push(
    ...pdfTextAt(
      `Periodo: ${report.period.start} a ${report.period.end} | Gerado em ${formatPdfDate(new Date())}`,
      page.margin,
      538,
      8
    )
  );

  const topSummary = buildPdfTopSummary(report);

  drawMetricCards(pageOne, page.margin, 489, contentWidth, [
    ["Receita liquida", money(topSummary.netRevenue)],
    ["Despesas pagas", money(topSummary.paidExpenses)],
    ["Saldo atual", money(topSummary.currentBalance)],
    ["Despesas a realizar", money(topSummary.pendingExpenses)],
    ["Saldo futuro", money(topSummary.futureBalance)],
  ]);

  pageOne.push(...pdfTextAt("Resumo executivo", page.margin, 474, 9, true));
  drawTextBlock(
    pageOne,
    report.executiveSummary.periodNarrative,
    page.margin,
    462,
    contentWidth,
    8
  );

  const fullPanelWidth = contentWidth;
  const salesY = 316;
  drawPanel(pageOne, page.margin, salesY, fullPanelWidth, 118, "Vendas");
  drawCompactMetrics(
    pageOne,
    page.margin + 10,
    salesY + 78,
    250,
    [
      ["Pedidos", String(report.sales.orders)],
      ["Receita bruta", money(report.sales.grossRevenue)],
      ["Receita liquida", money(report.sales.netRevenue)],
      ["Disponivel", money(report.sales.releasedAmount)],
      ["A receber", money(report.sales.receivableAmount)],
      ["Taxas", money(report.sales.feeAmount)],
      ["Ticket medio", money(report.sales.averageTicket)],
    ],
    { columns: 3, rowGap: 22, valueMaxLength: 12 }
  );
  drawLineChart(
    pageOne,
    "Receita bruta por dia",
    report.sales.daily.map((day) => [day.date.slice(5), Number(day.grossRevenue)]),
    page.margin + 286,
    salesY + 16,
    contentWidth - 306,
    68
  );

  const groupY = 92;
  const middleGroupX = page.margin + panelWidth + panelGap;
  const rightGroupX = middleGroupX + panelWidth + panelGap;

  drawPanel(pageOne, page.margin, groupY, panelWidth, 180, "Por instituicao");
  drawSalesGroup(
    pageOne,
    report.sales.byInstitution,
    page.margin + 10,
    groupY + 18,
    panelWidth - 20
  );

  drawPanel(pageOne, middleGroupX, groupY, panelWidth, 180, "Por meio");
  drawSalesGroup(
    pageOne,
    report.sales.byPaymentMethod,
    middleGroupX + 10,
    groupY + 18,
    panelWidth - 20
  );

  drawPanel(pageOne, rightGroupX, groupY, panelWidth, 180, "Por canal");
  drawSalesGroup(pageOne, report.sales.byChannel, rightGroupX + 10, groupY + 18, panelWidth - 20);

  const pageTwo = [
    "0.98 0.98 0.98 rg",
    `0 0 ${page.width} ${page.height} re f`,
    "0.12 0.16 0.22 rg",
    `${page.margin} 548 ${contentWidth} 1.2 re f`,
    ...pdfTextAt(title, page.margin, 563, 14, true),
    ...pdfTextAt("Contas a pagar e caixa", page.margin, 532, 10, true),
  ];
  const payablesY = 360;
  drawPanel(pageTwo, page.margin, payablesY, fullPanelWidth, 126, "Contas a pagar");
  drawCompactMetrics(pageTwo, page.margin + 10, payablesY + 84, 250, [
    ["Previsto", money(report.payables.expected)],
    ["Pago", money(report.payables.paid)],
    ["Em aberto", money(report.payables.open)],
    ["Vencido", money(report.payables.overdue)],
  ]);
  drawBars(
    pageTwo,
    "Despesas por categoria",
    report.payables.byCategory.map((category) => [
      `${category.categoryName} (${money(category.open)} aberto)`,
      Number(category.expected),
    ]),
    page.margin + 286,
    payablesY + 20,
    contentWidth - 306,
    5
  );

  const cashY = 210;
  drawPanel(pageTwo, page.margin, cashY, fullPanelWidth, 126, "Caixa");
  drawCompactMetrics(pageTwo, page.margin + 10, cashY + 84, 250, [
    ["Creditos", money(report.cashFlow.credits)],
    ["Debitos", money(report.cashFlow.debits)],
    ["Liquido", money(report.cashFlow.net)],
    ["Saldo final", money(report.cashFlow.finalBalance)],
  ]);
  drawList(
    pageTwo,
    "Saldos por conta",
    report.cashFlow.balancesByAccount.map((account) => [
      account.accountName,
      money(account.balance),
    ]),
    page.margin + 286,
    cashY + 18,
    contentWidth - 306,
    5
  );

  return buildPdfPages([pageOne.join("\n"), pageTwo.join("\n")], page);
}

function drawMetricCards(
  stream: string[],
  x: number,
  y: number,
  width: number,
  cards: Array<[string, string]>
) {
  const gap = 10;
  const cardWidth = (width - gap * (cards.length - 1)) / cards.length;

  cards.forEach(([label, value], index) => {
    const cardX = x + index * (cardWidth + gap);
    stream.push(
      "1 1 1 rg",
      `${cardX} ${y} ${cardWidth} 42 re f`,
      "0.82 0.86 0.9 RG",
      `${cardX} ${y} ${cardWidth} 42 re S`
    );
    stream.push(...pdfTextAt(label, cardX + 8, y + 26, 7, true));
    stream.push(...pdfTextAt(value, cardX + 8, y + 10, 13, true));
  });
}

function drawPanel(
  stream: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
) {
  stream.push(
    "1 1 1 rg",
    `${x} ${y} ${width} ${height} re f`,
    "0.82 0.86 0.9 RG",
    `${x} ${y} ${width} ${height} re S`
  );
  stream.push(...pdfTextAt(title, x + 10, y + height - 18, 11, true));
}

function drawCompactMetrics(
  stream: string[],
  x: number,
  y: number,
  width: number,
  metrics: Array<[string, string]>,
  options: { columns?: number; rowGap?: number; valueMaxLength?: number } = {}
) {
  const columns = options.columns ?? 2;
  const rowGap = options.rowGap ?? 26;
  const valueMaxLength = options.valueMaxLength ?? 18;
  const columnWidth = width / columns;

  metrics.slice(0, 8).forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const metricX = x + column * columnWidth;
    const metricY = y - row * rowGap;
    stream.push(...pdfTextAt(truncatePdfText(label, 16), metricX, metricY, 5.6, true));
    stream.push(...pdfTextAt(truncatePdfText(value, valueMaxLength), metricX, metricY - 11, 7.2));
  });
}

function drawList(
  stream: string[],
  title: string,
  rows: Array<[string, string]>,
  x: number,
  y: number,
  width: number,
  maxRows: number
) {
  stream.push(...pdfTextAt(title, x, y + maxRows * 14 + 12, 7, true));

  if (rows.length === 0) {
    stream.push(...pdfTextAt("Sem dados no periodo.", x, y + maxRows * 14 - 2, 7));
    return;
  }

  rows.slice(0, maxRows).forEach(([label, value], index) => {
    const rowY = y + (maxRows - index - 1) * 14;
    stream.push(...pdfTextAt(truncatePdfText(label, 28), x, rowY, 7));
    stream.push(...pdfTextAt(truncatePdfText(value, 14), x + width - 58, rowY, 7, true));
  });
}

function drawBars(
  stream: string[],
  title: string,
  rows: Array<[string, number]>,
  x: number,
  y: number,
  width: number,
  maxRows: number
) {
  const max = Math.max(...rows.map(([, value]) => value), 0);
  stream.push(...pdfTextAt(title, x, y + maxRows * 14 + 12, 7, true));

  if (rows.length === 0 || max === 0) {
    stream.push(...pdfTextAt("Sem dados no periodo.", x, y + maxRows * 14 - 2, 7));
    return;
  }

  const labelWidth = 76;
  const valueWidth = 56;
  const barStartX = x + labelWidth;
  const valueX = x + width - valueWidth;
  const barMaxWidth = Math.max(valueX - barStartX - 8, 16);

  rows.slice(0, maxRows).forEach(([label, value], index) => {
    const rowY = y + (maxRows - index - 1) * 14;
    const barWidth = Math.max(6, (value / max) * barMaxWidth);
    stream.push(...pdfTextAt(truncatePdfText(label, 18), x, rowY, 5.6));
    stream.push("0.93 0.95 0.97 rg", `${barStartX} ${rowY - 2} ${barMaxWidth} 5 re f`);
    stream.push("0.9 0.28 0.2 rg", `${barStartX} ${rowY - 2} ${barWidth} 5 re f`);
    stream.push(...pdfTextAt(`R$ ${value.toFixed(2)}`, valueX, rowY, 5.6));
  });
}

function drawLineChart(
  stream: string[],
  title: string,
  rows: Array<[string, number]>,
  x: number,
  y: number,
  width: number,
  height: number
) {
  stream.push(...pdfTextAt(title, x, y + height + 14, 7, true));

  const nonZeroRows = rows.filter(([, value]) => value > 0);

  if (nonZeroRows.length === 0) {
    stream.push(...pdfTextAt("Sem vendas no periodo.", x, y + height / 2, 7));
    return;
  }

  const visibleRows = sampleChartRows(rows, 10);
  const max = Math.max(...visibleRows.map(([, value]) => value), 0);
  const axisY = y + 16;
  const chartHeight = height - 20;
  const step = visibleRows.length > 1 ? width / (visibleRows.length - 1) : width;
  const points = visibleRows.map(([label, value], index) => ({
    label,
    value,
    x: x + index * step,
    y: axisY + (max === 0 ? 0 : (value / max) * chartHeight),
  }));

  stream.push("0.86 0.89 0.93 RG", `${x} ${axisY} ${width} 0.6 re S`);

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    stream.push(
      "0.9 0.28 0.2 RG",
      "1.4 w",
      `${current.x} ${current.y} m ${next.x} ${next.y} l S`,
      "1 w"
    );
  }

  points.forEach((point) => {
    stream.push("0.9 0.28 0.2 rg", `${point.x - 2} ${point.y - 2} 4 4 re f`);
    stream.push(...pdfTextAt(formatCompactMoney(point.value), point.x - 14, point.y + 7, 5));
    stream.push(...pdfTextAt(point.label, point.x - 9, y, 5));
  });
}

function sampleChartRows(
  rows: Array<[string, number]>,
  maxPoints: number
): Array<[string, number]> {
  if (rows.length <= maxPoints) {
    return rows;
  }

  const step = (rows.length - 1) / (maxPoints - 1);
  const sampled = Array.from({ length: maxPoints }, (_, index) => rows[Math.round(index * step)]);
  return sampled.filter(
    (row, index) => sampled.findIndex((candidate) => candidate[0] === row[0]) === index
  );
}

function formatCompactMoney(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }

  return `R$ ${value.toFixed(0)}`;
}

function drawSalesGroup(
  stream: string[],
  rows: ManagementSalesPdfGroup[],
  x: number,
  y: number,
  width: number
) {
  if (rows.length === 0) {
    stream.push(...pdfTextAt("Sem dados no periodo.", x, y + 126, 7));
    return;
  }

  rows.slice(0, 6).forEach((row, index) => {
    const rowY = y + (5 - index) * 22;
    stream.push(...pdfTextAt(truncatePdfText(row.label, 26), x, rowY + 8, 7, true));
    stream.push(...pdfTextAt(`${row.orders} pedido(s)`, x, rowY - 3, 6));
    stream.push(...pdfTextAt(money(row.grossRevenue), x + width - 62, rowY + 4, 7, true));
  });
}

function drawTextBlock(
  stream: string[],
  value: string,
  x: number,
  y: number,
  width: number,
  size: number
) {
  wrapPdfText(value, Math.floor(width / (size * 0.58)))
    .slice(0, 2)
    .forEach((line, index) => {
      stream.push(...pdfTextAt(line, x, y - index * 11, size));
    });
}

function wrapPdfText(value: string, maxLength: number): string[] {
  const lines: string[] = [];
  let current = "";

  value.split(/\s+/).forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function isManagementReportPdf(value: unknown): value is ManagementReportPdf {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<ManagementReportPdf>;
  return Boolean(
    report.period && report.executiveSummary && report.cashFlow && report.sales && report.payables
  );
}

function money(value: string): string {
  return `R$ ${value}`;
}

function buildPdfTopSummary(report: ManagementReportPdf) {
  const netRevenue = Number(report.sales.netRevenue);
  const paidExpenses = Number(report.payables.paid);
  const pendingExpenses = Number(report.payables.open);
  const currentBalance = Number(report.cashFlow.finalBalance);
  const futureBalance = currentBalance - pendingExpenses;

  return {
    netRevenue: moneyString(netRevenue),
    paidExpenses: moneyString(paidExpenses),
    currentBalance: moneyString(currentBalance),
    pendingExpenses: moneyString(pendingExpenses),
    futureBalance: moneyString(futureBalance),
  };
}

function moneyString(value: number): string {
  return value.toFixed(2);
}

function calculatePdfColumnWidths(
  columns: ExportDataset["columns"],
  availableWidth: number
): number[] {
  if (columns.length === 0) {
    return [availableWidth];
  }

  const preferred = columns.map((column) => {
    const label = column.label.toLowerCase();

    if (label.includes("conta")) return 170;
    if (label.includes("categoria")) return 90;
    if (label.includes("fornecedor")) return 125;
    if (label.includes("compet")) return 76;
    if (label.includes("venc")) return 76;
    if (label.includes("status")) return 58;
    return 70;
  });
  const total = preferred.reduce((sum, width) => sum + width, 0);

  return preferred.map((width) => (width / total) * availableWidth);
}

function sumBefore(values: number[], index: number): number {
  return values.slice(0, index).reduce((sum, value) => sum + value, 0);
}

function pdfTextAt(value: string, x: number, y: number, size: number, bold = false): string[] {
  return [
    "0 0 0 rg",
    "BT",
    `/${bold ? "F2" : "F1"} ${size} Tf`,
    `${x} ${y} Td`,
    `<${pdfTextHex(value)}> Tj`,
    "ET",
  ];
}

function truncatePdfText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1))}.`;
}

function formatPdfDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function buildPdf(contentStream: string, page: { width: number; height: number }): Buffer {
  return buildPdfPages([contentStream], page);
}

function buildPdfPages(contentStreams: string[], page: { width: number; height: number }): Buffer {
  const pageObjectStart = 5;
  const pageObjectIds = contentStreams.map((_, index) => pageObjectStart + index * 2);
  const contentObjectIds = contentStreams.map((_, index) => pageObjectStart + index * 2 + 1);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${contentStreams.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  contentStreams.forEach((contentStream, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`,
      `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`
    );
  });

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return Buffer.from(chunks.join(""), "utf8");
}

function pdfTextHex(value: string): string {
  return Buffer.from(value.replace(/\u2013|\u2014/g, "-"), "latin1")
    .toString("hex")
    .toUpperCase();
}

function renderXlsx(dataset: ExportDataset): Buffer {
  const worksheetRows = [
    dataset.columns.map((column) => column.label),
    ...dataset.rows.map((row) => dataset.columns.map((column) => row[column.key] ?? "")),
  ];
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${worksheetRows.map((row, rowIndex) => renderXlsxRow(row, rowIndex + 1)).join("\n")}
  </sheetData>
</worksheet>`;

  return createZip([
    {
      name: "[Content_Types].xml",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: "xl/workbook.xml",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Exportacao" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    },
    { name: "xl/worksheets/sheet1.xml", content: Buffer.from(sheet) },
  ]);
}

function renderXlsxRow(row: Array<string | number | null>, rowNumber: number): string {
  const cells = row
    .map((value, columnIndex) => {
      const reference = `${columnName(columnIndex + 1)}${rowNumber}`;
      return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value ?? ""))}</t></is></c>`;
    })
    .join("");

  return `    <row r="${rowNumber}">${cells}</row>`;
}

function columnName(index: number): string {
  let value = index;
  let name = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ZipEntry {
  name: string;
  content: Buffer;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const name = Buffer.from(entry.name);
    const crc = crc32(entry.content);
    const local = Buffer.alloc(30);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.content.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.content.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + entry.content.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
