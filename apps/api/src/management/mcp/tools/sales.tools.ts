import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea, OrderStatus, PaymentInstitution, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { ReportsService } from "../../reports.service";
import { parseManagementReportQuery } from "../../reports/management-report.types";
import { ManagementReportService } from "../../reports/management-report.service";
import { SalesReportService } from "../../reports/sales-report.service";
import {
  formatLocalDate,
  parseSalesReportQuery,
  rollingReportRange,
} from "../../reports/sales-report.types";
import {
  assertPeriod,
  BUSINESS_TIME_ZONE,
  dateArg,
  McpToolDefinition,
  percentual,
  reais,
  resolvePeriod,
  stringArray,
} from "./tool-output";

type SalesReport = Awaited<ReturnType<SalesReportService["getReport"]>>;
type ManagementReport = Awaited<ReturnType<ManagementReportService["getReport"]>>;

@Injectable()
export class SalesTools {
  constructor(
    @Inject(SalesReportService) private readonly salesReports: SalesReportService,
    @Inject(ReportsService) private readonly reports: ReportsService,
    @Inject(ManagementReportService) private readonly managementReports: ManagementReportService
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "resumo_vendas",
        area: McpDataArea.SALES,
        title: "Resumo de vendas",
        description:
          "Resumo de vendas da loja no periodo: faturamento bruto, receita liquida, pedidos, ticket medio, taxas e quebras por dia, plataforma (canal), meio de pagamento e instituicao. Por padrao considera apenas pedidos entregues (use 'status' para outros). Mesmos numeros da tela Relatorio de Vendas. Periodo maximo de 92 dias; sem datas, usa os ultimos 31 dias.",
        inputSchema: {
          inicio: dateArg("Data inicial (AAAA-MM-DD)."),
          fim: dateArg("Data final (AAAA-MM-DD)."),
          plataformas: z
            .array(z.string().uuid())
            .optional()
            .describe("Ids de plataforma/canal (veja o recurso perfil_loja)."),
          meiosPagamento: z.array(z.nativeEnum(PaymentMethod)).optional(),
          instituicoes: z.array(z.nativeEnum(PaymentInstitution)).optional(),
          status: z
            .array(z.nativeEnum(OrderStatus))
            .optional()
            .describe("Status dos pedidos. Padrao: apenas DELIVERED."),
        },
        handler: async (context, args) => {
          const periodo = resolvePeriod(args, rollingReportRange(new Date()));
          const report = await this.salesReports.getReport(
            context.tenantId,
            parseSalesReportQuery({
              start: periodo.inicio,
              end: periodo.fim,
              orderPlatformId: stringArray(args.plataformas),
              paymentMethod: stringArray(args.meiosPagamento),
              paymentInstitution: stringArray(args.instituicoes),
              status: stringArray(args.status),
              page: "1",
              pageSize: "1",
            })
          );
          return mapSalesReport(report, periodo, {
            plataformas: stringArray(args.plataformas),
            meiosPagamento: stringArray(args.meiosPagamento),
            instituicoes: stringArray(args.instituicoes),
            status: stringArray(args.status).length ? stringArray(args.status) : ["DELIVERED"],
          });
        },
      },
      {
        name: "resumo_diario",
        area: McpDataArea.SALES,
        title: "Resumo diario",
        description:
          "Resumo de um dia: quantidade de pedidos entregues e faturamento bruto. Sem data, usa o dia de hoje no fuso da loja.",
        inputSchema: { data: dateArg("Dia (AAAA-MM-DD).") },
        handler: async (context, args) => {
          const date = typeof args.data === "string" ? args.data : formatLocalDate(new Date());
          assertPeriod(date, date);
          const summary = await this.reports.getDailySummary(context.tenantId, date);
          return {
            data: summary.date,
            fuso: BUSINESS_TIME_ZONE,
            pedidos: summary.orderCount,
            faturamentoBrutoReais: reais(summary.grossRevenue),
            semMovimento: summary.orderCount === 0,
          };
        },
      },
      {
        name: "relatorio_gerencial",
        area: McpDataArea.SALES,
        title: "Relatorio gerencial",
        description:
          "Visao gerencial consolidada do periodo: vendas, caixa (entradas, saidas, saldo por conta) e contas a pagar (aberto, vencido, por categoria). Mesmos numeros da tela Relatorio Gerencial. Periodo maximo de 92 dias; sem datas, usa os ultimos 31 dias.",
        inputSchema: {
          inicio: dateArg("Data inicial (AAAA-MM-DD)."),
          fim: dateArg("Data final (AAAA-MM-DD)."),
        },
        handler: async (context, args) => {
          const periodo = resolvePeriod(args, rollingReportRange(new Date()));
          const report = await this.managementReports.getReport(
            context.tenantId,
            parseManagementReportQuery({ start: periodo.inicio, end: periodo.fim })
          );
          return mapManagementReport(report, periodo);
        },
      },
    ];
  }
}

