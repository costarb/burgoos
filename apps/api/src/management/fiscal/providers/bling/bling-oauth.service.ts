import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AccessAuditEventType, AccessAuditResult, FiscalProviderConnection, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { RuntimeRoleService } from "../../../../config/runtime-role.service";
import { PrismaService } from "../../../../platform/database/prisma.service";
import { BlingPlatformConfigurationService } from "../../../../platform/integrations/bling-platform-configuration.service";
import { IntegrationSecretService } from "../../../../security/integration-secret.service";
import { AccessAuditService } from "../../../access/access-audit.service";
import { FiscalAuditService } from "../../documents/fiscal-audit.service";
import { AuthUser } from "../../../../platform/auth/auth.types";
import { FiscalProviderError } from "../fiscal-provider.adapter";
import { FiscalProviderContextService, FiscalTokenRefresher } from "../fiscal-provider-context.service";

const STATE_TTL_MS = 10 * 60_000;
const REFRESH_TOKEN_TTL_MS = 30 * 86_400_000;
const PROACTIVE_REFRESH_MS = 60 * 60_000;

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
});

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

interface PendingOAuthState {
  stateHash: string;
  expiresAt: string;
  userId: string;
}

/**
 * Bling OAuth2 (authorization code): the store connects its own Bling account. The one-time state
 * is kept hashed on the connection; tokens are stored encrypted and renewed before expiry (also
 * keeps the refresh token alive) and on demand after a 401.
 */
