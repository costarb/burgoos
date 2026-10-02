import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import { createOAuthApp, exchangeCode, obtainCode, seedOAuthWorld, USERS } from "./support/mcp-oauth-fixtures";
import { ALL_TOOL_CALLS, createServiceMocks, STORE_A, STORE_B, STORE_DATA } from "./support/mcp-service-fixtures";

const rpc = (id: number, method: string, params: Record<string, unknown> = {}) => ({ jsonrpc: "2.0", id, method, params });

describe("MCP OAuth isolation, revocation and management", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();
  const services = createServiceMocks();
  const http = () => request(app.getHttpServer());
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeAll(async () => {
    app = await createOAuthApp(prisma, services);
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
    seedOAuthWorld(prisma);
    Object.values(services).forEach((service) => Object.values(service).forEach((method) => method.mockClear()));
  });

  afterAll(async () => {
    await app?.close();
  });

  const mcp = (token: string, body: unknown) =>
    http().post("/api/mcp").set("Accept", "application/json, text/event-stream").set("Authorization", `Bearer ${token}`).send(body as object);

  async function connect(userId: string = USERS.owner, storeId: string = STORE_A) {
    const tokens = (await exchangeCode(app, await obtainCode(app, { userId, storeId })).expect(200)).body;
    return tokens.access_token as string;
  }

  it("a multi-store user's connection to store A never reaches store B (SC-004)", async () => {
    const token = await connect(USERS.multiStore, STORE_A);
    const outputs: unknown[] = [];
    for (const [index, call] of ALL_TOOL_CALLS.entries()) {
      outputs.push((await mcp(token, rpc(index + 1, "tools/call", call)).expect(200)).body);
    }
    outputs.push((await mcp(token, rpc(99, "resources/read", { uri: "rrfive://loja/perfil" })).expect(200)).body);
    const everything = JSON.stringify(outputs);

    expect(everything).toContain(STORE_DATA[STORE_A].product);
    for (const marker of [STORE_DATA[STORE_B].name, STORE_DATA[STORE_B].product, STORE_DATA[STORE_B].supplier, STORE_B]) {
      expect(everything).not.toContain(marker);
    }
    const tenants = Object.values(services).flatMap((service) =>
      Object.values(service).flatMap((method) => (method.mock.calls as unknown[][]).map((args) => args[0]))
    );
    expect(new Set(tenants)).toEqual(new Set([STORE_A]));
  });

  it.each([
    ["connection revoked", (connection: Record<string, unknown>) => (connection.revokedAt = new Date()), "CONNECTION_REVOKED"],
    ["MCP disabled", () => (prisma.state.configurations.find((item) => item.tenantId === STORE_A)!.enabled = false), "MCP_DISABLED"],
    ["store inactive", () => (prisma.state.tenants.find((item) => item.id === STORE_A)!.active = false), "STORE_INACTIVE"],
    ["user inactivated", () => (prisma.state.users.find((item) => item.id === USERS.operatorWithPermission)!.status = "INACTIVE"), "USER_INACTIVE"],
    [
      "store access lost",
      () => (prisma.state.assignments.find((item) => item.userId === USERS.multiStore && item.tenantId === STORE_B)!.status = "INACTIVE"),
      "STORE_ACCESS_LOST",
    ],
  ] as const)("refuses the connection after %s with the phase-1 401", async (label, mutate, reason) => {
    const [userId, storeId] =
      label === "store access lost"
        ? [USERS.multiStore, STORE_B]
        : label === "user inactivated"
          ? [USERS.operatorWithPermission, STORE_A]
          : [USERS.owner, STORE_A];
    const token = await connect(userId, storeId);
    await mcp(token, rpc(1, "tools/list")).expect(200);

    mutate(prisma.state.oauthConnections[0]);
    const refused = await mcp(token, rpc(2, "tools/call", { name: "dre", arguments: {} })).expect(401);
    expect(refused.body).toMatchObject({ error: "unauthorized", message: "Token MCP invalido ou sem acesso." });
    await settle();
    expect(prisma.state.calls).toContainEqual(
      expect.objectContaining({ result: "DENIED", errorCode: reason, connectionId: prisma.state.oauthConnections[0].id, target: "dre" })
    );
  });

  it("restores the connection when the MCP is enabled again", async () => {
    const token = await connect();
    const configuration = prisma.state.configurations.find((item) => item.tenantId === STORE_A)!;
    configuration.enabled = false;
    await mcp(token, rpc(1, "tools/list")).expect(401);
    configuration.enabled = true;
    await mcp(token, rpc(2, "tools/list")).expect(200);
  });

  describe("admin connections", () => {
    it("lists the active store's connections and revokes them with audit", async () => {
      const token = await connect();
      await connect(USERS.multiStore, STORE_B);
      await mcp(token, rpc(1, "tools/call", { name: "dre", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } })).expect(200);
      await settle();

      const listed = await http().get("/api/admin/mcp/connections").set("Authorization", `Bearer ${USERS.owner}`).expect(200);
      expect(listed.body).toEqual([
        expect.objectContaining({
          clientName: "Claude",
          clientKind: "CIMD",
          redirectHost: "client.example.com",
          userName: "Dono Centro",
          status: "ACTIVE",
          lastUsedAt: expect.any(String),
        }),
      ]);

      const usage = await http().get("/api/admin/mcp/usage").set("Authorization", `Bearer ${USERS.owner}`).expect(200);
      expect(usage.body.items[0]).toMatchObject({ clientName: "Claude", userName: "Dono Centro", tokenName: null, target: "dre" });

      const id = listed.body[0].id;
      const revoked = await http()
        .post(`/api/admin/mcp/connections/${id}/revoke`)
        .set("Authorization", `Bearer ${USERS.owner}`)
        .expect(200);
      expect(revoked.body).toMatchObject({ status: "REVOKED", revokedReason: "MANUAL" });
      await http().post(`/api/admin/mcp/connections/${id}/revoke`).set("Authorization", `Bearer ${USERS.owner}`).expect(200);
      expect(prisma.state.audits.filter((event) => event.eventType === "MCP_CONNECTION_REVOKED")).toHaveLength(1);
      await mcp(token, rpc(2, "tools/list")).expect(401);
    });

    it("does not reveal or revoke another store's connection", async () => {
      await connect(USERS.multiStore, STORE_B);
      const otherId = prisma.state.oauthConnections[0].id;
      await http()
        .post(`/api/admin/mcp/connections/${otherId}/revoke`)
        .set("Authorization", `Bearer ${USERS.owner}`)
        .expect(404);
      expect(prisma.state.oauthConnections[0].revokedAt).toBeNull();
      const listed = await http().get("/api/admin/mcp/connections").set("Authorization", `Bearer ${USERS.owner}`).expect(200);
      expect(listed.body).toEqual([]);
    });

    it("requires mcp.manage", async () => {
      await http().get("/api/admin/mcp/connections").set("Authorization", `Bearer ${USERS.operatorWithout}`).expect(403);
    });
  });
});
