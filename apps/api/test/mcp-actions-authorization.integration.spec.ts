import { INestApplication } from "@nestjs/common";
import { McpDataArea, McpToolCallResult } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMcpFakePrisma, McpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  authorizeQuery,
  CIMD_CLIENT_ID,
  CLIENT_REDIRECT,
  createOAuthApp,
  MCP_URL,
  pkce,
  seedOAuthWorld,
  USERS,
} from "./support/mcp-oauth-fixtures";
import {
  connectClient,
  createServiceMocks,
  listen,
  seedToken,
  ServiceMocks,
  STORE_A,
} from "./support/mcp-service-fixtures";

const PAYABLE_ACTIONS = [
  "criar_conta_a_pagar",
  "registrar_pagamento_conta",
  "editar_conta_a_pagar",
  "cancelar_conta_a_pagar",
];
const IMPORT_TOOLS = [
  "integracoes_de_vendas",
  "importar_vendas_previa",
  "importacao_status",
  "importar_vendas_confirmar",
];

const PAYABLE = {
  id: "11111111-aaaa-4aaa-8aaa-111111111111",
  categoryId: "cat-1",
  categoryName: "Aluguel",
  supplierId: null,
  supplierName: null,
  description: "Aluguel",
  documentReference: null,
  competenceDate: "2026-11-01",
  dreClassOverride: null,
  effectiveDreClass: "FIXED_COST",
  dueDate: "2026-11-10",
  expectedAmount: "3000.00",
  paidAmount: "0.00",
  remainingAmount: "3000.00",
  status: "OPEN",
  notes: null,
  cancellationReason: null,
};

