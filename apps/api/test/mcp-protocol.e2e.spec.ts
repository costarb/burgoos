import { INestApplication } from "@nestjs/common";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpDataArea } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  ALL_TOOL_CALLS,
  connectClient,
  createMcpServerApp,
  createServiceMocks,
  listen,
  seedStore,
  seedToken,
  STORE_A,
} from "./support/mcp-service-fixtures";

describe("MCP protocol (Streamable HTTP, stateless)", () => {
  let app: INestApplication;
  let url: string;
  let client: Client | null = null;
  const prisma = createMcpFakePrisma();
  const services = createServiceMocks();

  beforeAll(async () => {
    app = await createMcpServerApp(prisma, services);
    url = await listen(app);
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
  });

  afterEach(async () => {
    await client?.close();
    client = null;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("initializes and lists the 10 read-only tools in portuguese", async () => {
    seedStore(prisma, STORE_A);
    client = await connectClient(url, seedToken(prisma, STORE_A).token);

    expect(client.getServerVersion()?.name).toBe("rrfive-os");
    expect(client.getInstructions()).toContain("Loja Centro");

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      ALL_TOOL_CALLS.map((call) => call.name).sort()
    );
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(40);
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(JSON.stringify(tool.inputSchema)).not.toMatch(/storeId|tenantId/);
    }
  });

  it("calls every tool and returns structured JSON with the period used", async () => {
    seedStore(prisma, STORE_A);
    client = await connectClient(url, seedToken(prisma, STORE_A).token);

    for (const call of ALL_TOOL_CALLS) {
      const result = await client.callTool(call);
      expect(result.isError, call.name).toBeFalsy();
      const structured = result.structuredContent as Record<string, unknown>;
      expect(structured, call.name).toBeTruthy();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(JSON.parse(text)).toEqual(structured);
    }

    const sales = await client.callTool(ALL_TOOL_CALLS[0]);
    expect(sales.structuredContent).toMatchObject({
      periodo: { inicio: "2026-09-01", fim: "2026-09-30", fuso: "America/Sao_Paulo" },
      totais: { pedidos: 30, faturamentoBrutoReais: 1500.5, ticketMedioReais: 50.02 },
    });
  });

  it("returns a portuguese tool error for periods above 92 days", async () => {
    seedStore(prisma, STORE_A);
    client = await connectClient(url, seedToken(prisma, STORE_A).token);
    services.sales.getReport.mockClear();

    const result = await client.callTool({
      name: "resumo_vendas",
      arguments: { inicio: "2026-01-01", fim: "2026-09-30" },
    });

    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0].text).toContain("maximo por consulta e de 92 dias");
    expect(services.sales.getReport).not.toHaveBeenCalled();
  });

  it("serves the store profile, glossary and analysis prompts", async () => {
    seedStore(prisma, STORE_A);
    client = await connectClient(url, seedToken(prisma, STORE_A).token);

    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.name).sort()).toEqual([
      "glossario_metricas",
      "perfil_loja",
    ]);
    const profile = await client.readResource({ uri: "rrfive://loja/perfil" });
    expect(JSON.parse((profile.contents[0] as { text: string }).text)).toMatchObject({
      nome: "Loja Centro",
      fuso: "America/Sao_Paulo",
    });
    const glossary = await client.readResource({ uri: "rrfive://glossario" });
    expect((glossary.contents[0] as { text: string }).text).toContain("Engenharia de cardapio");

    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual([
      "analise_semanal",
      "comparar_periodos",
      "diagnostico_margem_cardapio",
      "saude_caixa_30_dias",
    ]);
    const prompt = await client.getPrompt({
      name: "comparar_periodos",
      arguments: { inicioA: "2026-08-01", fimA: "2026-08-31", inicioB: "2026-09-01", fimB: "2026-09-30" },
    });
    expect((prompt.messages[0].content as { text: string }).text).toContain("2026-08-01 a 2026-08-31");
  });

  it("exposes only tools and prompts of the enabled areas", async () => {
    seedStore(prisma, STORE_A, { areas: [McpDataArea.SALES] });
    client = await connectClient(url, seedToken(prisma, STORE_A).token);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "resumo_vendas",
      "resumo_diario",
      "relatorio_gerencial",
    ]);
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(["analise_semanal"]);

    const blocked = await client.callTool({ name: "estoque", arguments: {} });
    expect(blocked.isError).toBe(true);
    expect((blocked.content as Array<{ text: string }>)[0].text).toContain(
      "A area de dados Estoque nao esta liberada"
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(prisma.state.calls).toContainEqual(
      expect.objectContaining({ target: "estoque", result: "ERROR", errorCode: "AREA_DISABLED" })
    );
  });

  it("logs tool calls and touches the token", async () => {
    seedStore(prisma, STORE_A);
    const { id, token } = seedToken(prisma, STORE_A);
    client = await connectClient(url, token);

    await client.callTool({ name: "dre", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(prisma.state.calls).toContainEqual(
      expect.objectContaining({
        tenantId: STORE_A,
        tokenId: id,
        method: "tools/call",
        target: "dre",
        result: "SUCCESS",
        arguments: { inicio: "2026-09-01", fim: "2026-09-30" },
      })
    );
    expect(prisma.state.tokens.find((item) => item.id === id)?.lastUsedAt).toBeInstanceOf(Date);
  });

  it("rejects GET and DELETE with 405", async () => {
    await request(app.getHttpServer()).get("/api/mcp").expect(405);
    await request(app.getHttpServer()).delete("/api/mcp").expect(405);
  });
});
