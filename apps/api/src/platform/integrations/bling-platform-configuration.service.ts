import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { PrismaService } from "../database/prisma.service";
import { UpdateBlingPlatformConfigurationDto } from "./dto/bling-platform-configuration.dto";

type BlingPlatformConfiguration = {
  clientId?: string;
  clientSecret?: string;
  /** Where the store admin lands after the OAuth callback (web app fiscal screen). */
  postCallbackUrl?: string;
  apiBaseUrl?: string;
  authorizeUrl?: string;
};

export type BlingConfigurationKey = keyof BlingPlatformConfiguration;

/** Path registered as the redirect URL of the Bling app (API global prefix included). */
export const BLING_CALLBACK_PATH = "/api/integrations/bling/callback";

/** Platform-level Bling OAuth app (client id/secret), like the Mercado Pago one. */
@Injectable()
export class BlingPlatformConfigurationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IntegrationSecretService) private readonly secrets: IntegrationSecretService,
    @Inject(ConfigService) private readonly environment: ConfigService
  ) {}

  async safeView(callbackBaseUrl?: string) {
    const stored = await this.stored();
    const clientId = await this.value("clientId");
    const clientSecret = await this.value("clientSecret");
    return {
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(clientSecret),
      clientIdHint: clientId ? `${clientId.slice(0, 6)}…` : null,
      postCallbackUrl: (await this.value("postCallbackUrl")) ?? null,
      redirectUri: callbackBaseUrl ? `${callbackBaseUrl.replace(/\/$/, "")}${BLING_CALLBACK_PATH}` : BLING_CALLBACK_PATH,
      source: stored ? "DATABASE" : "ENVIRONMENT",
      oauthReady: Boolean(clientId && clientSecret),
    } as const;
  }

  async update(dto: UpdateBlingPlatformConfigurationDto, userId: string, callbackBaseUrl?: string) {
    const current = (await this.stored()) ?? {};
    const next = {
      ...current,
      ...Object.fromEntries(
        Object.entries(dto).filter(([, value]) => typeof value === "string" && value.trim().length > 0).map(([key, value]) => [key, (value as string).trim()])
      ),
    };
    const configurationCiphertext = this.secrets.encrypt(JSON.stringify(next));
    await this.prisma.platformFiscalProviderConfiguration.upsert({
      where: { provider: "BLING" },
      create: { provider: "BLING", configurationCiphertext, updatedByUserId: userId },
      update: { configurationCiphertext, updatedByUserId: userId },
    });
    return this.safeView(callbackBaseUrl);
  }

  async value(key: BlingConfigurationKey): Promise<string | undefined> {
    const stored = await this.stored();
    return stored?.[key] ?? this.environment.get<string>(ENV_KEYS[key]) ?? DEFAULTS[key];
  }

  async required(key: BlingConfigurationKey): Promise<string> {
    const value = await this.value(key);
    if (!value) throw new ConflictException({ code: "BLING_NOT_CONFIGURED", message: "Aplicativo Bling nao configurado na plataforma" });
    return value;
  }

  private async stored(): Promise<BlingPlatformConfiguration | null> {
    const record = await this.prisma.platformFiscalProviderConfiguration.findUnique({ where: { provider: "BLING" } });
    if (!record) return null;
    return JSON.parse(this.secrets.decrypt(record.configurationCiphertext)) as BlingPlatformConfiguration;
  }
}

const ENV_KEYS: Record<BlingConfigurationKey, string> = {
  clientId: "BLING_CLIENT_ID",
  clientSecret: "BLING_CLIENT_SECRET",
  postCallbackUrl: "BLING_POST_CALLBACK_URL",
  apiBaseUrl: "BLING_API_BASE_URL",
  authorizeUrl: "BLING_AUTHORIZE_URL",
};

const DEFAULTS: Partial<Record<BlingConfigurationKey, string>> = {
  apiBaseUrl: "https://api.bling.com.br/Api/v3",
  authorizeUrl: "https://www.bling.com.br/Api/v3/oauth/authorize",
};
