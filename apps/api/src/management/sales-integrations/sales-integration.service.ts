import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SalesCredentialStatus, SalesIntegrationStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import {
  SalesCredentialDto,
  SalesIntegrationStatusDto,
  UpsertSalesIntegrationDto,
} from "./dto/sales-integration.dto";

@Injectable()
export class SalesIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService
  ) {}
  list(tenantId: string) {
    return this.prisma.salesIntegration
      .findMany({
        where: { tenantId },
        include: { credentials: { where: { status: SalesCredentialStatus.ACTIVE }, take: 1 } },
        orderBy: { createdAt: "desc" },
      })
      .then((rows) => rows.map((row) => this.view(row)));
  }
  async get(tenantId: string, id: string) {
    const row = await this.find(tenantId, id);
    return this.view(row);
  }
  async create(tenantId: string, userId: string, dto: UpsertSalesIntegrationDto) {
    const row = await this.prisma.salesIntegration.create({
      data: {
        tenantId,
        createdByUserId: userId,
        updatedByUserId: userId,
        provider: dto.provider,
        channel: dto.channel,
        environment: dto.environment ?? "PRODUCTION",
        credentialMode:
          dto.credentialMode ?? (dto.provider === "PAGBANK" ? "PROVIDER_TOKEN" : "OAUTH"),
        displayName: dto.displayName,
        externalMerchantId: dto.externalMerchantId,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      },
      include: { credentials: true },
    });
    return this.view(row);
  }
  async update(tenantId: string, userId: string, id: string, dto: UpsertSalesIntegrationDto) {
    await this.find(tenantId, id);
    const row = await this.prisma.salesIntegration.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        externalMerchantId: dto.externalMerchantId,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
        updatedByUserId: userId,
      },
      include: { credentials: { where: { status: SalesCredentialStatus.ACTIVE }, take: 1 } },
    });
    return this.view(row);
  }
  async rotateCredential(tenantId: string, userId: string, id: string, dto: SalesCredentialDto) {
    await this.find(tenantId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.salesIntegrationCredential.updateMany({
        where: { tenantId, integrationId: id, status: SalesCredentialStatus.ACTIVE },
        data: { status: SalesCredentialStatus.ROTATED, rotatedAt: new Date() },
      });
      await tx.salesIntegrationCredential.create({
        data: {
          tenantId,
          integrationId: id,
          credentialType: "PAGBANK_EDI_TOKEN",
          secretCiphertext: this.secrets.encryptEnvelope({
            version: 1,
            kind: "PAGBANK_EDI",
            ediToken: dto.token,
          }),
          fingerprint: this.secrets.fingerprint(dto.token),
          createdByUserId: userId,
        },
      });
    });
  }
  async setStatus(tenantId: string, userId: string, id: string, dto: SalesIntegrationStatusDto) {
    const row = await this.find(tenantId, id);
    if (dto.status === "ACTIVE" && (!row.externalMerchantId || row.credentials.length === 0))
      throw new ConflictException("USER e TOKEN sao obrigatorios para ativar");
    const updated = await this.prisma.salesIntegration.update({
      where: { id },
      data: { status: dto.status as SalesIntegrationStatus, updatedByUserId: userId },
      include: { credentials: { where: { status: SalesCredentialStatus.ACTIVE }, take: 1 } },
    });
    return this.view(updated);
  }
  async getCredential(tenantId: string, id: string) {
    const row = await this.find(tenantId, id);
    const credential = row.credentials[0];
    if (!credential) throw new ConflictException("Credencial ausente");
    const decrypted = this.secrets.decrypt(credential.secretCiphertext);
    let token = decrypted;
    try {
      const parsed = JSON.parse(decrypted) as {
        kind?: string;
        ediToken?: string;
        accessToken?: string;
      };
      token = parsed.kind === "PAGBANK_EDI" ? (parsed.ediToken ?? "") : (parsed.accessToken ?? "");
    } catch {
      /* Legacy PagBank ciphertext stores the token directly. */
    }
    if (!token) throw new ConflictException("Credencial invalida");
    return { integration: row, token };
  }
  private async find(tenantId: string, id: string) {
    const row = await this.prisma.salesIntegration.findFirst({
      where: { id, tenantId },
      include: { credentials: { where: { status: SalesCredentialStatus.ACTIVE }, take: 1 } },
    });
    if (!row) throw new NotFoundException("Integracao nao encontrada");
    return row;
  }
  private view(row: Prisma.SalesIntegrationGetPayload<{ include: { credentials: true } }>) {
    const credential = row.credentials.find((item) => item.status === SalesCredentialStatus.ACTIVE);
    const publicStatus =
      row.status === "ACTIVE"
        ? "CONNECTED"
        : row.status === "DISABLED"
          ? "DISCONNECTED"
          : row.status;
    return {
      id: row.id,
      provider: row.provider,
      channel: row.channel,
      environment: row.environment,
      credentialMode: row.credentialMode,
      status: row.status,
      publicStatus,
      displayName: row.displayName,
      externalMerchantId: row.externalMerchantId,
      providerUserId: row.providerUserId,
      settings: row.settings,
      hasCredential: Boolean(credential),
      credentialFingerprint: credential?.fingerprint ?? null,
      tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
      scopes: Array.isArray(row.scopes)
        ? row.scopes.filter((scope): scope is string => typeof scope === "string")
        : [],
      connectedAt: row.connectedAt?.toISOString() ?? null,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
      lastValidationAt: row.lastValidationAt?.toISOString() ?? null,
      lastErrorCode: row.lastErrorCode,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