describe("MCP actions authorization (SC-001)", () => {
  let prisma: McpFakePrisma;
  let services: ServiceMocks;
  let app: INestApplication;
  let url: string;
  const clients: Array<{ close: () => Promise<void> }> = [];

  beforeAll(async () => {
    prisma = createMcpFakePrisma();
    services = createServiceMocks();
    app = await createOAuthApp(prisma, services);
    url = await listen(app);
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
    seedOAuthWorld(prisma);
    setActions(true);
    Object.assign(services.payables, {
      create: vi.fn(async () => ({ items: [PAYABLE], summary: {} })),
      list: vi.fn(async () => ({ items: [], summary: {}, total: 0 })),
    });
  });

  afterEach(async () => {
    while (clients.length) await clients.pop()!.close();
  });

  afterAll(async () => {
    await app?.close();
  });

  function setActions(enabled: boolean, areas: McpDataArea[] = Object.values(McpDataArea)) {
    for (const configuration of prisma.state.configurations) {
      Object.assign(configuration, { actionsEnabled: enabled, enabledAreas: areas });
    }
  }

  function grant(userId: string, permissions: string[]) {
    prisma.state.assignments.push({ userId, tenantId: STORE_A, status: "ACTIVE", permissions });
  }

  async function connect(userId: string, allowActions: boolean) {
    const http = request(app.getHttpServer());
    const { verifier, challenge } = pkce();
    const authorize = await http
      .get(`/api/oauth/authorize?${authorizeQuery({ scope: "mcp:read mcp:write" }, challenge)}`)
      .expect(302);
    const requestId = new URL(authorize.headers.location).searchParams.get("pedido")!;
    const view = await http
      .get(`/api/oauth/requests/${requestId}`)
      .set("Authorization", `Bearer ${userId}`)
      .expect(200);
    const approved = await http
      .post(`/api/oauth/requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${userId}`)
      .send({ storeId: STORE_A, allowActions })
      .expect(200);
    const code = new URL(approved.body.redirectUrl).searchParams.get("code")!;
    const token = await http
      .post("/api/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: CLIENT_REDIRECT,
        client_id: CIMD_CLIENT_ID,
        resource: MCP_URL,
      })
      .expect(200);
    const client = await connectClient(url, token.body.access_token);
    clients.push(client);
    return { client, scope: token.body.scope as string, view: view.body };
  }

  async function toolNames(client: Awaited<ReturnType<typeof connect>>["client"]) {
    return (await client.listTools()).tools.map((tool) => tool.name);
  }

  const createArgs = {
    descricao: "Aluguel",
    valorReais: 3000,
    vencimento: "2026-11-10",
    categoria: "aluguel centro",
  };

  it("grants and exposes actions only with the store setting, the consent and the user's permissions", async () => {
    const { client, scope, view } = await connect(USERS.owner, true);

    expect(view.stores[0].actions.map((item: { group: string }) => item.group)).toEqual([
      "PAYABLES",
      "SALES_IMPORT",
    ]);
    expect(scope).toBe("mcp:read mcp:write");
    const names = await toolNames(client);
    expect(names).toEqual(
      expect.arrayContaining([...PAYABLE_ACTIONS, ...IMPORT_TOOLS, "contas_a_pagar"])
    );

    const tools = (await client.listTools()).tools;
    expect(tools.find((tool) => tool.name === "cancelar_conta_a_pagar")?.annotations).toMatchObject(
      {
        readOnlyHint: false,
        destructiveHint: true,
      }
    );
    expect(tools.find((tool) => tool.name === "contas_a_pagar")?.annotations).toMatchObject({
      readOnlyHint: true,
    });

    const result = await client.callTool({ name: "criar_conta_a_pagar", arguments: createArgs });
    expect(result.isError).toBeFalsy();
    expect(services.payables.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: USERS.owner, tenantId: STORE_A }),
      expect.objectContaining({ categoryId: "cat-1", description: "Aluguel", expectedAmount: 3000 })
    );
    const logged = prisma.state.calls.find(
      (call) => call.target === "criar_conta_a_pagar"
    ) as unknown as {
      isAction: boolean;
      result: string;
    };
    expect(logged).toMatchObject({ isAction: true, result: McpToolCallResult.SUCCESS });
  });

  it("keeps the connection read-only without the explicit consent", async () => {
    const { client, scope } = await connect(USERS.owner, false);

    expect(scope).toBe("mcp:read");
    const names = await toolNames(client);
    expect(names).toContain("contas_a_pagar");
    for (const name of [...PAYABLE_ACTIONS, ...IMPORT_TOOLS]) expect(names).not.toContain(name);

    const call = await client
      .callTool({ name: "criar_conta_a_pagar", arguments: createArgs })
      .catch((error: Error) => ({
        isError: true,
        content: [{ type: "text", text: error.message }],
      }));
    expect(call.isError).toBe(true);
    expect(services.payables.create).not.toHaveBeenCalled();
  });

  it("grants only reading when the store does not allow actions", async () => {
    setActions(false);
    const { client, scope, view } = await connect(USERS.owner, true);

    expect(view.stores[0].actions).toEqual([]);
    expect(scope).toBe("mcp:read");
    expect(await toolNames(client)).not.toContain("criar_conta_a_pagar");
  });

  it("stops actions immediately when the store disables them", async () => {
    const { client } = await connect(USERS.owner, true);
    expect(await toolNames(client)).toContain("criar_conta_a_pagar");

    setActions(false);
    expect(await toolNames(client)).not.toContain("criar_conta_a_pagar");
  });

  it("follows the user's current permissions per action group", async () => {
    grant(USERS.operatorWithPermission, ["finance.manage"]);
    const { client, scope, view } = await connect(USERS.operatorWithPermission, true);

    expect(view.stores[0].actions.map((item: { group: string }) => item.group)).toEqual([
      "PAYABLES",
    ]);
    expect(scope).toBe("mcp:read mcp:write");
    const names = await toolNames(client);
    expect(names).toEqual(expect.arrayContaining(PAYABLE_ACTIONS));
    for (const name of IMPORT_TOOLS) expect(names).not.toContain(name);

    prisma.state.assignments = prisma.state.assignments.filter(
      (assignment) =>
        !(
          assignment.userId === USERS.operatorWithPermission &&
          assignment.permissions.includes("finance.manage")
        )
    );
    expect(await toolNames(client)).not.toContain("criar_conta_a_pagar");
  });

  it("does not grant actions to a user without any action permission", async () => {
    const { scope, view } = await connect(USERS.operatorWithPermission, true);

    expect(view.stores[0].actions).toEqual([]);
    expect(scope).toBe("mcp:read");
  });

  it("hides actions of a disabled data area", async () => {
    setActions(true, [McpDataArea.SALES, McpDataArea.FINANCIAL]);
    const { client } = await connect(USERS.owner, true);

    const names = await toolNames(client);
    expect(names).toEqual(expect.arrayContaining(IMPORT_TOOLS));
    for (const name of PAYABLE_ACTIONS) expect(names).not.toContain(name);
  });

  it("never exposes actions to the static store token", async () => {
    const { token } = seedToken(prisma, STORE_A);
    const client = await connectClient(url, token);
    clients.push(client);

    const names = await toolNames(client);
    expect(names).toContain("contas_a_pagar");
    for (const name of [...PAYABLE_ACTIONS, ...IMPORT_TOOLS]) expect(names).not.toContain(name);
  });

  it("limits actions per connection per hour", async () => {
    const { client } = await connect(USERS.owner, true);
    const connection = prisma.state.oauthConnections[0];
    for (let index = 0; index < 30; index += 1) {
      prisma.state.calls.push({
        id: `call-${index}`,
        tenantId: STORE_A,
        tokenId: null,
        connectionId: connection.id,
        isAction: true,
        method: "tools/call",
        target: "criar_conta_a_pagar",
        arguments: null,
        result: McpToolCallResult.SUCCESS,
        errorCode: null,
        durationMs: 1,
        occurredAt: new Date(),
      } as never);
    }

    const result = await client.callTool({ name: "criar_conta_a_pagar", arguments: createArgs });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("Limite de 30 acoes por hora");
    expect(services.payables.create).not.toHaveBeenCalled();
  });
});