export function mapSalesReport(
  report: SalesReport,
  periodo: ReturnType<typeof resolvePeriod>,
  filtros: Record<string, string[]>
) {
  const summary = report.summary;
  return {
    periodo,
    filtros,
    totais: {
      pedidos: summary.orderCount,
      faturamentoBrutoReais: reais(summary.grossRevenue),
      receitaLiquidaReais: reais(summary.acquiredNetRevenue),
      liberadoReais: reais(summary.releasedNetRevenue),
      aReceberReais: reais(summary.receivableNetAmount),
      taxasPagamentoReais: reais(summary.paymentFeeAmount),
      ticketMedioReais: reais(summary.averageTicket),
    },
    porDia: report.daily.map((day) => ({
      data: day.date,
      pedidos: day.orderCount,
      faturamentoBrutoReais: reais(day.grossRevenue),
      receitaLiquidaReais: reais(day.acquiredNetRevenue),
    })),
    porPlataforma: report.byChannel.map((row) => ({
      plataformaId: row.orderPlatformId,
      plataforma: row.orderPlatformName,
      pedidos: row.orderCount,
      faturamentoBrutoReais: reais(row.grossRevenue),
      receitaLiquidaReais: reais(row.acquiredNetRevenue),
      ticketMedioReais: reais(row.averageTicket),
      participacaoPercentual:
        reais(summary.grossRevenue) === 0
          ? 0
          : percentual(reais(row.grossRevenue) / reais(summary.grossRevenue)),
    })),
    porMeioPagamento: report.byPaymentMethod.map((row) => ({
      meioPagamento: row.dimensionKey,
      rotulo: row.dimensionLabel,
      pedidos: row.orderCount,
      faturamentoBrutoReais: reais(row.grossRevenue),
      participacaoPercentual: percentual(row.shareOfGrossRevenue),
    })),
    porInstituicao: report.byPaymentInstitution.map((row) => ({
      instituicao: row.dimensionKey,
      rotulo: row.dimensionLabel,
      pedidos: row.orderCount,
      faturamentoBrutoReais: reais(row.grossRevenue),
      taxasPagamentoReais: reais(row.paymentFeeAmount),
      participacaoPercentual: percentual(row.shareOfGrossRevenue),
    })),
    recebiveis: {
      pedidosPendentes: report.receivables.pendingOrderCount,
      valorReais: reais(report.receivables.receivableNetAmount),
      proximaLiberacao: report.receivables.nextExpectedReleaseDate,
    },
    ifoodFinanceiro: {
      vendas: report.ifoodFinancial.saleCount,
      valorSacolaReais: reais(report.ifoodFinancial.bagAmount),
      pagoPeloClienteReais: reais(report.ifoodFinancial.customerPaidAmount),
      aReceberDoIfoodReais: reais(report.ifoodFinancial.ifoodReceivableAmount),
      recebidoPelaLojaReais: reais(report.ifoodFinancial.storeReceivedAmount),
    },
    semMovimento: summary.orderCount === 0,
  };
}

export function mapManagementReport(
  report: ManagementReport,
  periodo: ReturnType<typeof resolvePeriod>
) {
  return {
    periodo,
    resumoExecutivo: {
      faturamentoBrutoReais: reais(report.executiveSummary.grossRevenue),
      receitaLiquidaReais: reais(report.executiveSummary.netRevenue),
      caixaLiquidoReais: reais(report.executiveSummary.cashNet),
      saldoFinalReais: reais(report.executiveSummary.finalBalance),
      contasEmAbertoReais: reais(report.executiveSummary.payablesOpen),
      contasVencidasReais: reais(report.executiveSummary.payablesOverdue),
      aReceberReais: reais(report.executiveSummary.receivableAmount),
    },
    vendas: {
      pedidos: report.sales.orders,
      faturamentoBrutoReais: reais(report.sales.grossRevenue),
      receitaLiquidaReais: reais(report.sales.netRevenue),
      liberadoReais: reais(report.sales.releasedAmount),
      aReceberReais: reais(report.sales.receivableAmount),
      taxasReais: reais(report.sales.feeAmount),
      ticketMedioReais: reais(report.sales.averageTicket),
    },
    caixa: {
      entradasReais: reais(report.cashFlow.credits),
      saidasReais: reais(report.cashFlow.debits),
      liquidoReais: reais(report.cashFlow.net),
      saldoFinalReais: reais(report.cashFlow.finalBalance),
      saldosPorConta: report.cashFlow.balancesByAccount.map((account) => ({
        conta: account.accountName,
        saldoReais: reais(account.balance),
      })),
    },
    contasAPagar: {
      previstoReais: reais(report.payables.expected),
      pagoReais: reais(report.payables.paid),
      abertoReais: reais(report.payables.open),
      vencidoReais: reais(report.payables.overdue),
      quantidadeAbertas: report.payables.openCount,
      quantidadeVencidas: report.payables.overdueCount,
      porCategoria: report.payables.byCategory.slice(0, 50).map((category) => ({
        categoria: category.categoryName,
        previstoReais: reais(category.expected),
        pagoReais: reais(category.paid),
        abertoReais: reais(category.open),
        vencidoReais: reais(category.overdue),
        participacaoPercentual: percentual(category.shareOfExpected),
      })),
    },
    semMovimento: report.sales.orders === 0 && reais(report.cashFlow.credits) === 0,
  };
}
