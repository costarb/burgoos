import { Inject, Injectable } from "@nestjs/common";
import { DreExpenseClass, FinancialRecurrenceFrequency, McpDataArea } from "@prisma/client";
import { z } from "zod";
import { AccountsPayableService } from "../../financial/accounts-payable/accounts-payable.service";
import { PayableDto } from "../../financial/dto/payable.dto";
import { asMcpAction, mcpActor } from "../server/mcp-action-actor";
import { McpRequestContext, McpToolError } from "../server/mcp-context";
import { normalizeName, resolveOne } from "./name-resolver";
import { McpToolDefinition, reais } from "./tool-output";

type Payable = Awaited<ReturnType<AccountsPayableService["get"]>>;

const ACTION = { group: "PAYABLES" as const, writes: true };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DRE_CLASSES = [
  DreExpenseClass.FIXED_COST,
  DreExpenseClass.VARIABLE_EXPENSE,
  DreExpenseClass.EXCLUDED,
] as const;

const date = (description: string) =>
  z.string().regex(DATE, "Use o formato AAAA-MM-DD").describe(description);
const competence = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/, "Use AAAA-MM ou AAAA-MM-DD")
  .describe("Competencia (mes a que a despesa pertence): AAAA-MM ou AAAA-MM-DD.");
const money = (description: string) => z.number().positive().max(10_000_000).describe(description);
const payableId = z.string().uuid().describe("Id da conta (campo id de contas_a_pagar).");

