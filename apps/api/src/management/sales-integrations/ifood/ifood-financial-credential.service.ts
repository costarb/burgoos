import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { IfoodAuthService } from "../../integrations/ifood/ifood-auth.service";

interface OperationalIfoodSecret {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string | null;
}

export interface IfoodFinancialCredential {
  accessToken: string;
  merchantId: string;
  environment: "TEST" | "PRODUCTION";
  expiresAt: Date | null;
}

@Injectable()
export class IfoodFinancialCredentialService {
  private static readonly REFRESH_SKEW_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly ifoodAuth: IfoodAuthService
  ) {}

  async getCredential(
    tenantId: string,
    salesIntegrationId: string
  ): Promise<IfoodFinancialCredential> {
    const integration = await this.prisma.salesIntegration.findFirst({
      where: { id: salesIntegrationId, tenantId, provider: "IFOOD" },
      include: {
        deliveryIntegration: {
          include: {
            credentials: {
              where: { status: "ACTIVE" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!integration) throw new NotFoundException("Integracao financeira iFood nao encontrada");
    const delivery = integration.deliveryIntegration;
    if (!delivery || delivery.tenantId !== tenantId) {
      throw new UnprocessableEntityException("Conexao operacional iFood pertence a outra loja");
    }
    if (
      delivery.provider !== "IFOOD" ||
      delivery.environment !== integration.environment ||
      !delivery.externalMerchantId ||
      delivery.externalMerchantId !== integration.externalMerchantId
    ) {
      throw new UnprocessableEntityException("Merchant ou ambiente iFood divergente");
    }

    const credential = delivery.credentials[0];
    if (!credential) throw new ConflictException("Credencial operacional iFood ativa ausente");
    const secret = this.parseSecret(credential.secretCiphertext);
    const shouldRefresh =
      !credential.tokenExpiresAt ||
      credential.tokenExpiresAt.getTime() <=
        Date.now() + IfoodFinancialCredentialService.REFRESH_SKEW_MS;

    if (!shouldRefresh) {
      return {
        accessToken: secret.accessToken,
        merchantId: delivery.externalMerchantId,
        environment: integration.environment,
        expiresAt: credential.tokenExpiresAt,
      };
    }

    const metadata = this.objectValue(credential.metadata);
    const authMode = metadata.authMode === "CENTRALIZED" ? "CENTRALIZED" : "DISTRIBUTED";
    if (authMode === "DISTRIBUTED" && !secret.refreshToken) {
      throw new ConflictException("Reautorizacao da conexao operacional iFood necessaria");
    }
    const refreshed = await this.ifoodAuth.exchangeAuthorizationCode({
      authMode,
      clientId: secret.clientId,
      clientSecret: secret.clientSecret,
      refreshToken: secret.refreshToken,
    });
    const nextSecret: OperationalIfoodSecret = {
      ...secret,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? secret.refreshToken,
    };
    await this.prisma.deliveryIntegrationCredential.update({
      where: { id: credential.id },
      data: {
        secretCiphertext: this.secrets.encrypt(JSON.stringify(nextSecret)),
        tokenExpiresAt: refreshed.expiresAt,
        refreshExpiresAt: refreshed.refreshExpiresAt ?? credential.refreshExpiresAt,
        scopes: refreshed.scopes ?? undefined,
        metadata: {
          ...metadata,
          authMode,
          refreshedAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      },
    });
    return {
      accessToken: refreshed.accessToken,
      merchantId: delivery.externalMerchantId,
      environment: integration.environment,
      expiresAt: refreshed.expiresAt,
    };
  }

  private parseSecret(ciphertext: string): OperationalIfoodSecret {
    let value: unknown;
    try {
      value = JSON.parse(this.secrets.decrypt(ciphertext));
    } catch {
      throw new ConflictException("Credencial operacional iFood invalida");
    }
    const record = this.objectValue(value);
    if (
      typeof record.clientId !== "string" ||
      typeof record.clientSecret !== "string" ||
      typeof record.accessToken !== "string"
    ) {
      throw new ConflictException("Credencial operacional iFood invalida");
    }
    return {
      clientId: record.clientId,
      clientSecret: record.clientSecret,
      accessToken: record.accessToken,
      refreshToken: typeof record.refreshToken === "string" ? record.refreshToken : null,
    };
  }

  private objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
