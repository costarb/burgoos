import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../platform/database/prisma.service";
import { SalesIntegrationService } from "../sales-integration.service";
import { MercadoPagoRefreshService } from "./mercado-pago-refresh.service";

@Injectable()
export class MercadoPagoAuthenticatedRequestService {
  constructor(
    private readonly integrations: SalesIntegrationService,
    private readonly refresh: MercadoPagoRefreshService,
    private readonly prisma: PrismaService
  ) {}

  async execute<T>(input: {
    tenantId: string;
    integrationId: string;
    request: (accessToken: string) => Promise<T>;
  }): Promise<T> {
    const current = await this.integrations.getCredential(input.tenantId, input.integrationId);
    try {
      return await input.request(current.token);
    } catch (error) {
      if (!isUnauthorized(error)) throw safeProviderError(error);
      if (current.integration.credentialMode !== "OAUTH") {
        await this.requireReauthorization(
          input.tenantId,
          input.integrationId,
          "FIXED_TOKEN_UNAUTHORIZED"
        );
        throw safeProviderError(error);
      }
      const renewed = await this.refresh.refresh(input.tenantId, input.integrationId);
      if (!renewed) throw safeProviderError(error);
      const next = await this.integrations.getCredential(input.tenantId, input.integrationId);
      try {
        return await input.request(next.token);
      } catch (retryError) {
        if (isUnauthorized(retryError))
          await this.requireReauthorization(
            input.tenantId,
            input.integrationId,
            "OAUTH_RETRY_UNAUTHORIZED"
          );
        throw safeProviderError(retryError);
      }
    }
  }

  private async requireReauthorization(tenantId: string, integrationId: string, code: string) {
    await this.prisma.salesIntegration.updateMany({
      where: { id: integrationId, tenantId },
      data: {
        status: "REAUTHORIZATION_REQUIRED",
        lastErrorCode: code,
        lastErrorMessage: "A conexao Mercado Pago precisa ser atualizada",
      },
    });
  }
}

function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    code?: string;
  };
  return (
    value.status === 401 ||
    value.statusCode === 401 ||
    value.response?.status === 401 ||
    value.code === "AUTHENTICATION"
  );
}
function safeProviderError(error: unknown): Error {
  const safe = new Error(
    isUnauthorized(error)
      ? "Mercado Pago recusou a autorizacao"
      : "Falha na comunicacao com Mercado Pago"
  );
  if (isUnauthorized(error)) Object.assign(safe, { code: "AUTHENTICATION", status: 401 });
  return safe;
}
