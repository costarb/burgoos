import { INestApplication } from "@nestjs/common";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMcpFakePrisma, resetMcpFakePrisma } from "./support/mcp-fake-prisma";
import { createOAuthApp, seedOAuthWorld, USERS } from "./support/mcp-oauth-fixtures";
import { createServiceMocks, listen, STORE_A, STORE_B, STORE_DATA } from "./support/mcp-service-fixtures";

const REDIRECT = "http://127.0.0.1:61234/callback";

/** Simulates a real MCP client (Claude Code style): DCR, PKCE, browser consent by a logged-in user. */
class TestOAuthProvider implements OAuthClientProvider {
  info?: OAuthClientInformationMixed;
  savedTokens?: OAuthTokens;
  verifier = "";
  authorizationUrl?: URL;

  constructor(private readonly clientName: string) {}

  get redirectUrl() {
    return REDIRECT;
  }
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: this.clientName,
      redirect_uris: [REDIRECT],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }
  clientInformation() {
    return this.info;
  }
  saveClientInformation(info: OAuthClientInformationMixed) {
    this.info = info;
  }
  tokens() {
    return this.savedTokens;
  }
  saveTokens(tokens: OAuthTokens) {
    this.savedTokens = tokens;
  }
  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }
  saveCodeVerifier(verifier: string) {
    this.verifier = verifier;
  }
  codeVerifier() {
    return this.verifier;
  }
}

describe("MCP OAuth end-to-end with the SDK client", () => {
  let app: INestApplication;
  let url: string;
  const prisma = createMcpFakePrisma();
  const services = createServiceMocks();

  beforeAll(async () => {
    app = await createOAuthApp(prisma, services, { MCP_PUBLIC_URL: "", WEB_PUBLIC_URL: "https://app.example.com" });
    url = await listen(app);
  });

  beforeEach(() => {
    resetMcpFakePrisma(prisma);
    seedOAuthWorld(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Browser part: follow /authorize to the consent page and approve as `userId`. */
  async function consent(provider: TestOAuthProvider, userId: string, storeId: string): Promise<string> {
    const authorize = await fetch(provider.authorizationUrl!, { redirect: "manual" });
    expect(authorize.status).toBe(302);
    const requestId = new URL(authorize.headers.get("location")!).searchParams.get("pedido");
    const origin = new URL(url).origin;
    const approve = await fetch(`${origin}/api/oauth/requests/${requestId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userId}`, "Content-Type": "application/json" },
      body: JSON.stringify({ storeId }),
    });
    expect(approve.status).toBe(200);
    const redirect = new URL(((await approve.json()) as { redirectUrl: string }).redirectUrl);
    expect(redirect.searchParams.get("iss")).toBe(origin);
    return redirect.searchParams.get("code")!;
  }

  async function connect(provider: TestOAuthProvider, userId: string = USERS.owner, storeId: string = STORE_A) {
    const first = new StreamableHTTPClientTransport(new URL(url), { authProvider: provider });
    const client = new Client({ name: "oauth-e2e", version: "1.0.0" });
    await expect(client.connect(first)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(provider.authorizationUrl?.pathname).toBe("/api/oauth/authorize");

    await first.finishAuth(await consent(provider, userId, storeId));
    const connected = new Client({ name: "oauth-e2e", version: "1.0.0" });
    await connected.connect(new StreamableHTTPClientTransport(new URL(url), { authProvider: provider }));
    return connected;
  }

  it("discovers, registers, authorizes and calls tools for the approved store", async () => {
    const provider = new TestOAuthProvider("Claude Code");
    const client = await connect(provider);

    expect(prisma.state.oauthClients[0]).toMatchObject({ kind: "DCR", name: "Claude Code" });
    expect(provider.savedTokens?.access_token).toMatch(/^rrf_oat_/);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(10);
    const sales = await client.callTool({ name: "resumo_vendas", arguments: { inicio: "2026-09-01", fim: "2026-09-30" } });
    expect(sales.isError).toBeFalsy();
    expect(services.sales.getReport).toHaveBeenLastCalledWith(STORE_A, expect.anything());
    await client.close();
  });

  it("keeps a multi-store user's connection on the chosen store only", async () => {
    const provider = new TestOAuthProvider("Claude");
    const client = await connect(provider, USERS.multiStore, STORE_B);

    const profile = await client.readResource({ uri: "rrfive://loja/perfil" });
    const text = (profile.contents[0] as { text: string }).text;
    expect(text).toContain(STORE_DATA[STORE_B].name);
    expect(text).not.toContain(STORE_DATA[STORE_A].name);
    await client.close();
  });

  it("refreshes an expired access token without a new consent", async () => {
    const provider = new TestOAuthProvider("Claude Code");
    const client = await connect(provider);
    await client.close();

    prisma.state.oauthTokens.filter((token) => token.kind === "ACCESS").forEach((token) => (token.expiresAt = new Date(0)));
    const previous = provider.savedTokens?.access_token;
    const again = new Client({ name: "oauth-e2e", version: "1.0.0" });
    await again.connect(new StreamableHTTPClientTransport(new URL(url), { authProvider: provider }));

    expect(provider.savedTokens?.access_token).not.toBe(previous);
    expect((await again.listTools()).tools.length).toBe(10);
    expect(prisma.state.oauthConnections).toHaveLength(1);
    await again.close();
  });

  it("keeps two client connections independent when one is revoked", async () => {
    const claude = new TestOAuthProvider("Claude");
    const chatgpt = new TestOAuthProvider("ChatGPT");
    const first = await connect(claude);
    const second = await connect(chatgpt);
    await first.close();
    await second.close();

    const revoked = prisma.state.oauthConnections.find((connection) => {
      const client = prisma.state.oauthClients.find((item) => item.id === connection.clientId);
      return client?.name === "Claude";
    })!;
    revoked.revokedAt = new Date();

    const stillWorking = new Client({ name: "oauth-e2e", version: "1.0.0" });
    await stillWorking.connect(new StreamableHTTPClientTransport(new URL(url), { authProvider: chatgpt }));
    expect((await stillWorking.listTools()).tools.length).toBe(10);
    await stillWorking.close();

    // The revoked client is refused on the MCP call and then on the refresh attempt (invalid_grant).
    const cut = new Client({ name: "oauth-e2e", version: "1.0.0" });
    await expect(
      cut.connect(new StreamableHTTPClientTransport(new URL(url), { authProvider: claude }))
    ).rejects.toThrow(/Token de renovacao/);
  });
});