@Injectable()
export class BlingOAuthService implements FiscalTokenRefresher, OnModuleInit {
  readonly provider = "BLING" as const;
  private fetcher: Fetcher = (url, init) => fetch(url, init);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IntegrationSecretService) private readonly secrets: IntegrationSecretService,
    @Inject(BlingPlatformConfigurationService) private readonly platform: BlingPlatformConfigurationService,
    @Inject(FiscalProviderContextService) private readonly contexts: FiscalProviderContextService,
    @Inject(AccessAuditService) private readonly accessAudit: AccessAuditService,
    @Inject(FiscalAuditService) private readonly audit: FiscalAuditService,
    @Optional() @Inject(RuntimeRoleService) private readonly runtimeRole?: RuntimeRoleService
  ) {}

  onModuleInit(): void {
    this.contexts.registerRefresher(this);
  }

  /** Test seam. */
  useFetcher(fetcher: Fetcher): void {
    this.fetcher = fetcher;
  }

  async start(user: AuthUser): Promise<{ authorizationUrl: string; expiresAt: string }> {
    const clientId = await this.platform.required("clientId");
    await this.platform.required("clientSecret");
    const state = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);
    const pending: PendingOAuthState = { stateHash: hash(state), expiresAt: expiresAt.toISOString(), userId: user.id };
    const current = await this.prisma.fiscalProviderConnection.findUnique({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: "BLING" } },
    });
    const settings = { ...((current?.settings as Record<string, unknown>) ?? {}), oauthState: pending };
    await this.prisma.fiscalProviderConnection.upsert({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: "BLING" } },
      create: { tenantId: user.tenantId, provider: "BLING", status: "DRAFT", settings: settings as unknown as Prisma.InputJsonValue, updatedByUserId: user.id },
      update: { settings: settings as unknown as Prisma.InputJsonValue, updatedByUserId: user.id },
    });
    const url = new URL(await this.platform.required("authorizeUrl"));
    url.search = new URLSearchParams({ response_type: "code", client_id: clientId, state }).toString();
    return { authorizationUrl: url.toString(), expiresAt: expiresAt.toISOString() };
  }

  /** Callback: validates the one-time state, exchanges the code and stores the tokens. */
  async complete(code: string, state: string): Promise<{ tenantId: string }> {
    const stateHash = hash(state);
    const candidates = await this.prisma.fiscalProviderConnection.findMany({ where: { provider: "BLING" } });
    const connection = candidates.find(
      (candidate) => (candidate.settings as unknown as { oauthState?: PendingOAuthState } | null)?.oauthState?.stateHash === stateHash
    );
    if (!connection) throw new ForbiddenException("State OAuth invalido ou ja utilizado");
    const pending = (connection.settings as unknown as { oauthState: PendingOAuthState }).oauthState;
    const { oauthState: _consumed, ...settings } = connection.settings as Record<string, unknown>;
    // Consume the state before calling Bling so a replayed callback cannot reuse it.
    await this.prisma.fiscalProviderConnection.update({
      where: { id: connection.id },
      data: { settings: settings as Prisma.InputJsonValue },
    });
    if (new Date(pending.expiresAt) <= new Date()) throw new GoneException("Autorizacao expirada; conecte novamente");

    try {
      const tokens = await this.requestToken({ grant_type: "authorization_code", code });
      await this.saveTokens(connection.id, tokens, { connectedAt: new Date(), status: "CONNECTED" });
    } catch (error) {
      await this.prisma.fiscalProviderConnection.update({
        where: { id: connection.id },
        data: { status: "ERROR", lastErrorCode: "OAUTH_EXCHANGE_FAILED", lastErrorMessage: "Falha ao autorizar a conta Bling" },
      });
      this.audit.log("fiscal.connection.error", { tenantId: connection.tenantId, provider: "BLING", errorCode: "OAUTH_EXCHANGE_FAILED" }, "error");
      throw error;
    }
    await this.accessAudit.record({
      actorUserId: pending.userId,
      storeId: connection.tenantId,
      eventType: AccessAuditEventType.FISCAL_CONNECTION_CHANGED,
      result: AccessAuditResult.SUCCESS,
      metadata: { provider: "BLING", action: "connected" },
    });
    return { tenantId: connection.tenantId };
  }

  async disconnect(user: AuthUser): Promise<void> {
    const connection = await this.prisma.fiscalProviderConnection.findUnique({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: "BLING" } },
    });
    if (!connection) return;
    const pendingDocuments = await this.prisma.fiscalDocument.count({
      where: { tenantId: user.tenantId, provider: "BLING", status: { in: ["PENDING", "PROCESSING", "CANCEL_PENDING"] } },
    });
    if (pendingDocuments > 0) {
      throw new ConflictException({ code: "PENDING_DOCUMENTS", message: "Existem notas em processamento ou cancelamento no Bling" });
    }
    await this.prisma.fiscalProviderConnection.update({
      where: { id: connection.id },
      data: { status: "DISCONNECTED", credentialCiphertext: null, tokenExpiresAt: null, refreshTokenExpiresAt: null, disconnectedAt: new Date(), updatedByUserId: user.id },
    });
    await this.accessAudit.record({
      actorUserId: user.id,
      storeId: user.tenantId,
      eventType: AccessAuditEventType.FISCAL_CONNECTION_CHANGED,
      result: AccessAuditResult.SUCCESS,
      metadata: { provider: "BLING", action: "disconnected" },
    });
  }

  /** FiscalTokenRefresher: renews the access token with the stored refresh token. */
  async refresh(connection: FiscalProviderConnection): Promise<string> {
    if (!connection.credentialCiphertext) {
      throw new FiscalProviderError("AUTHENTICATION", "Conexao Bling sem credencial", false, "PROVIDER_DISCONNECTED");
    }
    const envelope = this.secrets.decryptEnvelope(connection.credentialCiphertext);
    if (envelope.kind !== "BLING_OAUTH") {
      throw new FiscalProviderError("AUTHENTICATION", "Credencial Bling invalida", false, "PROVIDER_DISCONNECTED");
    }
    const tokens = await this.requestToken({ grant_type: "refresh_token", refresh_token: envelope.refreshToken });
    await this.saveTokens(connection.id, tokens, {});
    return tokens.access_token;
  }

  /** Renews tokens that expire within the hour (and keeps the 30-day refresh token alive). */
  @Cron("0 */15 * * * *")
  async refreshExpiring(now = new Date()): Promise<number> {
    if (this.runtimeRole && !this.runtimeRole.consumesBackgroundJobs) return 0;
    const due = await this.prisma.fiscalProviderConnection.findMany({
      where: { provider: "BLING", status: "CONNECTED", tokenExpiresAt: { lte: new Date(now.getTime() + PROACTIVE_REFRESH_MS) } },
    });
    let refreshed = 0;
    for (const connection of due) {
      try {
        await this.refresh(connection);
        refreshed += 1;
      } catch (error) {
        const retryable = error instanceof FiscalProviderError && error.retryable;
        if (!retryable) {
          await this.prisma.fiscalProviderConnection.update({
            where: { id: connection.id },
            data: { status: "ERROR", lastErrorCode: "REFRESH_FAILED", lastErrorMessage: "Nao foi possivel renovar o acesso ao Bling; reconecte a conta" },
          });
        }
        this.audit.log(
          "fiscal.connection.error",
          { tenantId: connection.tenantId, provider: "BLING", errorCode: retryable ? "REFRESH_RETRYABLE" : "REFRESH_FAILED" },
          "error"
        );
      }
    }
    return refreshed;
  }

  private async saveTokens(
    connectionId: string,
    tokens: z.infer<typeof tokenResponse>,
    extra: { connectedAt?: Date; status?: "CONNECTED" }
  ): Promise<void> {
    const now = Date.now();
    await this.prisma.fiscalProviderConnection.update({
      where: { id: connectionId },
      data: {
        ...extra,
        credentialCiphertext: this.secrets.encryptEnvelope({
          version: 1,
          kind: "BLING_OAUTH",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        }),
        tokenExpiresAt: new Date(now + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
        lastValidationAt: new Date(now),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  private async requestToken(body: Record<string, string>) {
    const [clientId, clientSecret, apiBaseUrl] = await Promise.all([
      this.platform.required("clientId"),
      this.platform.required("clientSecret"),
      this.platform.required("apiBaseUrl"),
    ]);
    let response: Awaited<ReturnType<Fetcher>>;
    try {
      response = await this.fetcher(`${apiBaseUrl.replace(/\/$/, "")}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "1.0",
        },
        body: new URLSearchParams(body).toString(),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new FiscalProviderError("UNAVAILABLE", "Bling indisponivel", true);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new FiscalProviderError(response.status === 429 ? "RATE_LIMIT" : "UNAVAILABLE", "Bling indisponivel", true);
    }
    if (!response.ok) {
      throw new FiscalProviderError("AUTHENTICATION", "Autorizacao Bling recusada", false, "PROVIDER_DISCONNECTED");
    }
    const parsed = tokenResponse.safeParse(await response.json());
    if (!parsed.success) throw new FiscalProviderError("INCOMPATIBLE_RESPONSE", "Resposta de token Bling inesperada", false);
    return parsed.data;
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
