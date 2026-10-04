import { ConflictException } from "@nestjs/common";
import { McpDataArea } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentActionOrigin } from "../src/common/observability/action-origin";
import { McpRequestContext } from "../src/management/mcp/server/mcp-context";
import { SalesImportTools } from "../src/management/mcp/tools/sales-import.tools";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const RUN_ID = "bbbbbbbb-0000-4000-8000-000000000001";

const context: McpRequestContext = {
  tenantId: TENANT,
  tokenId: null,
  connectionId: "connection-1",
  userId: USER_ID,
  clientName: "ChatGPT",
  enabledAreas: Object.values(McpDataArea),
  storeName: "Loja",
  storeSlug: "loja",
  actions: { allowed: true, elevated: true, permissions: [], channel: "MCP · ChatGPT" },
};

const INTEGRATIONS = [
  {
    id: "int-pag",
    provider: "PAGBANK",
    displayName: "PagBank Loja",
    status: "ACTIVE",
    lastSyncAt: null,
    runs: [],
  },
  {
    id: "int-mp",
    provider: "MERCADO_PAGO",
    displayName: "Mercado Pago",
    status: "ACTIVE",
    lastSyncAt: null,
    runs: [
      {
        id: "run-0",
        startDate: new Date("2026-10-01T00:00:00Z"),
        endDate: new Date("2026-10-01T00:00:00Z"),
        status: "COMPLETED",
        completedAt: new Date("2026-10-02T10:00:00Z"),
      },
    ],
  },
  {
    id: "int-if",
    provider: "IFOOD",
    displayName: "iFood",
    status: "PAUSED",
    lastSyncAt: null,
    runs: [],
  },
];

