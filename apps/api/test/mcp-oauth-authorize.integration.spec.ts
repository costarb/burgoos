import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import {
  authorizeQuery,
  CIMD_CLIENT_ID,
  CLIENT_REDIRECT,
  createOAuthApp,
  ISSUER,
  MCP_URL,
  seedOAuthWorld,
  USERS,
  WEB_URL,
} from "./support/mcp-oauth-fixtures";
import { STORE_A, STORE_B } from "./support/mcp-service-fixtures";

describe("MCP OAuth discovery, authorize and consent", () => {
  let app: INestApplication;
  const prisma = createMcpFakePrisma();
  const http = () => request(app.getHttpServer());

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

  describe("discovery", () => {
    it("answers unauthenticated MCP calls with a resource_metadata challenge and the phase-1 body", async () => {
      const response = await http().post("/api/mcp").send({}).expect(401);
      expect(response.headers["www-authenticate"]).toBe(
        `Bearer realm="rrfive-mcp", resource_metadata="${ISSUER}/.well-known/oauth-protected-resource", scope="mcp:read"`
      );
      expect(response.body).toMatchObject({ error: "unauthorized", message: "Token MCP invalido ou sem acesso." });
    });

    it.each(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/api/mcp"])(
      "serves protected resource metadata at %s",
      async (path) => {
        const response = await http().get(path).expect(200);
        expect(response.body).toEqual({
          resource: MCP_URL,
          authorization_servers: [ISSUER],
          scopes_supported: ["mcp:read"],
          bearer_methods_supported: ["header"],
          resource_name: "RRFive OS",
        });
      }
    );

    it("serves authorization server metadata outside the /api prefix", async () => {
      const response = await http().get("/.well-known/oauth-authorization-server").expect(200);
      expect(response.body).toMatchObject({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/api/oauth/authorize`,
        token_endpoint: `${ISSUER}/api/oauth/token`,
        registration_endpoint: `${ISSUER}/api/oauth/register`,
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        client_id_metadata_document_supported: true,
        authorization_response_iss_parameter_supported: true,
      });
      expect(response.headers["access-control-allow-origin"]).toBe("*");
      await http().get("/api/.well-known/oauth-authorization-server").expect(404);
    });
  });

  describe("GET /api/oauth/authorize", () => {
    it("creates a pending request and redirects to the web consent page", async () => {
      const response = await http().get(`/api/oauth/authorize?${authorizeQuery()}`).expect(302);
      const location = new URL(response.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(`${WEB_URL}/conectar/mcp`);
      expect(prisma.state.oauthRequests).toHaveLength(1);
      expect(prisma.state.oauthRequests[0]).toMatchObject({
        id: location.searchParams.get("pedido"),
        redirectUri: CLIENT_REDIRECT,
        state: "estado-123",
        resource: MCP_URL,
        status: "PENDING",
      });
      expect(prisma.state.oauthClients[0]).toMatchObject({ clientId: CIMD_CLIENT_ID, kind: "CIMD", name: "Claude" });
    });

    it("accepts the resource with a trailing slash", async () => {
      await http().get(`/api/oauth/authorize?${authorizeQuery({ resource: `${MCP_URL}/` })}`).expect(302);
    });

    it.each([
      ["unknown CIMD client", { client_id: "https://unknown.example.com/client.json" }],
      ["unregistered DCR client", { client_id: "mcpc_inexistente" }],
      ["undeclared redirect", { redirect_uri: "https://evil.example.com/callback" }],
      ["missing redirect", { redirect_uri: undefined }],
    ])("shows an error page without redirecting for %s", async (_label, overrides) => {
      const response = await http().get(`/api/oauth/authorize?${authorizeQuery(overrides)}`).expect(400);
      expect(response.headers.location).toBeUndefined();
      expect(response.text).toContain("Nao foi possivel conectar o assistente");
      expect(prisma.state.oauthRequests).toHaveLength(0);
      expect(prisma.state.audits).toContainEqual(expect.objectContaining({ eventType: "MCP_CLIENT_REJECTED" }));
    });

    it.each([
      ["missing PKCE", { code_challenge: undefined }, "invalid_request"],
      ["plain PKCE", { code_challenge_method: "plain" }, "invalid_request"],
      ["wrong response type", { response_type: "token" }, "unsupported_response_type"],
      ["unknown scope", { scope: "admin" }, "invalid_scope"],
      ["foreign resource", { resource: "https://other.example.com/mcp" }, "invalid_target"],
    ])("redirects %s back to the client with an OAuth error", async (_label, overrides, error) => {
      const response = await http().get(`/api/oauth/authorize?${authorizeQuery(overrides)}`).expect(302);
      const location = new URL(response.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(CLIENT_REDIRECT);
      expect(location.searchParams.get("error")).toBe(error);
      expect(location.searchParams.get("state")).toBe("estado-123");
      expect(location.searchParams.get("iss")).toBe(ISSUER);
      expect(prisma.state.oauthRequests).toHaveLength(0);
    });
  });

  describe("consent", () => {
    async function startRequest() {
      const response = await http().get(`/api/oauth/authorize?${authorizeQuery()}`).expect(302);
      return new URL(response.headers.location).searchParams.get("pedido")!;
    }

    it("lists only eligible stores for the user", async () => {
      const id = await startRequest();
      const owner = await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.owner}`).expect(200);
      expect(owner.body).toMatchObject({
        client: { name: "Claude", redirectHost: "client.example.com", kind: "CIMD", loopbackOnly: false },
        canAuthorize: true,
        blockedReason: null,
      });
      expect(owner.body.stores.map((store: { id: string }) => store.id)).toEqual([STORE_A]);

      const multi = await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.multiStore}`).expect(200);
      expect(multi.body.stores.map((store: { id: string }) => store.id).sort()).toEqual([STORE_A, STORE_B].sort());
      expect(multi.body.stores[0].areas[0]).toEqual({ area: "SALES", label: "Vendas" });
    });

    it("hides stores with MCP disabled and explains blocked cases", async () => {
      prisma.state.configurations.find((item) => item.tenantId === STORE_B)!.enabled = false;
      const id = await startRequest();

      const multi = await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.multiStore}`).expect(200);
      expect(multi.body.stores.map((store: { id: string }) => store.id)).toEqual([STORE_A]);

      const without = await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.operatorWithout}`).expect(200);
      expect(without.body).toMatchObject({ canAuthorize: false, blockedReason: "MISSING_PERMISSION", stores: [] });

      const withPermission = await http()
        .get(`/api/oauth/requests/${id}`)
        .set("Authorization", `Bearer ${USERS.operatorWithPermission}`)
        .expect(200);
      expect(withPermission.body.canAuthorize).toBe(true);

      const platform = await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.platformAdmin}`).expect(200);
      expect(platform.body.blockedReason).toBe("PLATFORM_ADMIN");

      prisma.state.configurations.forEach((item) => (item.enabled = false));
      const none = await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.owner}`).expect(200);
      expect(none.body.blockedReason).toBe("NO_ELIGIBLE_STORE");
    });

    it("approves: creates the connection, the code and the audit, and returns the redirect", async () => {
      const id = await startRequest();
      const response = await http()
        .post(`/api/oauth/requests/${id}/approve`)
        .set("Authorization", `Bearer ${USERS.owner}`)
        .send({ storeId: STORE_A })
        .expect(200);

      const redirect = new URL(response.body.redirectUrl);
      expect(`${redirect.origin}${redirect.pathname}`).toBe(CLIENT_REDIRECT);
      expect(redirect.searchParams.get("code")).toMatch(/^rrf_oac_/);
      expect(redirect.searchParams.get("state")).toBe("estado-123");
      expect(redirect.searchParams.get("iss")).toBe(ISSUER);
      expect(prisma.state.oauthConnections).toEqual([
        expect.objectContaining({ tenantId: STORE_A, userId: USERS.owner, resource: MCP_URL, revokedAt: null }),
      ]);
      expect(prisma.state.oauthRequests[0]).toMatchObject({ status: "APPROVED", tenantId: STORE_A });
      expect(JSON.stringify(prisma.state.oauthRequests)).not.toContain(redirect.searchParams.get("code"));
      expect(prisma.state.audits).toContainEqual(
        expect.objectContaining({ eventType: "MCP_CONNECTION_AUTHORIZED", storeId: STORE_A, actorUserId: USERS.owner })
      );
    });

    it("refuses stores the user cannot authorize and the connection limit", async () => {
      const id = await startRequest();
      await http()
        .post(`/api/oauth/requests/${id}/approve`)
        .set("Authorization", `Bearer ${USERS.owner}`)
        .send({ storeId: STORE_B })
        .expect(403);
      await http()
        .post(`/api/oauth/requests/${id}/approve`)
        .set("Authorization", `Bearer ${USERS.operatorWithout}`)
        .send({ storeId: STORE_A })
        .expect(403);

      for (let index = 0; index < 20; index += 1) {
        prisma.state.oauthConnections.push({
          id: `conn-${index}`,
          tenantId: STORE_A,
          userId: USERS.owner,
          clientId: prisma.state.oauthClients[0].id,
          revokedAt: null,
          createdAt: new Date(),
        });
      }
      const limited = await http()
        .post(`/api/oauth/requests/${id}/approve`)
        .set("Authorization", `Bearer ${USERS.owner}`)
        .send({ storeId: STORE_A })
        .expect(409);
      expect(limited.body.code).toBe("CONNECTION_LIMIT_REACHED");
    });

    it("denies with access_denied and audits", async () => {
      const id = await startRequest();
      const response = await http()
        .post(`/api/oauth/requests/${id}/deny`)
        .set("Authorization", `Bearer ${USERS.owner}`)
        .expect(200);
      const redirect = new URL(response.body.redirectUrl);
      expect(redirect.searchParams.get("error")).toBe("access_denied");
      expect(redirect.searchParams.get("state")).toBe("estado-123");
      expect(prisma.state.oauthConnections).toHaveLength(0);
      expect(prisma.state.audits).toContainEqual(expect.objectContaining({ eventType: "MCP_CONNECTION_DENIED" }));

      await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.owner}`).expect(410);
    });

    it("rejects expired requests and requires a session", async () => {
      const id = await startRequest();
      await http().get(`/api/oauth/requests/${id}`).expect(401);
      prisma.state.oauthRequests[0].expiresAt = new Date(Date.now() - 1000);
      await http().get(`/api/oauth/requests/${id}`).set("Authorization", `Bearer ${USERS.owner}`).expect(410);
    });
  });
});
