import { Inject, Injectable } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import {
  addDays,
  endOfDay,
  formatDate,
  parseDate,
} from "../../../common/reporting/report-period";
import { CashFlowService } from "../../financial/cash-flow/cash-flow.service";
import {
  assertPeriod,
  BUSINESS_TIME_ZONE,
  dateArg,
  McpToolDefinition,
  reais,
} from "./tool-output";

type CashPosition = Awaited<ReturnType<CashFlowService["getPosition"]>>;
type CashStatement = Awaited<ReturnType<CashFlowService["getStatement"]>>;

const SOURCE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Saldo inicial",
  ORDER_RECEIPT: "Recebimento de vendas",
  PAYABLE_PAYMENT: "Pagamento de contas",
  CASH_MOVEMENT: "Movimento manual",
};

@Injectable()
export class CashTools {
  constructor(@Inject(CashFlowService) private readonly cashFlow: CashFlowService) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "posicao_caixa",
        area: McpDataArea.CASH,
        title: "Posicao de caixa",
        description:
          "Saldo atual por conta financeira e projecao diaria de entradas (recebiveis) e saidas (contas a pagar) ate a data informada, com alerta de saldo negativo. Sem datas, usa hoje e projeta 30 dias (maximo 92).",
        inputSchema: {
          dataReferencia: dateArg("Data de referencia do saldo (AAAA-MM-DD). Padrao: hoje."),
          projecaoAte: dateArg("Data final da projecao (AAAA-MM-DD). Padrao: referencia + 30 dias."),
        },
        handler: async (context, args) => {
          const referenceDate =
            typeof args.dataReferencia === "string"
              ? endOfDay(parseDate(args.dataReferencia))
              : new Date();
          const projectionEnd =
            typeof args.projecaoAte === "string"
              ? endOfDay(parseDate(args.projecaoAte))
              : addDays(referenceDate, 30);
          assertPeriod(formatDate(referenceDate), formatDate(projectionEnd));
          const position = await this.cashFlow.getPosition(
            context.tenantId,
            referenceDate,
            projectionEnd
          );
          return mapCashPosition(position, typeof args.dataReferencia !== "string");
        },
      },
      {
        name: "extrato_caixa",
        area: McpDataArea.CASH,
        title: "Extrato de caixa",
        description:
          "Entradas e saidas realizadas no periodo, consolidadas por dia e por origem (vendas, pagamentos de contas, movimentos manuais), com saldo inicial e final. Sem datas, usa os ultimos 30 dias (maximo 92).",
        inputSchema: {
          inicio: dateArg("Data inicial (AAAA-MM-DD)."),
          fim: dateArg("Data final (AAAA-MM-DD)."),
        },
        handler: async (context, args) => {
          const endDate = typeof args.fim === "string" ? endOfDay(parseDate(args.fim)) : new Date();
          const startDate =
            typeof args.inicio === "string" ? parseDate(args.inicio) : addDays(endDate, -30);
          assertPeriod(formatDate(startDate), formatDate(endDate));
          const statement = await this.cashFlow.getStatement(context.tenantId, startDate, endDate);
          return mapCashStatement(
            statement,
            typeof args.inicio !== "string" && typeof args.fim !== "string"
          );
        },
      },
    ];
  }
}

export function mapCashPosition(position: CashPosition, defaulted: boolean) {
  const projectedByDay = new Map<string, string>();
  for (const entry of position.projection) projectedByDay.set(entry.occurredAt, entry.projectedBalance);

  return {
    dataReferencia: position.asOf,
    projecaoAte: position.projectionEnd,
    fuso: BUSINESS_TIME_ZONE,
    padraoAplicado: defaulted,
    saldoAtualReais: reais(position.currentBalance),
    entradasPrevistasReais: reais(position.receivableAmount),
    saidasPrevistasReais: reais(position.payableAmount),
    saldoProjetadoReais: reais(position.projectedBalance),
    saldoNegativoPrevisto: position.negativeBalanceDetected,
    contas: position.accounts.map((account) => ({
      conta: account.financialAccountName,
      saldoReais: reais(account.balance),
      naoAlocado: account.unallocated,
    })),
    projecaoDiaria: position.timeline.map((day) => ({
      data: day.date,
      entradasReais: reais(day.inflowAmount),
      saidasReais: reais(day.outflowAmount),
      liquidoReais: reais(day.netAmount),
      saldoProjetadoReais: reais(projectedByDay.get(day.date) ?? position.currentBalance),
    })),
  };
}

export function mapCashStatement(statement: CashStatement, defaulted: boolean) {
  const bySource = new Map<string, { entradas: number; saidas: number }>();
  for (const day of statement.days) {
    for (const entry of day.entries) {
      const current = bySource.get(entry.sourceType) ?? { entradas: 0, saidas: 0 };
      current.entradas += reais(entry.inflowAmount);
      current.saidas += reais(entry.outflowAmount);
      bySource.set(entry.sourceType, current);
    }
  }

  return {
    periodo: {
      inicio: statement.start,
      fim: statement.end,
      fuso: BUSINESS_TIME_ZONE,
      padraoAplicado: defaulted,
    },
    saldoInicialReais: reais(statement.openingBalance),
    saldoFinalReais: reais(statement.closingBalance),
    entradasReais: reais(statement.totalCredit),
    saidasReais: reais(statement.totalDebit),
    liquidoReais: reais(statement.netAmount),
    porDia: statement.days.map((day) => ({
      data: day.date,
      entradasReais: reais(day.creditAmount),
      saidasReais: reais(day.debitAmount),
      liquidoReais: reais(day.netAmount),
      saldoReais: reais(day.runningBalance),
    })),
    porOrigem: [...bySource.entries()].map(([source, totals]) => ({
      origem: source,
      rotulo: SOURCE_LABELS[source] ?? source,
      entradasReais: reais(totals.entradas),
      saidasReais: reais(totals.saidas),
    })),
    semMovimento: statement.days.length === 0,
  };
}