describe("MCP sales import actions (SC-003)", () => {
  const prisma = {
    salesIntegration: { findMany: vi.fn(async () => INTEGRATIONS) },
    product: {
      findMany: vi.fn(async () => [
        { id: "prod-1", name: "Combo Classico" },
        { id: "prod-2", name: "Hamburguer" },
      ]),
    },
  };
  const origins: Array<string | null> = [];
  const preview = {
    create: vi.fn(async (...args: unknown[]) => {
      origins.push(currentActionOrigin());
      return { id: RUN_ID, status: "PENDING", args };
    }),
    get: vi.fn(),
  };
  const processor = {
    queuePreview: vi.fn(async () => undefined),
    queueConfirmation: vi.fn(async () => undefined),
  };
  let tools: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>>;

  beforeEach(() => {
    vi.clearAllMocks();
    origins.length = 0;
    tools = Object.fromEntries(
      new SalesImportTools(prisma as never, preview as never, processor as never)
        .definitions()
        .map((tool) => [tool.name, (args: Record<string, unknown>) => tool.handler(context, args)])
    );
  });

  it("lists integrations with limits, last run and products for fixed attribution", async () => {
    const result = await tools.integracoes_de_vendas({});

    expect(result.integracoes).toEqual([
      expect.objectContaining({
        id: "int-pag",
        provedor: "PAGBANK",
        ativa: true,
        periodoMaximoDias: 31,
      }),
      expect.objectContaining({
        id: "int-mp",
        periodoMaximoDias: 364,
        cargaInicialDisponivel: true,
        ultimaImportacao: expect.objectContaining({ execucaoId: "run-0", situacao: "COMPLETED" }),
      }),
      expect.objectContaining({ id: "int-if", ativa: false, periodoMaximoDias: 90 }),
    ]);
    expect(result.produtosParaAtribuicao).toHaveLength(2);
  });

  it("starts a preview by provider with the screen's options and the MCP origin", async () => {
    const result = await tools.importar_vendas_previa({
      integracao: "pagbank",
      inicio: "2026-10-01",
      fim: "2026-10-02",
      atribuicao: "PRODUTO_FIXO",
      produto: "combo classico",
    });

    expect(preview.create).toHaveBeenCalledWith(
      TENANT,
      USER_ID,
      {
        integrationId: "int-pag",
        startDate: "2026-10-01",
        endDate: "2026-10-02",
        strategy: "FIXED_PRODUCT",
        fixedProductId: "prod-1",
      },
      "MANUAL"
    );
    expect(processor.queuePreview).toHaveBeenCalledWith(RUN_ID, TENANT);
    expect(origins).toEqual(["MCP · ChatGPT"]);
    expect(result).toMatchObject({ execucaoId: RUN_ID, provedor: "PAGBANK", situacao: "PENDING" });
  });

  it("offers the 30/60/90-day initial load only for Mercado Pago", async () => {
    await tools.importar_vendas_previa({
      integracao: "Mercado Pago",
      cargaInicialDias: 30,
      atribuicao: "AUTOMATICA_POR_VALOR",
    });
    const [, , dto, trigger] = preview.create.mock.calls[0] as [
      string,
      string,
      Record<string, string>,
      string,
    ];
    expect(trigger).toBe("INITIAL_LOAD");
    expect(dto.strategy).toBe("PRICE_WEIGHTED");
    expect((Date.parse(dto.endDate) - Date.parse(dto.startDate)) / 86_400_000).toBe(29);

    await expect(
      tools.importar_vendas_previa({
        integracao: "PAGBANK",
        cargaInicialDias: 30,
        atribuicao: "AUTOMATICA_POR_VALOR",
      })
    ).rejects.toThrow("apenas para o Mercado Pago");
  });

  it("enforces each provider's period limit and needs an active integration", async () => {
    await expect(
      tools.importar_vendas_previa({
        integracao: "PAGBANK",
        inicio: "2026-08-01",
        fim: "2026-09-15",
        atribuicao: "AUTOMATICA_POR_VALOR",
      })
    ).rejects.toThrow("ate 31 dias");
    await expect(
      tools.importar_vendas_previa({
        integracao: "IFOOD",
        inicio: "2026-10-01",
        fim: "2026-10-01",
        atribuicao: "AUTOMATICA_POR_VALOR",
      })
    ).rejects.toThrow("nao esta ativa");
    expect(preview.create).not.toHaveBeenCalled();
  });

  it("surfaces the overlap rule of the screen", async () => {
    preview.create.mockRejectedValueOnce(
      new ConflictException("Ja existe processamento sobreposto")
    );
    await expect(
      tools.importar_vendas_previa({
        integracao: "int-pag",
        inicio: "2026-10-01",
        fim: "2026-10-01",
        atribuicao: "AUTOMATICA_POR_VALOR",
      })
    ).rejects.toThrow("Ja existe processamento sobreposto");
  });

  it("summarizes a ready preview and confirms it idempotently", async () => {
    const ready = {
      id: RUN_ID,
      provider: "PAGBANK",
      status: "PARTIALLY_READY",
      startDate: new Date("2026-10-01T00:00:00Z"),
      endDate: new Date("2026-10-02T00:00:00Z"),
      requestedVia: "MCP · ChatGPT",
      counts: { found: 12, new: 9, duplicate: 3, existingOrders: 1, rejected: 0 },
      errorMessage: null,
      days: [
        { movementDate: new Date("2026-10-01T00:00:00Z"), status: "READY", errorMessage: null },
        {
          movementDate: new Date("2026-10-02T00:00:00Z"),
          status: "BLOCKED_DATE",
          errorMessage: "Dia ainda nao consolidado",
        },
      ],
    };
    preview.get.mockResolvedValue(ready);

    const status = await tools.importacao_status({ execucaoId: RUN_ID });
    expect(status).toMatchObject({
      podeConfirmar: true,
      origem: "MCP · ChatGPT",
      resumo: {
        vendasNovas: 9,
        duplicadas: 3,
        pedidosExistentes: 1,
        diasBloqueados: [{ data: "2026-10-02", motivo: "Dia ainda nao consolidado" }],
      },
    });

    await tools.importar_vendas_confirmar({ execucaoId: RUN_ID });
    expect(processor.queueConfirmation).toHaveBeenCalledWith(RUN_ID, TENANT);

    preview.get.mockResolvedValue({ ...ready, status: "COMPLETED" });
    const again = await tools.importar_vendas_confirmar({ execucaoId: RUN_ID });
    expect(again.mensagem).toContain("ja foi confirmada");
    expect(processor.queueConfirmation).toHaveBeenCalledTimes(1);
  });

  it("refuses to confirm a preview that is not ready", async () => {
    preview.get.mockResolvedValue({ id: RUN_ID, status: "FETCHING", counts: {}, days: [] });
    await expect(tools.importar_vendas_confirmar({ execucaoId: RUN_ID })).rejects.toThrow(
      "nao pode ser confirmada agora"
    );
    expect(processor.queueConfirmation).not.toHaveBeenCalled();
  });

  it("does not expose the iFood financial reconciliation", () => {
    const names = new SalesImportTools(prisma as never, preview as never, processor as never)
      .definitions()
      .map((tool) => tool.name);
    expect(names.some((name) => /concilia/.test(name))).toBe(false);
  });
});
