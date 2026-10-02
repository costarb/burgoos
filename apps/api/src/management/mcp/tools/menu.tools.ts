import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { z } from "zod";
import { dayEnd, dayStart } from "../../../common/reporting/report-period";
import { MenuEngineeringService } from "../../reports/menu-engineering.service";
import { currentMonthRange } from "./financial.tools";
import {
  dateArg,
  McpToolDefinition,
  percentual,
  reais,
  resolvePeriod,
  stringArray,
  truncate,
} from "./tool-output";

const CLASSIFICATIONS = ["STAR", "WORKHORSE", "PUZZLE", "DOG"] as const;

type MenuReport = Awaited<ReturnType<MenuEngineeringService["getReport"]>>;

@Injectable()
export class MenuTools {
  constructor(
    @Inject(MenuEngineeringService) private readonly menuEngineering: MenuEngineeringService
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "engenharia_cardapio",
        area: McpDataArea.MENU,
        title: "Engenharia de cardapio",
        description:
          "Engenharia de cardapio do periodo: cada produto vendido classificado por popularidade (volume) e margem em STAR (estrela: alto volume e alta margem), WORKHORSE (burro de carga: alto volume, baixa margem), PUZZLE (quebra-cabeca: baixo volume, alta margem) e DOG (cao: baixo volume, baixa margem). Retorna ate 50 produtos ordenados por faturamento. Sem datas, usa o mes corrente.",
        inputSchema: {
          inicio: dateArg("Data inicial (AAAA-MM-DD)."),
          fim: dateArg("Data final (AAAA-MM-DD)."),
          classificacao: z
            .array(z.enum(CLASSIFICATIONS))
            .optional()
            .describe("Filtra produtos por classificacao."),
        },
        handler: async (context, args) => {
          const periodo = resolvePeriod(args, currentMonthRange());
          const report = await this.menuEngineering.getReport(
            context.tenantId,
            dayStart(periodo.inicio),
            dayEnd(periodo.fim)
          );
          return mapMenuEngineering(report, periodo, stringArray(args.classificacao));
        },
      },
    ];
  }
}

export function mapMenuEngineering(
  report: MenuReport,
  periodo: ReturnType<typeof resolvePeriod>,
  classifications: string[]
) {
  const filter = new Set(classifications);
  const products = report.items
    .filter((item) => filter.size === 0 || filter.has(item.classification))
    .sort((left, right) => reais(right.revenue) - reais(left.revenue))
    .map((item) => ({
      produto: item.productName,
      quantidade: item.volumeSold,
      faturamentoReais: reais(item.revenue),
      cmvReais: reais(item.cmv),
      lucroBrutoReais: reais(item.grossProfit),
      margemPercentual: percentual(item.marginRate),
      classificacao: item.classification,
    }));
  const page = truncate(products);

  return {
    periodo,
    dadosInsuficientes: report.insufficientData,
    medias: {
      volumeMedio: Math.round(report.averageVolume * 10) / 10,
      margemMediaPercentual: percentual(report.averageMarginRate),
    },
    contagemPorClassificacao: Object.fromEntries(
      CLASSIFICATIONS.map((classification) => [
        classification,
        report.items.filter((item) => item.classification === classification).length,
      ])
    ),
    produtos: page.items,
    totalItens: page.totalItens,
    truncado: page.truncado,
    semMovimento: report.items.length === 0,
  };
}
