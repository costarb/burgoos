import { Inject, Injectable } from "@nestjs/common";
import type { FiscalEnvironment, FiscalProvider, FiscalProviderConnection } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { FiscalProviderError, ProviderContext } from "./fiscal-provider.adapter";

const REFRESH_MARGIN_MS = 5 * 60_000;

/** Provider-specific token renewal (e.g. Bling OAuth refresh). Returns the new access token. */
export interface FiscalTokenRefresher {
  readonly provider: FiscalProvider;
  refresh(connection: FiscalProviderConnection): Promise<string>;
}

/**
 * Builds the provider context for a tenant: decrypts the stored token, renews it shortly before
 * expiry and retries once when the provider answers 401.
 */
@Injectable()
export class FiscalProviderContextService {
  private readonly refreshers = new Map<FiscalProvider, FiscalTokenRefresher>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IntegrationSecretService) private readonly secrets: IntegrationSecretService
  ) {}

  registerRefresher(refresher: FiscalTokenRefresher): void {
    this.refreshers.set(refresher.provider, refresher);
  }

  async run<T>(
    tenantId: string,
    provider: FiscalProvider,
    environment: FiscalEnvironment,
    operation: (ctx: ProviderContext) => Promise<T>
  ): Promise<T> {
    const connection = await this.connection(tenantId, provider);
    let accessToken = await this.accessToken(connection);
    const ctx = (token: string): ProviderContext => ({
      tenantId,
      environment,
      accessToken: token,
      settings: (connection.settings as Record<string, unknown>) ?? {},
    });
    try {
      return await operation(ctx(accessToken));
    } catch (error) {
      const refresher = this.refreshers.get(provider);
      if (!(error instanceof FiscalProviderError) || error.code !== "AUTHENTICATION" || !refresher) throw error;
      accessToken = await this.refreshOrDisconnect(refresher, connection);
      return operation(ctx(accessToken));
    }
  }

  private async connection(tenantId: string, provider: FiscalProvider): Promise<FiscalProviderConnection> {
    const connection = await this.prisma.fiscalProviderConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!connection || connection.status !== "CONNECTED" || !connection.credentialCiphertext) {
      throw new FiscalProviderError("AUTHENTICATION", "Provedor fiscal desconectado", false, "PROVIDER_DISCONNECTED");
    }
    return connection;
  }

  private async accessToken(connection: FiscalProviderConnection): Promise<string> {
    const refresher = this.refreshers.get(connection.provider);
    if (refresher && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS) {
      return this.refreshOrDisconnect(refresher, connection);
    }
    const envelope = this.secrets.decryptEnvelope(connection.credentialCiphertext as string);
    if (!("accessToken" in envelope)) {
      throw new FiscalProviderError("AUTHENTICATION", "Credencial fiscal invalida", false, "PROVIDER_DISCONNECTED");
    }
    return envelope.accessToken;
  }

  private async refreshOrDisconnect(refresher: FiscalTokenRefresher, connection: FiscalProviderConnection) {
    try {
      return await refresher.refresh(connection);
    } catch (error) {
      if (error instanceof FiscalProviderError && error.retryable) throw error;
      await this.prisma.fiscalProviderConnection.update({
        where: { id: connection.id },
        data: {
          status: "ERROR",
          lastErrorCode: "REFRESH_FAILED",
          lastErrorMessage: "Nao foi possivel renovar o acesso ao provedor; reconecte a conta",
        },
      });
      throw new FiscalProviderError("AUTHENTICATION", "Provedor fiscal desconectado", false, "PROVIDER_DISCONNECTED");
    }
  }
}
