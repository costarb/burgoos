import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { z } from "zod";
import { formatDate } from "../../../common/reporting/report-period";
import { AccountsPayableService } from "../../financial/accounts-payable/accounts-payable.service";
import { McpToolError } from "../server/mcp-context";
import {
  assertPeriod,
  BUSINESS_TIME_ZONE,
  dateArg,
  McpToolDefinition,
  reais,
  stringArray,
  MAX_LIST_ITEMS,
} from "./tool-output";

const PAYABLE_STATUSES = ["OPEN", "PARTIALLY_PAID", "OVERDUE", "PAID", "CANCELLED"] as const;

type PayablesPage = Awaited<ReturnType<AccountsPayableService["list"]>>;
type PayableCategories = Awaited<ReturnType<AccountsPayableService["summarizeByCategory"]>>;
type PayableOptions = Awaited<ReturnType<AccountsPayableService["getOptions"]>>;

export interface PayablesDueDateFilter {
  inicio: string | null;
  fim: string | null;
  fuso: string;
  criterio: "vencimento";
  padraoAplicado: boolean;
}

export interface PayablesFilters {
  status: string[];
  categorias: string[];
  fornecedores: string[];
  mesCompetencia: string | null;
}

export function payablesDefaultRange(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  return { start: formatDate(start), end: formatDate(end) };
}

/**
 * Due-date window: the given bounds (either may be omitted), or the default window only when
 * the caller sets neither a due date nor a competence month.
 */
export function resolveDueDateFilter(
  args: { inicio?: unknown; fim?: unknown },
  hasCompetence: boolean,
  now = new Date()
): PayablesDueDateFilter {
  const inicio = typeof args.inicio === "string" ? args.inicio : null;
  const fim = typeof args.fim === "string" ? args.fim : null;
  if (!inicio && !fim && !hasCompetence) {
    const fallback = payablesDefaultRange(now);
    return { inicio: fallback.start, fim: fallback.end, fuso: BUSINESS_TIME_ZONE, criterio: "vencimento", padraoAplicado: true };
  }
  if (inicio && fim) assertPeriod(inicio, fim);
  else if (inicio) assertPeriod(inicio, inicio);
  else if (fim) assertPeriod(fim, fim);
  return { inicio, fim, fuso: BUSINESS_TIME_ZONE, criterio: "vencimento", padraoAplicado: false };
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
          "Contas a pagar com os mesmos filtros da tela, todos opcionais: vencimento (inicio/fim), status (OPEN, PARTIALLY_PAID, OVERDUE, PAID, CANCELLED), categorias e fornecedores (pelo nome) e mes de competencia (AAAA-MM). Retorna totais previsto, pago, restante e vencido, quebra por categoria e ate 50 contas com descricao, fornecedor, categoria, competencia, classificacao no DRE (classificacaoDre; classificacaoAjustada indica ajuste na propria conta), vencimento, valores e situacao. Sem nenhum filtro de data ou competencia, considera vencimentos de 30 dias atras ate 30 dias a frente.",
        inputSchema: {
          inicio: dateArg("Vencimento inicial (AAAA-MM-DD)."),
          fim: dateArg("Vencimento final (AAAA-MM-DD)."),
          status: z.array(z.enum(PAYABLE_STATUSES)).optional().describe("Filtra por situacao."),
          categorias: z
            .array(z.string().min(1))
            .max(20)
            .optional()
            .describe("Nomes das categorias financeiras (ex.: Aluguel). Aceita tambem ids."),
          fornecedores: z
            .array(z.string().min(1))
            .max(20)
            .optional()
            .describe("Nomes dos fornecedores. Aceita tambem ids."),
          mesCompetencia: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM")
            .optional()
            .describe("Mes de competencia (AAAA-MM)."),
        },
        handler: async (context, args) => {
          const mesCompetencia = typeof args.mesCompetencia === "string" ? args.mesCompetencia : null;
          const vencimento = resolveDueDateFilter(args, mesCompetencia !== null);
          const status = stringArray(args.status);
          const requestedCategories = stringArray(args.categorias);
          const requestedSuppliers = stringArray(args.fornecedores);

          const options =
            requestedCategories.length || requestedSuppliers.length
              ? await this.payables.getOptions(context.tenantId)
              : null;
          const categories = resolveNamed(requestedCategories, options?.categories ?? [], "categoria");
          const suppliers = resolveNamed(requestedSuppliers, options?.suppliers ?? [], "fornecedor");

          const query = {
            start: vencimento.inicio ?? undefined,
            end: vencimento.fim ?? undefined,
            categoryId: categories.ids.length ? categories.ids : undefined,
            supplierId: suppliers.ids.length ? suppliers.ids : undefined,
            competenceMonth: mesCompetencia ?? undefined,
          };
          const [page, summary] = await Promise.all([
            this.payables.list(context.tenantId, {
              ...query,
              status: status.length ? status : undefined,
              page: 1,
              pageSize: MAX_LIST_ITEMS,
            }),
            this.payables.summarizeByCategory(context.tenantId, query),
          ]);
          return mapPayables(page, summary, vencimento, {
            status,
            categorias: categories.names,
            fornecedores: suppliers.names,
            mesCompetencia,
          });
        },
      },
    ];
  }
}

/** Matches names (case/accent-insensitive) or ids against the store's options. */
export function resolveNamed(
  requested: string[],
  options: PayableOptions["categories"] | PayableOptions["suppliers"],
  label: "categoria" | "fornecedor"
): { ids: string[]; names: string[] } {
  if (requested.length === 0) return { ids: [], names: [] };
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const matched = new Map<string, string>();
  const unknown: string[] = [];
  for (const value of requested) {
    const option = options.find((item) => item.id === value || normalize(item.name) === normalize(value));
    if (option) matched.set(option.id, option.name);
    else unknown.push(value);
  }
  if (unknown.length) {
    const available = options.slice(0, 50).map((item) => item.name).join(", ") || "nenhuma cadastrada";
    throw new McpToolError(
      "INVALID_FILTER",
      `${label === "categoria" ? "Categoria nao encontrada" : "Fornecedor nao encontrado"}: ${unknown.join(", ")}. Opcoes: ${available}.`
    );
  }
  return { ids: [...matched.keys()], names: [...matched.values()] };
}

export function mapPayables(
  page: PayablesPage,
  categories: PayableCategories,
  vencimento: PayablesDueDateFilter,
  filtros: PayablesFilters
) {
  const contas = page.items.slice(0, MAX_LIST_ITEMS).map((item) => ({
    descricao: item.description,
    fornecedor: item.supplierName,
    categoria: item.categoryName,
    competencia: item.competenceDate,
    classificacaoDre: item.effectiveDreClass,
    classificacaoAjustada: item.dreClassOverride !== null,
    vencimento: item.dueDate,
    valorReais: reais(item.expectedAmount),
    pagoReais: reais(item.paidAmount),
    restanteReais: reais(item.remainingAmount),
    status: item.status,
  }));

  return {
    periodo: vencimento,
    filtros,
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
