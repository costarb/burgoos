import { ForbiddenException, GoneException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessAuditService } from "../src/management/access/access-audit.service";
import { FiscalAuditService } from "../src/management/fiscal/documents/fiscal-audit.service";
import { BlingOAuthService } from "../src/management/fiscal/providers/bling/bling-oauth.service";
import { FiscalProviderError } from "../src/management/fiscal/providers/fiscal-provider.adapter";
import { FiscalProviderContextService } from "../src/management/fiscal/providers/fiscal-provider-context.service";
import type { AuthUser } from "../src/platform/auth/auth.types";
import { BlingPlatformConfigurationService } from "../src/platform/integrations/bling-platform-configuration.service";
import { IntegrationSecretService } from "../src/security/integration-secret.service";
import { createFiscalFakePrisma } from "./support/fiscal-fake-prisma";

const TENANT = "11111111-1111-4111-8111-111111111111";
const user: AuthUser = { id: "aaaaaaaa-0000-4000-8000-000000000001", tenantId: TENANT, role: UserRole.OWNER, email: "dono@loja.test", name: "Dono" };

describe("Bling OAuth (US1)", () => {
  let prisma: ReturnType<typeof createFiscalFakePrisma>;
  let platform: BlingPlatformConfigurationService;
  let contexts: FiscalProviderContextService;
  let oauth: BlingOAuthService;
  let secrets: IntegrationSecretService;
  let tokenRequests: Array<{ url: string; headers: Record<string, string>; body: URLSearchParams }>;
  let tokenStatus: number;

  beforeEach(async () => {
    prisma = createFiscalFakePrisma({ tenant: [{ id: TENANT, name: "Dogao", config: {} }] });
    secrets = new IntegrationSecretService(new ConfigService({ INTEGRATION_SECRET_KEY: Buffer.alloc(32, 5).toString("base64") }));
    platform = new BlingPlatformConfigurationService(prisma as never, secrets, new ConfigService({}));
    await platform.update({ clientId: "client-123456", clientSecret: "secret-xyz", postCallbackUrl: "https://app.test/admin/fiscal" }, "platform-admin");
    contexts = new FiscalProviderContextService(prisma as never, secrets);
    oauth = new BlingOAuthService(prisma as never, secrets, platform, contexts, new AccessAuditService(prisma as never), new FiscalAuditService(prisma as never));
    oauth.onModuleInit();
    tokenRequests = [];
    tokenStatus = 200;
    let sequence = 0;
    oauth.useFetcher(async (url, init) => {
      tokenRequests.push({ url, headers: init.headers, body: new URLSearchParams(init.body) });
      sequence += 1;
      return {
        ok: tokenStatus < 400,
        status: tokenStatus,
        json: async () => ({ access_token: `access-${sequence}`, refresh_token: `refresh-${sequence}`, expires_in: 21600, token_type: "Bearer" }),
      };
    });
  });

  const stateFrom = (authorizationUrl: string) => new URL(authorizationUrl).searchParams.get("state") as string;

  it("exposes the redirect URL to register in the Bling app without leaking secrets", async () => {
    const view = await platform.safeView("https://api.loja.test");
    expect(view).toEqual({
      clientIdConfigured: true,
      clientSecretConfigured: true,
      clientIdHint: "client…",
      postCallbackUrl: "https://app.test/admin/fiscal",
      redirectUri: "https://api.loja.test/api/integrations/bling/callback",
      source: "DATABASE",
      oauthReady: true,
    });
    expect(JSON.stringify(prisma.table("platformFiscalProviderConfiguration"))).not.toContain("secret-xyz");
  });

  it("connects the store account and stores encrypted tokens", async () => {
    const { authorizationUrl } = await oauth.start(user);
    const url = new URL(authorizationUrl);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.bling.com.br/Api/v3/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-123456");
    expect(url.searchParams.get("response_type")).toBe("code");

    await oauth.complete("code-abc", stateFrom(authorizationUrl));

    expect(tokenRequests[0].url).toBe("https://api.bling.com.br/Api/v3/oauth/token");
    expect(tokenRequests[0].headers.Authorization).toBe(`Basic ${Buffer.from("client-123456:secret-xyz").toString("base64")}`);
    expect(Object.fromEntries(tokenRequests[0].body)).toEqual({ grant_type: "authorization_code", code: "code-abc" });
    const [connection] = prisma.table("fiscalProviderConnection");
    expect(connection).toMatchObject({ status: "CONNECTED", settings: {} });
    expect(String(connection.credentialCiphertext)).not.toContain("access-1");
    expect(secrets.decryptEnvelope(connection.credentialCiphertext as string)).toEqual({ version: 1, kind: "BLING_OAUTH", accessToken: "access-1", refreshToken: "refresh-1" });
    expect(prisma.table("accessAuditEvent")[0]).toMatchObject({ eventType: "FISCAL_CONNECTION_CHANGED", storeId: TENANT });
    expect(prisma.table("fiscalConfiguration")[0]).toMatchObject({ tenantId: TENANT, provider: "BLING" });
  });

  it("rejects replayed, unknown and expired states", async () => {
    const { authorizationUrl } = await oauth.start(user);
    const state = stateFrom(authorizationUrl);
    await oauth.complete("code-abc", state);
    await expect(oauth.complete("code-abc", state)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(oauth.complete("code-abc", "forged")).rejects.toBeInstanceOf(ForbiddenException);

    const second = await oauth.start(user);
    const connection = prisma.table("fiscalProviderConnection")[0];
    (connection.settings as { oauthState: { expiresAt: string } }).oauthState.expiresAt = new Date(Date.now() - 1000).toISOString();
    await expect(oauth.complete("code-abc", stateFrom(second.authorizationUrl))).rejects.toBeInstanceOf(GoneException);
  });

  it("refreshes once on 401 and keeps working", async () => {
    const { authorizationUrl } = await oauth.start(user);
    await oauth.complete("code-abc", stateFrom(authorizationUrl));
    const tokensSeen: string[] = [];

    const result = await contexts.run(TENANT, "BLING", "HOMOLOGATION", async (ctx) => {
      tokensSeen.push(ctx.accessToken);
      if (ctx.accessToken === "access-1") throw new FiscalProviderError("AUTHENTICATION", "expired", false);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(tokensSeen).toEqual(["access-1", "access-2"]);
    expect(Object.fromEntries(tokenRequests[1].body)).toEqual({ grant_type: "refresh_token", refresh_token: "refresh-1" });
  });

  it("refreshes tokens close to expiry and marks the connection in error when refresh is refused", async () => {
    const { authorizationUrl } = await oauth.start(user);
    await oauth.complete("code-abc", stateFrom(authorizationUrl));
    const connection = prisma.table("fiscalProviderConnection")[0];
    connection.tokenExpiresAt = new Date(Date.now() + 10 * 60_000);
    expect(await oauth.refreshExpiring()).toBe(1);
    expect((connection.tokenExpiresAt as Date).getTime()).toBeGreaterThan(Date.now() + 5 * 3_600_000);

    connection.tokenExpiresAt = new Date(Date.now() + 10 * 60_000);
    tokenStatus = 400;
    expect(await oauth.refreshExpiring()).toBe(0);
    expect(connection).toMatchObject({ status: "ERROR", lastErrorCode: "REFRESH_FAILED" });
    await expect(contexts.run(TENANT, "BLING", "HOMOLOGATION", async () => "never")).rejects.toMatchObject({ providerCode: "PROVIDER_DISCONNECTED" });
  });

  it("blocks disconnecting while documents are pending, then clears credentials", async () => {
    const { authorizationUrl } = await oauth.start(user);
    await oauth.complete("code-abc", stateFrom(authorizationUrl));
    prisma.table("fiscalDocument").push({ id: "doc-1", tenantId: TENANT, provider: "BLING", status: "CANCEL_PENDING" });
    await expect(oauth.disconnect(user)).rejects.toMatchObject({ response: { code: "PENDING_DOCUMENTS" } });

    prisma.table("fiscalDocument")[0].status = "CANCELLED";
    await oauth.disconnect(user);
    expect(prisma.table("fiscalProviderConnection")[0]).toMatchObject({ status: "DISCONNECTED", credentialCiphertext: null });
  });
});
