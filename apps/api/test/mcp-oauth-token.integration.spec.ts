import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  CIMD_CLIENT_ID,
  CLIENT_REDIRECT,
  createOAuthApp,
  exchangeCode,
  LOOPBACK_CLIENT_ID,
  MCP_URL,
  obtainCode,
  seedOAuthWorld,
} from "./support/mcp-oauth-fixtures";
import { STORE_A } from "./support/mcp-service-fixtures";

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "oauth-test", version: "1" } },
};

describe("MCP OAuth token endpoint", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();
  const http = () => request(app.getHttpServer());
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  beforeAll(async () => {
    app = await createOAuthApp(prisma);
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
    seedOAuthWorld(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const mcpCall = (accessToken: string) =>
    http()
      .post("/api/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(initialize);

  const refresh = (refreshToken: string, clientId = CIMD_CLIENT_ID) =>
    http()
      .post("/api/oauth/token")
      .type("form")
      .send({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, resource: MCP_URL });

  it("exchanges the code for opaque tokens and uses the access token on the MCP server", async () => {
    const grant = await obtainCode(app);
    const response = await exchangeCode(app, grant).expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({
      access_token: expect.stringMatching(/^rrf_oat_/),
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: expect.stringMatching(/^rrf_ort_/),
      scope: "mcp:read",
    });
    expect(JSON.stringify(prisma.state.oauthTokens)).not.toContain(response.body.access_token);
    expect(prisma.state.oauthRequests[0].status).toBe("CONSUMED");

    const mcp = await mcpCall(response.body.access_token).expect(200);
    expect(mcp.body.result.serverInfo.name).toBe("rrfive-os");
    await settle();
    expect(prisma.state.oauthConnections[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it("supports loopback clients on any port", async () => {
    const grant = await obtainCode(app, {
      clientId: LOOPBACK_CLIENT_ID,
      redirectUri: "http://127.0.0.1:53123/callback",
    });
    await exchangeCode(app, grant).expect(200);
  });

  it.each([
    ["wrong verifier", { code_verifier: "x".repeat(43) }],
    ["different redirect", { redirect_uri: `${CLIENT_REDIRECT}/outro` }],
    ["unknown code", { code: "rrf_oac_inexistente" }],
  ])("rejects %s with invalid_grant", async (_label, overrides) => {
    const grant = await obtainCode(app);
    const response = await http()
      .post("/api/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code: grant.code,
        code_verifier: grant.verifier,
        redirect_uri: grant.redirectUri,
        client_id: grant.clientId,
        ...overrides,
      })
      .expect(400);
    expect(response.body.error).toBe("invalid_grant");
  });

  it("rejects expired codes, unknown clients, foreign resources, other grants and JSON bodies", async () => {
    const grant = await obtainCode(app);
    const base = {
      grant_type: "authorization_code",
      code: grant.code,
      code_verifier: grant.verifier,
      redirect_uri: grant.redirectUri,
      client_id: grant.clientId,
    };

    const unknownClient = await http().post("/api/oauth/token").type("form").send({ ...base, client_id: "mcpc_x" }).expect(401);
    expect(unknownClient.body.error).toBe("invalid_client");
    const target = await http()
      .post("/api/oauth/token")
      .type("form")
      .send({ ...base, resource: "https://other.example.com/mcp" })
      .expect(400);
    expect(target.body.error).toBe("invalid_target");
    const grantType = await http().post("/api/oauth/token").type("form").send({ ...base, grant_type: "password" }).expect(400);
    expect(grantType.body.error).toBe("unsupported_grant_type");
    const json = await http().post("/api/oauth/token").send(base).expect(400);
    expect(json.body.error).toBe("invalid_request");

    prisma.state.oauthRequests[0].codeExpiresAt = new Date(Date.now() - 1000);
    const expired = await exchangeCode(app, grant).expect(400);
    expect(expired.body.error).toBe("invalid_grant");
  });

  it("revokes the connection when a code is replayed", async () => {
    const grant = await obtainCode(app);
    const first = await exchangeCode(app, grant).expect(200);
    const replay = await exchangeCode(app, grant).expect(400);

    expect(replay.body.error).toBe("invalid_grant");
    expect(prisma.state.oauthConnections[0]).toMatchObject({ revokedReason: "CODE_REUSE" });
    expect(prisma.state.oauthConnections[0].revokedAt).toBeInstanceOf(Date);
    await mcpCall(first.body.access_token).expect(401);
  });

  it("rotates refresh tokens and revokes the connection on refresh reuse", async () => {
    const tokens = (await exchangeCode(app, await obtainCode(app)).expect(200)).body;

    const rotated = await refresh(tokens.refresh_token).expect(200);
    expect(rotated.body.refresh_token).not.toBe(tokens.refresh_token);
    await mcpCall(rotated.body.access_token).expect(200);

    const reuse = await refresh(tokens.refresh_token).expect(400);
    expect(reuse.body.error).toBe("invalid_grant");
    expect(prisma.state.oauthConnections[0].revokedReason).toBe("REFRESH_REUSE");
    await mcpCall(rotated.body.access_token).expect(401);
    await refresh(rotated.body.refresh_token).expect(400);
    expect(prisma.state.audits).toContainEqual(
      expect.objectContaining({ eventType: "MCP_CONNECTION_REVOKED", reason: "REFRESH_REUSE" })
    );
  });

  it("rejects refresh tokens of another client and refresh tokens used on the MCP server", async () => {
    const tokens = (await exchangeCode(app, await obtainCode(app)).expect(200)).body;
    await exchangeCode(app, await obtainCode(app, { clientId: LOOPBACK_CLIENT_ID, redirectUri: "http://localhost:4000/callback" })).expect(200);

    const wrongClient = await refresh(tokens.refresh_token, LOOPBACK_CLIENT_ID).expect(400);
    expect(wrongClient.body.error).toBe("invalid_grant");
    await mcpCall(tokens.refresh_token).expect(401);
  });

  it("refuses expired access tokens and logs the refusal for the connection", async () => {
    const tokens = (await exchangeCode(app, await obtainCode(app)).expect(200)).body;
    prisma.state.oauthTokens.find((token) => token.kind === "ACCESS")!.expiresAt = new Date(Date.now() - 1000);

    await mcpCall(tokens.access_token).expect(401);
    await settle();
    expect(prisma.state.calls).toContainEqual(
      expect.objectContaining({
        tenantId: STORE_A,
        connectionId: prisma.state.oauthConnections[0].id,
        result: "DENIED",
        errorCode: "TOKEN_EXPIRED",
      })
    );
  });

  it("revokes through RFC 7009 and always answers 200", async () => {
    const tokens = (await exchangeCode(app, await obtainCode(app)).expect(200)).body;
    await http().post("/api/oauth/revoke").type("form").send({ token: "desconhecido", client_id: CIMD_CLIENT_ID }).expect(200);
    await mcpCall(tokens.access_token).expect(200);

    await http().post("/api/oauth/revoke").type("form").send({ token: tokens.refresh_token, client_id: CIMD_CLIENT_ID }).expect(200);
    expect(prisma.state.oauthConnections[0].revokedReason).toBe("CLIENT_REVOKED");
    await mcpCall(tokens.access_token).expect(401);
  });
});
