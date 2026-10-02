import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  createMcpServerApp,
  createServiceMocks,
  seedStore,
  seedToken,
  STORE_A,
} from "./support/mcp-service-fixtures";

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "auth-test", version: "1.0.0" },
  },
};

const toolCall = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: { name: "dre", arguments: {} },
};

const UNAUTHORIZED = { error: "unauthorized", message: "Token MCP invalido ou sem acesso." };

describe("MCP token authentication", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();

  beforeAll(async () => {
    app = await createMcpServerApp(prisma, createServiceMocks());
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (token: string | null, body: unknown = initialize) => {
    const call = request(app.getHttpServer())
      .post("/api/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json");
    if (token !== null) call.set("Authorization", token);
    return call.send(body as object);
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  it("accepts a valid token of an enabled store", async () => {
    seedStore(prisma, STORE_A);
    const { token } = seedToken(prisma, STORE_A);

    const response = await post(`Bearer ${token}`).expect(200);
    expect(response.body.result.serverInfo.name).toBe("rrfive-os");
  });

  it.each([
    ["missing header", null],
    ["non bearer scheme", "Basic abc"],
    ["malformed token", "Bearer rrf_mcp_curto"],
    ["unknown token", `Bearer rrf_mcp_${"z".repeat(43)}`],
  ])("rejects %s with the generic 401 and no usage log", async (_label, header) => {
    seedStore(prisma, STORE_A);

    const response = await post(header).expect(401);

    expect(response.body).toMatchObject(UNAUTHORIZED);
    expect(response.headers["www-authenticate"]).toContain("Bearer");
    await settle();
    expect(prisma.state.calls).toHaveLength(0);
  });

  it.each([
    ["revoked token", "TOKEN_REVOKED", { token: { revokedAt: new Date() } }],
    ["expired token", "TOKEN_EXPIRED", { token: { expiresAt: new Date("2020-01-01T00:00:00Z") } }],
    ["disabled MCP", "MCP_DISABLED", { store: { enabled: false } }],
    ["inactive store", "STORE_INACTIVE", { store: { active: false } }],
  ] as const)(
    "rejects a %s with the same 401 and logs the refusal",
    async (_label, reason, setup: { token?: object; store?: object }) => {
      seedStore(prisma, STORE_A, setup.store ?? {});
      const { id, token } = seedToken(prisma, STORE_A, setup.token ?? {});

      const response = await post(`Bearer ${token}`, toolCall).expect(401);

      expect(response.body).toMatchObject(UNAUTHORIZED);
      await settle();
      expect(prisma.state.calls).toEqual([
        expect.objectContaining({
          tenantId: STORE_A,
          tokenId: id,
          method: "tools/call",
          target: "dre",
          result: "DENIED",
          errorCode: reason,
        }),
      ]);
    }
  );

  it("cuts access on the next call after revocation and restores after re-enabling", async () => {
    seedStore(prisma, STORE_A);
    const { id, token } = seedToken(prisma, STORE_A);
    await post(`Bearer ${token}`).expect(200);

    prisma.state.configurations[0].enabled = false;
    await post(`Bearer ${token}`).expect(401);

    prisma.state.configurations[0].enabled = true;
    await post(`Bearer ${token}`).expect(200);

    prisma.state.tokens.find((item) => item.id === id)!.revokedAt = new Date();
    await post(`Bearer ${token}`).expect(401);
  });
});

describe("MCP rate limit", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();

  beforeAll(async () => {
    app = await createMcpServerApp(prisma, createServiceMocks(), {
      MCP_RATE_LIMIT_PER_MINUTE: "3",
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("limits requests per token and logs the refusal", async () => {
    resetMcpFakePrisma(prisma);
    seedStore(prisma, STORE_A);
    const first = seedToken(prisma, STORE_A);
    const second = seedToken(prisma, STORE_A);
    const post = (token: string) =>
      request(app.getHttpServer())
        .post("/api/mcp")
        .set("Accept", "application/json, text/event-stream")
        .set("Authorization", `Bearer ${token}`)
        .send(initialize);

    for (let index = 0; index < 3; index += 1) await post(first.token).expect(200);
    const limited = await post(first.token).expect(429);
    expect(limited.body).toMatchObject({
      code: "RATE_LIMITED",
      message: "Muitas requisicoes. Tente novamente em instantes.",
    });

    await post(second.token).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(prisma.state.calls).toContainEqual(
      expect.objectContaining({ tokenId: first.id, result: "DENIED", errorCode: "RATE_LIMITED" })
    );
  });
});
