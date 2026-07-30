import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
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
    request: (accessToken: string, collectorId?: string) => Promise<T>;
  }): Promise<T> {
    const current = await this.integrations.getCredential(input.tenantId, input.integrationId);
    try {
      return await input.request(current.token, current.integration.providerUserId ?? undefined);
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
        return await input.request(next.token, next.integration.providerUserId ?? undefined);
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

  async executeForTenant<T>(input: {
    tenantId: string;
    request: (
      accessToken: string,
      context: { integrationId: string; collectorId?: string },
    ) => Promise<T>;
  }): Promise<T> {
    const integration = await this.prisma.salesIntegration.findFirst({
      where: {
        tenantId: input.tenantId,
        provider: "MERCADO_PAGO",
        status: { in: ["ACTIVE", "TOKEN_EXPIRING"] },
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!integration) {
      throw new Error("Conexao Mercado Pago ativa nao encontrada para esta loja");
    }
    return this.execute({
      tenantId: input.tenantId,
      integrationId: integration.id,
      request: (accessToken, collectorId) =>
        input.request(accessToken, {
          integrationId: integration.id,
          collectorId,
        }),
    });
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
  const provider = error && typeof error === "object"
    ? error as { code?: string; status?: number; retryable?: boolean }
    : {};
  const unauthorized = isUnauthorized(error);
  const status = unauthorized
    ? HttpStatus.UNAUTHORIZED
    : provider.status === 429 || provider.retryable
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.BAD_GATEWAY;
  return new HttpException({
    statusCode: status,
    message: unauthorized
      ? "Mercado Pago recusou a autorizacao"
      : "Mercado Pago recusou ou nao conseguiu processar a solicitacao",
    code: provider.code ?? "MERCADO_PAGO_COMMUNICATION",
  }, status);
}
