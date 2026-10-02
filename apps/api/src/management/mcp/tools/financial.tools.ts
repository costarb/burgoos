import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { z } from "zod";
import {
  currentMonthEnd,
  currentMonthStart,
  formatDate,
} from "../../../common/reporting/report-period";
import { competenceFromDate, isCompetence } from "../../reports/dre-competence";
import { DreService } from "../../reports/dre.service";
import { McpToolError } from "../server/mcp-context";
import { FinancialDashboardService } from "../../reports/financial-dashboard.service";
import {
  BUSINESS_TIME_ZONE,
  dateArg,
  McpToolDefinition,
  percentual,
  ratio,
  reais,
} from "./tool-output";

type DreSummary = Awaited<ReturnType<DreService["getMonthlySummary"]>>;

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
        title: "DRE da competencia",
        description:
          "DRE (Demonstracao do Resultado) de um mes de competencia: receita bruta, descontos, receita liquida, CMV, taxas de plataforma e pagamento (reais = bruto - liquido quando o pedido traz esses valores, senao estimadas), impostos (estimados pela aliquota configurada), margem de contribuicao, despesas variaveis e custos fixos lancados em contas a pagar para a competencia, resultado liquido, margem liquida, ponto de equilibrio, custo fixo previsto (referencia) e despesas por categoria. Mesmos numeros da tela DRE. Sem mes, usa o mes corrente.",
        inputSchema: {
          mesCompetencia: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM")
            .optional()
            .describe("Mes de competencia (AAAA-MM)."),
          inicio: dateArg("Legado: o DRE usa o mes desta data (AAAA-MM-DD)."),
          fim: dateArg("Legado: ignorado; o DRE e sempre mensal."),
        },
        handler: async (context, args) => {
          const mes = typeof args.mesCompetencia === "string" ? args.mesCompetencia : undefined;
          const inicio = typeof args.inicio === "string" ? args.inicio : undefined;
          let observacao: string | undefined;
          let competence = mes;
          if (!competence && inicio) {
            competence = competenceFromDate(inicio);
            observacao = `O DRE e mensal por competencia; usado o mes de inicio (${competence}).`;
          }
          if (competence && !isCompetence(competence)) {
            throw new McpToolError("INVALID_PERIOD", "Competencia invalida. Use o formato AAAA-MM.");
          }
          const summary = await this.dre.getMonthlySummary(context.tenantId, competence);
          return mapDre(summary, { padraoAplicado: competence === undefined, observacao });
        },
      },
      {
        name: "dashboard_financeiro",
        area: McpDataArea.FINANCIAL,
        title: "Dashboard financeiro",
        description:
          "Indicadores financeiros do mes corrente (mesma regra da tela DRE): faturamento, receita liquida, CMV, taxas, impostos, margem de contribuicao, despesas variaveis, custos fixos, lucro liquido estimado, margem liquida, pedidos entregues, produtos com preco a revisar e ingredientes em alerta de estoque.",
        inputSchema: {},
        handler: async (context) => {
          const indicators = await this.dashboard.getIndicators(context.tenantId);
          return {
            mesCompetencia: indicators.competence,
            mesReferencia: {
              inicio: indicators.periodStart.slice(0, 10),
              fim: indicators.periodEnd.slice(0, 10),
              fuso: BUSINESS_TIME_ZONE,
            },
            faturamentoBrutoReais: reais(indicators.grossRevenue),
            receitaLiquidaReais: reais(indicators.netRevenue),
            cmvReais: reais(indicators.cmv),
            taxasVendaReais: reais(indicators.salesFees),
            impostosEstimadosReais: reais(indicators.taxes),
            lucroBrutoReais: reais(indicators.grossProfit),
            margemContribuicaoPercentual: percentual(indicators.contributionMarginRate),
            despesasVariaveisReais: reais(indicators.variableExpenses),
            custosFixosReais: reais(indicators.fixedExpenses),
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

export function mapDre(
  summary: DreSummary,
  options: { padraoAplicado: boolean; observacao?: string }
) {
  return {
    mesCompetencia: summary.competence,
    periodo: {
      inicio: summary.periodStart,
      fim: summary.periodEnd,
      fuso: BUSINESS_TIME_ZONE,
      padraoAplicado: options.padraoAplicado,
    },
    ...(options.observacao ? { observacao: options.observacao } : {}),
    receitaBrutaReais: reais(summary.grossRevenue),
    descontosReais: reais(summary.discounts),
    receitaLiquidaReais: reais(summary.netRevenue),
    receitaLiquidaAdquirenteReais: reais(summary.acquiredNetRevenue),
    cmvReais: reais(summary.cmv),
    cmvPercentual: ratio(summary.cmv, summary.netRevenue),
    taxasEImpostosReais: reais(summary.feesAndTaxes),
    taxasVendaReais: reais(summary.salesFees),
    taxasVenda: {
      reaisReais: reais(summary.realSalesFees),
      pedidosComTaxaReal: summary.realFeeOrderCount,
      estimadasReais: reais(summary.estimatedSalesFees),
      pedidosComTaxaEstimada: summary.estimatedFeeOrderCount,
    },
    impostosEstimadosReais: reais(summary.taxes),
    aliquotaImpostoPercentual: percentual(summary.taxRate),
    lucroBrutoReais: reais(summary.grossProfit),
    margemContribuicaoPercentual: percentual(summary.contributionMarginRate),
    despesasVariaveisReais: reais(summary.variableExpenses),
    custosFixosReais: reais(summary.fixedExpenses),
    despesasFixasReais: reais(summary.fixedExpenses),
    lucroLiquidoEstimadoReais: reais(summary.estimatedNetProfit),
    margemLiquidaPercentual: percentual(summary.netMarginRate),
    pontoEquilibrioReais:
      summary.breakEvenRevenue === null ? null : reais(summary.breakEvenRevenue),
    pontoEquilibrioAtingivel: summary.breakEvenRevenue !== null,
    custoFixoPrevistoReais: reais(summary.plannedFixedCost),
    diferencaCustoFixoReais: reais(summary.fixedCostVariance),
    despesasPorCategoria: summary.expensesByCategory.map((row) => ({
      categoria: row.categoryName,
      classificacao: row.dreClass,
      valorReais: reais(row.amount),
      quantidade: row.count,
    })),
    semMovimento: reais(summary.grossRevenue) === 0,
  };
}
