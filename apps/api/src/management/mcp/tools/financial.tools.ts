import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import {
  currentMonthEnd,
  currentMonthStart,
  dayEnd,
  dayStart,
  formatDate,
} from "../../../common/reporting/report-period";
import { DreService } from "../../reports/dre.service";
import { FinancialDashboardService } from "../../reports/financial-dashboard.service";
import {
  BUSINESS_TIME_ZONE,
  dateArg,
  McpToolDefinition,
  percentual,
  ratio,
  reais,
  resolvePeriod,
} from "./tool-output";

type DreSummary = Awaited<ReturnType<DreService["getSummary"]>>;

export function currentMonthRange(now = new Date()) {
  return { start: formatDate(currentMonthStart(now)), end: formatDate(currentMonthEnd(now)) };
}

@Injectable()
export class FinancialTools {
  constructor(
    @Inject(DreService) private readonly dre: DreService,
    @Inject(FinancialDashboardService) private readonly dashboard: FinancialDashboardService
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "dre",
        area: McpDataArea.FINANCIAL,
        title: "DRE do periodo",
        description:
          "DRE (Demonstracao do Resultado) do periodo com base nos pedidos entregues: receita bruta, descontos, receita liquida, CMV, taxas e impostos, lucro bruto (margem de contribuicao), despesas fixas, lucro liquido estimado, margem liquida e ponto de equilibrio. Mesmos numeros da tela DRE. Sem datas, usa o mes corrente.",
        inputSchema: {
          inicio: dateArg("Data inicial (AAAA-MM-DD)."),
          fim: dateArg("Data final (AAAA-MM-DD)."),
        },
        handler: async (context, args) => {
          const periodo = resolvePeriod(args, currentMonthRange());
          const summary = await this.dre.getSummary(
            context.tenantId,
            dayStart(periodo.inicio),
            dayEnd(periodo.fim)
          );
          return mapDre(summary, periodo);
        },
      },
      {
        name: "dashboard_financeiro",
        area: McpDataArea.FINANCIAL,
        title: "Dashboard financeiro",
        description:
          "Indicadores financeiros do mes corrente: faturamento, CMV, lucro bruto, lucro liquido estimado, margem liquida, pedidos entregues, produtos com preco a revisar e ingredientes em alerta de estoque.",
        inputSchema: {},
        handler: async (context) => {
          const indicators = await this.dashboard.getIndicators(context.tenantId);
          return {
            mesReferencia: {
              inicio: indicators.periodStart.slice(0, 10),
              fim: indicators.periodEnd.slice(0, 10),
              fuso: BUSINESS_TIME_ZONE,
            },
            faturamentoBrutoReais: reais(indicators.grossRevenue),
            cmvReais: reais(indicators.cmv),
            lucroBrutoReais: reais(indicators.grossProfit),
            lucroLiquidoEstimadoReais: reais(indicators.estimatedNetProfit),
            margemLiquidaPercentual: percentual(indicators.netMarginRate),
            pedidosEntregues: indicators.deliveredOrderCount,
            produtosComPrecoARevisar: indicators.priceReviewCount,
            ingredientesEmAlerta: indicators.stockAlertCount,
            semMovimento: indicators.deliveredOrderCount === 0,
          };
        },
      },
    ];
  }
}

export function mapDre(summary: DreSummary, periodo: ReturnType<typeof resolvePeriod>) {
  return {
    periodo,
    receitaBrutaReais: reais(summary.grossRevenue),
    descontosReais: reais(summary.discounts),
    receitaLiquidaReais: reais(summary.netRevenue),
    receitaLiquidaAdquirenteReais: reais(summary.acquiredNetRevenue),
    cmvReais: reais(summary.cmv),
    cmvPercentual: ratio(summary.cmv, summary.netRevenue),
    taxasEImpostosReais: reais(summary.feesAndTaxes),
    lucroBrutoReais: reais(summary.grossProfit),
    margemContribuicaoPercentual: ratio(summary.grossProfit, summary.netRevenue),
    despesasFixasReais: reais(summary.fixedExpenses),
    lucroLiquidoEstimadoReais: reais(summary.estimatedNetProfit),
    margemLiquidaPercentual: percentual(summary.netMarginRate),
    pontoEquilibrioReais: reais(summary.breakEvenRevenue),
    semMovimento: reais(summary.grossRevenue) === 0,
  };
}
