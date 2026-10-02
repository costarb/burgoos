import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import { createOAuthApp, exchangeCode, obtainCode, seedOAuthWorld } from "./support/mcp-oauth-fixtures";

describe("MCP OAuth dynamic client registration", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();
  const register = (body: unknown) => request(app.getHttpServer()).post("/api/oauth/register").send(body as object);

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

  it("registers a public client (RFC 7591) that completes the authorization flow", async () => {
    const response = await register({
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
    }).expect(201);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({
      client_id: expect.stringMatching(/^mcpc_/),
      client_name: "ChatGPT",
      redirect_uris: ["https://chatgpt.com/connector_platform_oauth_redirect"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: expect.any(Number),
    });

    const grant = await obtainCode(app, {
      clientId: response.body.client_id,
      redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
    });
    const tokens = await exchangeCode(app, grant).expect(200);
    expect(tokens.body.access_token).toMatch(/^rrf_oat_/);
  });

  it("defaults the name and accepts loopback redirects", async () => {
    const response = await register({ redirect_uris: ["http://localhost/callback"] }).expect(201);
    expect(response.body.client_name).toBe("Aplicativo MCP");
  });

  it.each([
    ["no redirect", {}, "invalid_redirect_uri"],
    ["plain http redirect", { redirect_uris: ["http://evil.example.com/cb"] }, "invalid_redirect_uri"],
    ["confidential client", { redirect_uris: ["https://a.example.com/cb"], token_endpoint_auth_method: "client_secret_post" }, "invalid_client_metadata"],
    ["unsupported grant", { redirect_uris: ["https://a.example.com/cb"], grant_types: ["client_credentials"] }, "invalid_client_metadata"],
  ])("rejects %s", async (_label, body, error) => {
    const response = await register(body).expect(400);
    expect(response.body.error).toBe(error);
    expect(prisma.state.oauthClients).toHaveLength(0);
  });

  it("limits registrations per IP", async () => {
    let last = 0;
    for (let index = 0; index < 21; index += 1) {
      last = (await register({ redirect_uris: ["https://a.example.com/cb"] })).status;
    }
    expect(last).toBe(429);
  });
});