@Injectable()
export class PayablesActionsTools {
  constructor(@Inject(AccountsPayableService) private readonly payables: AccountsPayableService) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "criar_conta_a_pagar",
        area: McpDataArea.PAYABLES,
        title: "Criar conta a pagar",
        description:
          "ACAO: cria uma conta a pagar (ou uma serie recorrente) com as mesmas regras da tela. Categoria, fornecedor e classificacao no DRE como no formulario. Se ja existir conta com mesma descricao, valor e vencimento, nao cria e pede confirmarDuplicidade. Confirme os dados com o usuario antes de chamar.",
        action: { ...ACTION },
        inputSchema: {
          descricao: z.string().trim().min(1).max(160).describe("Descricao da conta."),
          valorReais: money("Valor previsto em reais."),
          vencimento: date("Vencimento (AAAA-MM-DD). Em recorrencias, o da primeira ocorrencia."),
          categoria: z.string().min(1).describe("Categoria financeira (nome ou id)."),
          fornecedor: z.string().min(1).optional().describe("Fornecedor (nome ou id)."),
          competencia: competence.optional(),
          documento: z.string().max(120).optional().describe("Numero do documento ou nota."),
          observacoes: z.string().max(500).optional(),
          classificacaoDre: z
            .enum(DRE_CLASSES)
            .optional()
            .describe("Ajuste da classificacao no DRE. Ausente = seguir a categoria."),
          recorrencia: z
            .object({
              frequencia: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
              intervalo: z.number().int().min(1).max(12).default(1),
              fim: date("Ultimo vencimento (AAAA-MM-DD).").optional(),
              quantidade: z
                .number()
                .int()
                .min(1)
                .max(60)
                .optional()
                .describe("Numero de ocorrencias."),
            })
            .optional()
            .describe("Repete a conta. Informe fim ou quantidade."),
          confirmarDuplicidade: z.boolean().optional(),
        },
        handler: (context, args) => this.create(context, args),
      },
      {
        name: "registrar_pagamento_conta",
        area: McpDataArea.PAYABLES,
        title: "Registrar pagamento de conta",
        description:
          "ACAO: registra um pagamento (parcial ou total, ate o valor restante) em uma conta a pagar, como na tela. Confirme com o usuario antes de chamar.",
        action: { ...ACTION },
        inputSchema: {
          contaId: payableId,
          valorReais: money("Valor pago em reais."),
          dataPagamento: date("Data do pagamento (AAAA-MM-DD)."),
          contaFinanceira: z.string().min(1).describe("Conta financeira de saida (nome ou id)."),
          observacoes: z.string().max(500).optional(),
        },
        handler: (context, args) => this.pay(context, args),
      },
      {
        name: "editar_conta_a_pagar",
        area: McpDataArea.PAYABLES,
        title: "Editar conta a pagar",
        description:
          "ACAO: altera somente os campos informados de uma conta a pagar (a ocorrencia, nao a serie), com as regras da tela: conta cancelada nao muda e o valor nao pode ficar abaixo do ja pago. Confirme com o usuario antes de chamar.",
        action: { ...ACTION, idempotent: true },
        inputSchema: {
          contaId: payableId,
          descricao: z.string().trim().min(1).max(160).optional(),
          valorReais: money("Novo valor previsto.").optional(),
          vencimento: date("Novo vencimento.").optional(),
          competencia: competence.nullable().optional(),
          categoria: z.string().min(1).optional(),
          fornecedor: z.string().min(1).nullable().optional().describe("null remove o fornecedor."),
          documento: z.string().max(120).nullable().optional(),
          observacoes: z.string().max(500).nullable().optional(),
          classificacaoDre: z
            .enum(DRE_CLASSES)
            .nullable()
            .optional()
            .describe("null volta a seguir a categoria."),
        },
        handler: (context, args) => this.edit(context, args),
      },
      {
        name: "cancelar_conta_a_pagar",
        area: McpDataArea.PAYABLES,
        title: "Cancelar conta a pagar",
        description:
          "ACAO: cancela uma conta a pagar sem pagamentos, com motivo obrigatorio. Confirme com o usuario antes de chamar.",
        action: { ...ACTION, destructive: true, idempotent: true },
        inputSchema: {
          contaId: payableId,
          motivo: z.string().trim().min(3).max(500).describe("Motivo do cancelamento."),
        },
        handler: (context, args) => this.cancel(context, args),
      },
    ];
  }

  private async create(context: McpRequestContext, args: Record<string, unknown>) {
    const actor = mcpActor(context);
    const options = await this.payables.getOptions(context.tenantId);
    const category = resolveOne(String(args.categoria), options.categories, "categoria");
    const supplier =
      typeof args.fornecedor === "string"
        ? resolveOne(args.fornecedor, options.suppliers, "fornecedor")
        : null;
    const description = String(args.descricao).trim();
    const amount = Number(args.valorReais);
    const dueDate = String(args.vencimento);

    if (args.confirmarDuplicidade !== true) {
      const existing = await this.findDuplicate(context.tenantId, description, amount, dueDate);
      if (existing) {
        return {
          duplicidade: true,
          mensagem:
            "Ja existe uma conta com a mesma descricao, valor e vencimento. Confirme com o usuario e chame de novo com confirmarDuplicidade: true para criar mesmo assim.",
          contaExistente: mapPayable(existing),
        };
      }
    }

    const recurrence = args.recorrencia as
      | {
          frequencia: FinancialRecurrenceFrequency;
          intervalo?: number;
          fim?: string;
          quantidade?: number;
        }
      | undefined;
    if (recurrence && !recurrence.fim && !recurrence.quantidade) {
      throw new McpToolError(
        "INVALID_FILTER",
        "Na recorrencia, informe o fim ou a quantidade de ocorrencias."
      );
    }

    const dto: PayableDto = {
      categoryId: category.id,
      supplierId: supplier?.id ?? null,
      description,
      documentReference: optionalText(args.documento),
      competenceDate: toCompetenceDate(args.competencia),
      dreClassOverride: (args.classificacaoDre as DreExpenseClass | undefined) ?? null,
      dueDate,
      expectedAmount: amount,
      notes: optionalText(args.observacoes),
      recurrence: recurrence
        ? {
            frequency: recurrence.frequencia,
            interval: recurrence.intervalo ?? 1,
            startsOn: dueDate,
            endsOn: recurrence.fim,
            occurrenceCount: recurrence.quantidade,
          }
        : null,
    };
    const created = await asMcpAction(context, () => this.payables.create(actor, dto));
    return { criadas: created.items.length, contas: created.items.map(mapPayable) };
  }

  private async pay(context: McpRequestContext, args: Record<string, unknown>) {
    const actor = mcpActor(context);
    const options = await this.payables.getOptions(context.tenantId);
    const account = resolveOne(String(args.contaFinanceira), options.accounts, "conta financeira");
    const updated = await asMcpAction(context, () =>
      this.payables.addPayment(actor, String(args.contaId), {
        financialAccountId: account.id,
        amount: Number(args.valorReais),
        paidAt: String(args.dataPagamento),
        notes: optionalText(args.observacoes),
      })
    );
    return { conta: mapPayable(updated as Payable), contaFinanceira: account.name };
  }

  private async edit(context: McpRequestContext, args: Record<string, unknown>) {
    const actor = mcpActor(context);
    const id = String(args.contaId);
    const current = await this.payables.get(context.tenantId, id);
    const needsOptions = typeof args.categoria === "string" || typeof args.fornecedor === "string";
    const options = needsOptions ? await this.payables.getOptions(context.tenantId) : null;

    const dto: PayableDto = {
      categoryId:
        typeof args.categoria === "string" && options
          ? resolveOne(args.categoria, options.categories, "categoria").id
          : current.categoryId,
      supplierId:
        args.fornecedor === null
          ? null
          : typeof args.fornecedor === "string" && options
            ? resolveOne(args.fornecedor, options.suppliers, "fornecedor").id
            : current.supplierId,
      description: typeof args.descricao === "string" ? args.descricao.trim() : current.description,
      documentReference: pick(args.documento, current.documentReference ?? undefined),
      competenceDate:
        args.competencia === null
          ? undefined
          : args.competencia !== undefined
            ? toCompetenceDate(args.competencia)
            : (current.competenceDate ?? undefined),
      dreClassOverride:
        args.classificacaoDre !== undefined
          ? (args.classificacaoDre as DreExpenseClass | null)
          : current.dreClassOverride,
      dueDate: typeof args.vencimento === "string" ? args.vencimento : (current.dueDate ?? ""),
      expectedAmount:
        typeof args.valorReais === "number" ? args.valorReais : Number(current.expectedAmount),
      notes: pick(args.observacoes, current.notes ?? undefined),
    };
    const updated = await asMcpAction(context, () => this.payables.update(actor, id, dto));
    return { antes: mapPayable(current), depois: mapPayable(updated as Payable) };
  }

  private async cancel(context: McpRequestContext, args: Record<string, unknown>) {
    const actor = mcpActor(context);
    const updated = await asMcpAction(context, () =>
      this.payables.cancel(actor, String(args.contaId), { reason: String(args.motivo).trim() })
    );
    const payable = updated as Payable;
    return { conta: { ...mapPayable(payable), motivo: payable.cancellationReason } };
  }

  private async findDuplicate(
    tenantId: string,
    description: string,
    amount: number,
    dueDate: string
  ) {
    const page = await this.payables.list(tenantId, {
      start: dueDate,
      end: dueDate,
      page: 1,
      pageSize: 100,
    });
    return page.items.find(
      (item) =>
        item.status !== "CANCELLED" &&
        normalizeName(item.description) === normalizeName(description) &&
        Number(item.expectedAmount) === amount
    );
  }
}

export function mapPayable(payable: Payable) {
  return {
    id: payable.id,
    descricao: payable.description,
    categoria: payable.categoryName,
    fornecedor: payable.supplierName,
    competencia: payable.competenceDate,
    vencimento: payable.dueDate,
    valorReais: reais(payable.expectedAmount),
    pagoReais: reais(payable.paidAmount),
    restanteReais: reais(payable.remainingAmount),
    classificacaoDre: payable.effectiveDreClass,
    classificacaoAjustada: payable.dreClassOverride !== null,
    status: payable.status,
  };
}

/** `AAAA-MM` becomes the first day of the month. */
export function toCompetenceDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length === 7 ? `${value}-01` : value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Edited field: null clears it, undefined keeps the current value. */
function pick(value: unknown, current: string | undefined): string | undefined {
  if (value === null) return undefined;
  if (typeof value === "string") return optionalText(value);
  return current;
}
