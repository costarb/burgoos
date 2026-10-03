import { Inject, Injectable } from "@nestjs/common";
import {
  McpDataArea,
  SalesImportRunStatus,
  SalesIntegrationStatus,
  SalesProvider,
} from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../../platform/database/prisma.service";
import { period } from "../../sales-integrations/mercado-pago/mercado-pago-sync.controller";
import { SalesImportPreviewService } from "../../sales-integrations/sales-import-preview.service";
import { SalesImportRunProcessor } from "../../sales-integrations/sales-import-run.processor";
import { asMcpAction, mcpActor } from "../server/mcp-action-actor";
import { McpRequestContext, McpToolError } from "../server/mcp-context";
import { normalizeName, resolveOne } from "./name-resolver";
import { MAX_LIST_ITEMS, McpToolDefinition } from "./tool-output";

/** Same limits as the providers' adapters (the preview service enforces them again). */
export const MAX_PERIOD_DAYS: Record<SalesProvider, number> = {
  PAGBANK: 31,
  MERCADO_PAGO: 364,
  IFOOD: 90,
};

const PROVIDER_LABEL: Record<SalesProvider, string> = {
  PAGBANK: "PagBank",
  MERCADO_PAGO: "Mercado Pago",
  IFOOD: "iFood",
};

const CONFIRMABLE: SalesImportRunStatus[] = [
  SalesImportRunStatus.PREVIEW_READY,
  SalesImportRunStatus.PARTIALLY_READY,
];

