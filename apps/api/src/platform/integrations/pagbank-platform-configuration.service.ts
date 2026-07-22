import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { PrismaService } from "../database/prisma.service";
import { UpdatePagBankPlatformConfigurationDto } from "./dto/pagbank-platform-configuration.dto";

const DEFAULT_API_BASE_URL = "https://edi.api.pagbank.com.br";
const DEFAULT_EDI_VERSION = "v3.01";

type PagBankPlatformConfiguration = { apiBaseUrl?: string; ediVersion?: string };

@Injectable()
export class PagBankPlatformConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly environment: ConfigService
  ) {}

  async safeView() {
    const stored = await this.stored();
    return {
      apiBaseUrl:
        stored?.apiBaseUrl ??
        this.environment.get<string>("PAGBANK_EDI_BASE_URL") ??
        DEFAULT_API_BASE_URL,
      ediVersion:
        stored?.ediVersion ??
        this.environment.get<string>("PAGBANK_EDI_VERSION") ??
        DEFAULT_EDI_VERSION,
      source: stored ? ("DATABASE" as const) : ("ENVIRONMENT" as const),
    };
  }

  async apiBaseUrl(): Promise<string> {
    return (await this.safeView()).apiBaseUrl;
  }

  async ediVersion(): Promise<string> {
    return (await this.safeView()).ediVersion;
  }

  async update(dto: UpdatePagBankPlatformConfigurationDto, userId: string) {
    const current = (await this.stored()) ?? {};
    const next = {
      ...current,
      ...(dto.apiBaseUrl ? { apiBaseUrl: dto.apiBaseUrl.trim() } : {}),
      ...(dto.ediVersion ? { ediVersion: dto.ediVersion.trim() } : {}),
    };
    await this.prisma.platformIntegrationConfiguration.upsert({
      where: { provider: "PAGBANK" },
      create: {
        provider: "PAGBANK",
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

  private async stored(): Promise<PagBankPlatformConfiguration | null> {
    const record = await this.prisma.platformIntegrationConfiguration.findUnique({
      where: { provider: "PAGBANK" },
    });
    if (!record) return null;
    return JSON.parse(
      this.secrets.decrypt(record.configurationCiphertext)
    ) as PagBankPlatformConfiguration;
  }
}
