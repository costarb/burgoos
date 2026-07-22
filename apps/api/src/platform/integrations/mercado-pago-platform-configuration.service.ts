import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { UpdateMercadoPagoPlatformConfigurationDto } from "./dto/mercado-pago-platform-configuration.dto";

type MercadoPagoPlatformConfiguration = {
  apiBaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  redirectUri?: string;
  postCallbackUrl?: string;
};

export type MercadoPagoConfigurationKey = keyof MercadoPagoPlatformConfiguration;

@Injectable()
export class MercadoPagoPlatformConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly environment: ConfigService
  ) {}

  async safeView() {
    const values = await this.resolved();
    const stored = await this.stored();
    return {
      clientIdConfigured: Boolean(values.clientId),
      clientSecretConfigured: Boolean(values.clientSecret),
      webhookSecretConfigured: Boolean(values.webhookSecret),
      apiBaseUrl: values.apiBaseUrl ?? DEFAULTS.apiBaseUrl,
      redirectUri: values.redirectUri ?? null,
      postCallbackUrl: values.postCallbackUrl ?? null,
      source: stored ? "DATABASE" : "ENVIRONMENT",
      oauthReady: Boolean(values.clientId && values.clientSecret && values.redirectUri),
      webhookReady: Boolean(values.webhookSecret),
    } as const;
  }

  async update(dto: UpdateMercadoPagoPlatformConfigurationDto, userId: string) {
    const current = (await this.stored()) ?? {};
    const next = { ...current, ...nonEmpty(dto) };
    await this.prisma.platformIntegrationConfiguration.upsert({
      where: { provider: "MERCADO_PAGO" },
      create: {
        provider: "MERCADO_PAGO",
        configurationCiphertext: this.secrets.encrypt(JSON.stringify(next)),
        updatedByUserId: userId,
      },
      update: {
        configurationCiphertext: this.secrets.encrypt(JSON.stringify(next)),
        updatedByUserId: userId,
      },
    });
    return this.safeView();
  }

  async value(key: MercadoPagoConfigurationKey): Promise<string | undefined> {
    const stored = await this.stored();
    return stored?.[key] ?? this.environment.get<string>(ENV_KEYS[key]) ?? DEFAULTS[key];
  }

  async required(key: MercadoPagoConfigurationKey): Promise<string> {
    const value = await this.value(key);
    if (!value) throw new ConflictException("OAuth Mercado Pago nao configurado");
    return value;
  }

  private async resolved(): Promise<MercadoPagoPlatformConfiguration> {
    const entries = await Promise.all(
      (Object.keys(ENV_KEYS) as MercadoPagoConfigurationKey[]).map(async (key) => [
        key,
        await this.value(key),
      ])
    );
    return Object.fromEntries(entries) as MercadoPagoPlatformConfiguration;
  }

  private async stored(): Promise<MercadoPagoPlatformConfiguration | null> {
    const record = await this.prisma.platformIntegrationConfiguration.findUnique({
      where: { provider: "MERCADO_PAGO" },
    });
    if (!record) return null;
    return JSON.parse(
      this.secrets.decrypt(record.configurationCiphertext)
    ) as MercadoPagoPlatformConfiguration;
  }
}

const ENV_KEYS: Record<MercadoPagoConfigurationKey, string> = {
  apiBaseUrl: "MERCADO_PAGO_API_BASE_URL",
  clientId: "MERCADO_PAGO_CLIENT_ID",
  clientSecret: "MERCADO_PAGO_CLIENT_SECRET",
  webhookSecret: "MERCADO_PAGO_WEBHOOK_SECRET",
  redirectUri: "MERCADO_PAGO_REDIRECT_URI",
  postCallbackUrl: "MERCADO_PAGO_POST_CALLBACK_URL",
};

const DEFAULTS: Partial<Record<MercadoPagoConfigurationKey, string>> = {
  apiBaseUrl: "https://api.mercadopago.com",
};

function nonEmpty(
  dto: UpdateMercadoPagoPlatformConfigurationDto
): MercadoPagoPlatformConfiguration {
  return Object.fromEntries(
    Object.entries(dto).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
  ) as MercadoPagoPlatformConfiguration;
}