const STATUS_LABEL: Record<SalesImportRunStatus, string> = {
  PENDING: "Na fila",
  FETCHING: "Buscando vendas no provedor",
  PREVIEW_READY: "Previa pronta para confirmar",
  PARTIALLY_READY: "Previa parcialmente pronta (ha dias bloqueados)",
  IMPORTING: "Importando",
  COMPLETED: "Concluida",
  COMPLETED_WITH_ERRORS: "Concluida com erros",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

const date = (description: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
    .describe(description);
const runId = z.string().uuid().describe("Id da execucao devolvido por importar_vendas_previa.");

interface RunCounts {
  found?: number;
  new?: number;
  duplicate?: number;
  rejected?: number;
  imported?: number;
  failed?: number;
  blockedDays?: number;
  existingOrders?: number;
}

@Injectable()
export class SalesImportTools {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SalesImportPreviewService) private readonly preview: SalesImportPreviewService,
    @Inject(SalesImportRunProcessor) private readonly processor: SalesImportRunProcessor
  ) {}

  definitions(): McpToolDefinition[] {
    return [
      {
        name: "integracoes_de_vendas",
        area: McpDataArea.SALES,
        title: "Integracoes de vendas",
        description:
          "Lista as integracoes de vendas da loja (PagBank, Mercado Pago, iFood) com situacao, periodo maximo por importacao e ultima importacao, e os produtos que podem receber a atribuicao fixa. Use antes de importar_vendas_previa.",
        action: { group: "SALES_IMPORT", writes: false },
        inputSchema: {},
        handler: (context) => this.list(context),
      },
      {
        name: "importar_vendas_previa",
        area: McpDataArea.SALES,
        title: "Importar vendas - previa",
        description:
          "ACAO: inicia a previa da importacao de vendas via API de uma integracao (PagBank, Mercado Pago ou iFood), com as opcoes da tela: periodo (inicio e fim) ou carga inicial de 30/60/90 dias (so Mercado Pago) e atribuicao dos itens (automatica por valor ou produto fixo). Nada e gravado em pedidos ate importar_vendas_confirmar. Acompanhe com importacao_status.",
        action: { group: "SALES_IMPORT", writes: true },
        inputSchema: {
          integracao: z
            .string()
            .min(1)
            .describe(
              "Id, nome da integracao ou provedor (PAGBANK, MERCADO_PAGO, IFOOD) quando houver uma so ativa."
            ),
          inicio: date("Data inicial (AAAA-MM-DD).").optional(),
          fim: date("Data final (AAAA-MM-DD).").optional(),
          cargaInicialDias: z
            .union([z.literal(30), z.literal(60), z.literal(90)])
            .optional()
            .describe("So Mercado Pago: importa os ultimos 30, 60 ou 90 dias ate ontem."),
          atribuicao: z
            .enum(["AUTOMATICA_POR_VALOR", "PRODUTO_FIXO"])
            .default("AUTOMATICA_POR_VALOR")
            .describe("Como os itens das vendas sao atribuidos aos produtos."),
          produto: z
            .string()
            .min(1)
            .optional()
            .describe("Produto (nome ou id) quando atribuicao = PRODUTO_FIXO."),
        },
        handler: (context, args) => this.startPreview(context, args),
      },
      {
        name: "importacao_status",
        area: McpDataArea.SALES,
        title: "Situacao da importacao",
        description:
          "Situacao de uma importacao de vendas e, com a previa pronta, o resumo: vendas novas, duplicadas, pedidos ja existentes e dias bloqueados com o motivo. Indica se pode confirmar.",
        action: { group: "SALES_IMPORT", writes: false },
        inputSchema: { execucaoId: runId },
        handler: (context, args) => this.status(context, String(args.execucaoId)),
      },
      {
        name: "importar_vendas_confirmar",
        area: McpDataArea.SALES,
        title: "Importar vendas - confirmar",
        description:
          "ACAO: confirma uma importacao com a previa pronta, gravando as vendas novas em pedidos. Repetir nao duplica. Mostre o resumo de importacao_status ao usuario e confirme antes de chamar.",
        action: { group: "SALES_IMPORT", writes: true, idempotent: true },
        inputSchema: { execucaoId: runId },
        handler: (context, args) => this.confirm(context, String(args.execucaoId)),
      },
    ];
  }

  private async list(context: McpRequestContext) {
    const [integrations, products] = await Promise.all([
      this.prisma.salesIntegration.findMany({
        where: { tenantId: context.tenantId },
        orderBy: [{ provider: "asc" }, { displayName: "asc" }],
        select: {
          id: true,
          provider: true,
          displayName: true,
          status: true,
          lastSyncAt: true,
          runs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, startDate: true, endDate: true, status: true, completedAt: true },
          },
        },
      }),
      this.prisma.product.findMany({
        where: { tenantId: context.tenantId, active: true },
        orderBy: { name: "asc" },
        take: MAX_LIST_ITEMS,
        select: { id: true, name: true },
      }),
    ]);

    return {
      integracoes: integrations.map((integration) => {
        const last = integration.runs[0];
        return {
          id: integration.id,
          provedor: integration.provider,
          nome: integration.displayName,
          situacao: integration.status,
          ativa: integration.status === SalesIntegrationStatus.ACTIVE,
          periodoMaximoDias: MAX_PERIOD_DAYS[integration.provider],
          cargaInicialDisponivel: integration.provider === SalesProvider.MERCADO_PAGO,
          ultimaImportacao: last
            ? {
                execucaoId: last.id,
                periodo: { inicio: dateOnly(last.startDate), fim: dateOnly(last.endDate) },
                situacao: last.status,
                concluidaEm: last.completedAt?.toISOString() ?? null,
              }
            : null,
        };
      }),
      produtosParaAtribuicao: products,
    };
  }

  private async startPreview(context: McpRequestContext, args: Record<string, unknown>) {
    const actor = mcpActor(context);
    const integration = await this.resolveIntegration(context.tenantId, String(args.integracao));
    const initialDays = args.cargaInicialDias as 30 | 60 | 90 | undefined;

    let dates: { startDate: string; endDate: string };
    if (initialDays) {
      if (integration.provider !== SalesProvider.MERCADO_PAGO) {
        throw new McpToolError(
          "INVALID_FILTER",
          "A carga inicial de 30/60/90 dias existe apenas para o Mercado Pago."
        );
      }
      dates = period(initialDays);
    } else {
      if (typeof args.inicio !== "string" || typeof args.fim !== "string") {
        throw new McpToolError(
          "INVALID_PERIOD",
          "Informe inicio e fim (AAAA-MM-DD) ou, no Mercado Pago, cargaInicialDias."
        );
      }
      dates = { startDate: args.inicio, endDate: args.fim };
      const days = dayCount(dates.startDate, dates.endDate);
      if (days < 1) {
        throw new McpToolError(
          "INVALID_PERIOD",
          "A data inicial deve ser anterior ou igual a final."
        );
      }
      if (days > MAX_PERIOD_DAYS[integration.provider]) {
        throw new McpToolError(
          "PERIOD_TOO_LONG",
          `O ${PROVIDER_LABEL[integration.provider]} aceita ate ${MAX_PERIOD_DAYS[integration.provider]} dias por importacao. Divida o periodo.`
        );
      }
    }

    let fixedProductId: string | undefined;
    if (args.atribuicao === "PRODUTO_FIXO") {
      if (typeof args.produto !== "string") {
        throw new McpToolError(
          "INVALID_FILTER",
          "Informe o produto para a atribuicao PRODUTO_FIXO."
        );
      }
      const products = await this.prisma.product.findMany({
        where: { tenantId: context.tenantId, active: true },
        select: { id: true, name: true },
      });
      fixedProductId = resolveOne(args.produto, products, "produto").id;
    }

    const run = await asMcpAction(context, async () => {
      const created = await this.preview.create(
        context.tenantId,
        actor.id,
        {
          integrationId: integration.id,
          ...dates,
          strategy: fixedProductId ? "FIXED_PRODUCT" : "PRICE_WEIGHTED",
          fixedProductId,
        },
        initialDays ? "INITIAL_LOAD" : "MANUAL"
      );
      await this.processor.queuePreview(created.id, context.tenantId);
      return created;
    });

    return {
      execucaoId: run.id,
      provedor: integration.provider,
      integracao: integration.displayName,
      periodo: { inicio: dates.startDate, fim: dates.endDate },
      situacao: run.status,
      mensagem:
        "Previa iniciada. Use importacao_status para acompanhar e ver o resumo antes de confirmar.",
    };
  }

  private async status(context: McpRequestContext, id: string) {
    const run = await this.preview.get(context.tenantId, id);
    const counts = (run.counts ?? {}) as RunCounts;
    const ready = CONFIRMABLE.includes(run.status) || run.status.startsWith("COMPLETED");
    return {
      execucaoId: run.id,
      provedor: run.provider,
      periodo: { inicio: dateOnly(run.startDate), fim: dateOnly(run.endDate) },
      situacao: run.status,
      descricaoSituacao: STATUS_LABEL[run.status],
      origem: run.requestedVia ?? "Tela",
      resumo: ready
        ? {
            encontradas: counts.found ?? 0,
            vendasNovas: counts.new ?? 0,
            duplicadas: counts.duplicate ?? 0,
            pedidosExistentes: counts.existingOrders ?? 0,
            rejeitadas: counts.rejected ?? 0,
            importadas: counts.imported ?? 0,
            falhas: counts.failed ?? 0,
            diasBloqueados: run.days
              .filter((day) => day.status.startsWith("BLOCKED") || day.status === "FAILED")
              .map((day) => ({
                data: dateOnly(day.movementDate),
                motivo: day.errorMessage ?? day.status,
              })),
          }
        : null,
      podeConfirmar: CONFIRMABLE.includes(run.status),
      erro: run.errorMessage ?? null,
    };
  }

  private async confirm(context: McpRequestContext, id: string) {
    mcpActor(context);
    const run = await this.preview.get(context.tenantId, id);
    if (run.status === SalesImportRunStatus.IMPORTING || run.status.startsWith("COMPLETED")) {
      return {
        execucaoId: run.id,
        situacao: run.status,
        mensagem: "Esta importacao ja foi confirmada. Use importacao_status para acompanhar.",
      };
    }
    if (!CONFIRMABLE.includes(run.status)) {
      throw new McpToolError(
        "INVALID_FILTER",
        `A importacao esta em "${STATUS_LABEL[run.status]}" e nao pode ser confirmada agora.`
      );
    }
    await asMcpAction(context, () => this.processor.queueConfirmation(run.id, context.tenantId));
    return {
      execucaoId: run.id,
      situacao: run.status,
      mensagem:
        "Confirmacao enviada. As vendas serao gravadas em instantes; acompanhe com importacao_status.",
    };
  }

  private async resolveIntegration(tenantId: string, value: string) {
    const integrations = await this.prisma.salesIntegration.findMany({
      where: { tenantId },
      select: { id: true, provider: true, displayName: true, status: true },
    });
    const provider = (Object.keys(PROVIDER_LABEL) as SalesProvider[]).find(
      (key) =>
        key === value.toUpperCase() || normalizeName(PROVIDER_LABEL[key]) === normalizeName(value)
    );
    if (
      provider &&
      !integrations.some(
        (item) => item.id === value || normalizeName(item.displayName) === normalizeName(value)
      )
    ) {
      const active = integrations.filter(
        (item) => item.provider === provider && item.status === SalesIntegrationStatus.ACTIVE
      );
      if (active.length === 1) return active[0];
      throw new McpToolError(
        "INVALID_FILTER",
        active.length === 0
          ? `Nenhuma integracao ativa do ${PROVIDER_LABEL[provider]}. Ative-a na tela de importacao.`
          : `Ha mais de uma integracao ativa do ${PROVIDER_LABEL[provider]}. Informe o nome ou id: ${active
              .map((item) => `${item.displayName} (${item.id})`)
              .join(", ")}.`
      );
    }
    const integration = resolveOne(
      value,
      integrations.map((item) => ({ ...item, name: item.displayName })),
      "integracao"
    );
    if (integration.status !== SalesIntegrationStatus.ACTIVE) {
      throw new McpToolError(
        "INVALID_FILTER",
        `A integracao ${integration.displayName} nao esta ativa (situacao ${integration.status}). Ative-a na tela de importacao.`
      );
    }
    return integration;
  }
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayCount(start: string, end: string): number {
  return (
    Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
  );
}
