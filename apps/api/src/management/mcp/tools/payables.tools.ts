import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { z } from "zod";
import { formatDate } from "../../../common/reporting/report-period";
import { AccountsPayableService } from "../../financial/accounts-payable/accounts-payable.service";
import {
  dateArg,
  McpToolDefinition,
  reais,
  resolvePeriod,
  stringArray,
  MAX_LIST_ITEMS,
} from "./tool-output";

const PAYABLE_STATUSES = ["OPEN", "PARTIALLY_PAID", "OVERDUE", "PAID", "CANCELLED"] as const;

type PayablesPage = Awaited<ReturnType<AccountsPayableService["list"]>>;
type PayableCategories = Awaited<ReturnType<AccountsPayableService["summarizeByCategory"]>>;

export function payablesDefaultRange(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  return { start: formatDate(start), end: formatDate(end) };
}

@Injectable()
export class PayablesTools {
  constructor(
    @Inject(AccountsPayableService) private readonly payables: AccountsPayableService
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "contas_a_pagar",
        area: McpDataArea.PAYABLES,
        title: "Contas a pagar",
        description:
          "Contas a pagar com vencimento no periodo: totais previsto, pago, restante e vencido, quebra por categoria e ate 50 contas (descricao, fornecedor, categoria, vencimento, valores e situacao: OPEN, PARTIALLY_PAID, OVERDUE, PAID, CANCELLED). Sem datas, usa de 30 dias atras ate 30 dias a frente.",
        inputSchema: {
          inicio: dateArg("Vencimento inicial (AAAA-MM-DD)."),
          fim: dateArg("Vencimento final (AAAA-MM-DD)."),
          status: z.array(z.enum(PAYABLE_STATUSES)).optional().describe("Filtra por situacao."),
        },
        handler: async (context, args) => {
          const periodo = resolvePeriod(args, payablesDefaultRange());
          const status = stringArray(args.status);
          const [page, categories] = await Promise.all([
            this.payables.list(context.tenantId, {
              start: periodo.inicio,
              end: periodo.fim,
              status: status.length ? status : undefined,
              page: 1,
              pageSize: MAX_LIST_ITEMS,
            }),
            this.payables.summarizeByCategory(context.tenantId, {
              start: periodo.inicio,
              end: periodo.fim,
            }),
          ]);
          return mapPayables(page, categories, periodo, status);
        },
      },
    ];
  }
}

export function mapPayables(
  page: PayablesPage,
  categories: PayableCategories,
  periodo: ReturnType<typeof resolvePeriod>,
  status: string[]
) {
  const contas = page.items.slice(0, MAX_LIST_ITEMS).map((item) => ({
    descricao: item.description,
    fornecedor: item.supplierName,
    categoria: item.categoryName,
    vencimento: item.dueDate,
    valorReais: reais(item.expectedAmount),
    pagoReais: reais(item.paidAmount),
    restanteReais: reais(item.remainingAmount),
    status: item.status,
  }));

  return {
    periodo,
    filtros: { status },
    totais: {
      previstoReais: reais(page.summary.totalExpected),
      pagoReais: reais(page.summary.totalPaid),
      restanteReais: reais(page.summary.totalRemaining),
      vencidoReais: reais(page.summary.overdueAmount),
      quantidadeAbertas: page.summary.openCount,
      quantidadeVencidas: page.summary.overdueCount,
    },
    porCategoria: categories.slice(0, MAX_LIST_ITEMS).map((category) => ({
      categoria: category.categoryName,
      previstoReais: reais(category.expected),
      pagoReais: reais(category.paid),
      abertoReais: reais(category.open),
      vencidoReais: reais(category.overdue),
    })),
    contas,
    totalItens: page.total,
    truncado: page.total > contas.length,
    semMovimento: page.total === 0,
  };
}
