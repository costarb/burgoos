import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import {
  DeliveryIntegrationAuditAction,
  DeliveryProvider,
  DeliveryProvider as PrismaDeliveryProvider,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import {
  DeliveryCredentialDto,
  DeliveryIntegrationDto,
  DeliveryIntegrationUpdateDto,
} from "./dto/delivery-integration.dto";
import { IfoodAuthService } from "./ifood/ifood-auth.service";
import { IfoodClient } from "./ifood/ifood-client";
import { DeliveryIntegrationAuditService } from "./delivery-integration-audit.service";

@Injectable()
export class DeliveryIntegrationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(IfoodAuthService) private readonly ifoodAuth: IfoodAuthService,
    @Inject(IfoodClient) private readonly ifoodClient: IfoodClient,
    @Inject(DeliveryIntegrationAuditService)
    private readonly audit: DeliveryIntegrationAuditService
  ) {}

  list(tenantId: string) {
    return this.prisma.deliveryIntegration.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async create(tenantId: string, actorUserId: string, dto: DeliveryIntegrationDto) {
    await this.ensureOrderPlatformBelongsToTenant(tenantId, dto.orderPlatformId);

    const integration = await this.prisma.deliveryIntegration.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: dto.provider,
        },
      },
      update: {
        displayName: dto.displayName,
        externalMerchantId: dto.externalMerchantId ?? null,
        orderPlatformId: dto.orderPlatformId,
        pollingEnabled: dto.pollingEnabled ?? true,
        webhookEnabled: dto.webhookEnabled ?? false,
        updatedByUserId: actorUserId,
      },
      create: {
        tenantId,
        provider: dto.provider,
        displayName: dto.displayName,
        externalMerchantId: dto.externalMerchantId ?? null,
        orderPlatformId: dto.orderPlatformId,
        pollingEnabled: dto.pollingEnabled ?? true,
        webhookEnabled: dto.webhookEnabled ?? false,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    await this.audit.record({
      tenantId,
      integrationId: integration.id,
      actorUserId,
      action: DeliveryIntegrationAuditAction.CONFIG_CREATED,
      entityType: "DeliveryIntegration",
      entityId: integration.id,
      result: "SUCCESS",
      metadata: { provider: dto.provider, externalMerchantId: dto.externalMerchantId },
    });

    return this.toResponse(integration);
  }

  async getForTenant(tenantId: string, id: string) {
    const integration = await this.prisma.deliveryIntegration.findFirst({
      where: { id, tenantId },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException("Delivery integration not found");
    }

    return integration;
  }

  async getDetail(tenantId: string, id: string) {
    return this.toResponse(await this.getForTenant(tenantId, id));
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: DeliveryIntegrationUpdateDto
  ) {
    await this.getForTenant(tenantId, id);

    const integration = await this.prisma.deliveryIntegration.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        externalMerchantId: dto.externalMerchantId,
        pollingEnabled: dto.pollingEnabled,
        webhookEnabled: dto.webhookEnabled,
        updatedByUserId: actorUserId,
      },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    await this.audit.record({
      tenantId,
      integrationId: id,
      actorUserId,
      action: DeliveryIntegrationAuditAction.CONFIG_UPDATED,
      entityType: "DeliveryIntegration",
      entityId: id,
      result: "SUCCESS",
      metadata: dto,
    });

    return this.toResponse(integration);
  }

  async saveCredentials(
    tenantId: string,
    actorUserId: string,
    integrationId: string,
    dto: DeliveryCredentialDto
  ) {
    const integration = await this.getForTenant(tenantId, integrationId);
    const token = await this.exchangeToken(integration.provider, dto);

    await this.prisma.$transaction([
      this.prisma.deliveryIntegrationCredential.updateMany({
        where: {
          tenantId,
          integrationId,
          status: "ACTIVE",
        },
        data: {
          status: "ROTATED",
          rotatedAt: new Date(),
        },
      }),
      this.prisma.deliveryIntegrationCredential.create({
        data: {
          tenantId,
          integrationId,
          status: "ACTIVE",
          credentialType: "DISTRIBUTED_OAUTH",
          secretCiphertext: this.encryptSecret(
            JSON.stringify({
              clientId: dto.clientId,
              clientSecret: dto.clientSecret,
              accessToken: token.accessToken,
              refreshToken: token.refreshToken ?? null,
            })
          ),
          tokenExpiresAt: token.expiresAt,
          refreshExpiresAt: token.refreshExpiresAt ?? null,
          scopes: token.scopes ?? undefined,
          metadata: {
            raw: token.raw,
          } as Prisma.InputJsonObject,
          createdByUserId: actorUserId,
        },
      }),
    ]);

    await this.audit.record({
      tenantId,
      integrationId,
      actorUserId,
      action: DeliveryIntegrationAuditAction.CREDENTIAL_ROTATED,
      entityType: "DeliveryIntegrationCredential",
      result: "SUCCESS",
      metadata: { provider: integration.provider, tokenExpiresAt: token.expiresAt },
    });
  }

  async validate(tenantId: string, actorUserId: string, id: string) {
    const integration = await this.getForTenant(tenantId, id);
    const credential = integration.credentials[0];

    if (!credential) {
      throw new ConflictException("Credenciais ativas ausentes");
    }

    if (!integration.externalMerchantId) {
      throw new ConflictException("Merchant iFood ausente");
    }

    const secret = JSON.parse(this.decryptSecret(credential.secretCiphertext)) as {
      accessToken?: string;
    };

    const validation = await this.validateProvider(
      integration.provider,
      integration.externalMerchantId,
      secret.accessToken ?? ""
    );

    const updated = await this.prisma.deliveryIntegration.update({
      where: { id },
      data: {
        status: validation.valid ? "DRAFT" : "REQUIRES_ATTENTION",
        lastValidationAt: new Date(),
        lastErrorAt: validation.valid ? null : new Date(),
        lastErrorCode: validation.valid ? null : "VALIDATION_FAILED",
        lastErrorMessage: validation.valid
          ? null
          : validation.checks.find((check) => check.status === "FAIL")?.message,
        updatedByUserId: actorUserId,
      },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    await this.audit.record({
      tenantId,
      integrationId: id,
      actorUserId,
      action: DeliveryIntegrationAuditAction.VALIDATION_RUN,
      entityType: "DeliveryIntegration",
      entityId: id,
      result: validation.valid ? "SUCCESS" : "FAILED",
      metadata: validation,
    });

    return {
      status: updated.status,
      valid: validation.valid,
      checks: validation.checks,
    };
  }

  async activate(tenantId: string, actorUserId: string, id: string) {
    const integration = await this.getForTenant(tenantId, id);

    if (!integration.externalMerchantId || integration.credentials.length === 0) {
      throw new ConflictException("Integracao ainda nao esta pronta para ativacao");
    }

    const updated = await this.prisma.deliveryIntegration.update({
      where: { id },
      data: {
        status: "ACTIVE",
        updatedByUserId: actorUserId,
      },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    await this.audit.record({
      tenantId,
      integrationId: id,
      actorUserId,
      action: DeliveryIntegrationAuditAction.CONFIG_ACTIVATED,
      entityType: "DeliveryIntegration",
      entityId: id,
      result: "SUCCESS",
    });

    return this.toResponse(updated);
  }

  async pause(tenantId: string, actorUserId: string, id: string) {
    await this.getForTenant(tenantId, id);

    const updated = await this.prisma.deliveryIntegration.update({
      where: { id },
      data: {
        status: "PAUSED",
        updatedByUserId: actorUserId,
      },
      include: {
        credentials: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    await this.audit.record({
      tenantId,
      integrationId: id,
      actorUserId,
      action: DeliveryIntegrationAuditAction.CONFIG_PAUSED,
      entityType: "DeliveryIntegration",
      entityId: id,
      result: "SUCCESS",
    });

    return this.toResponse(updated);
  }

  async findActiveByProvider(tenantId: string, provider: DeliveryProvider) {
    return this.prisma.deliveryIntegration.findFirst({
      where: {
        tenantId,
        provider,
        status: "ACTIVE",
      },
    });
  }

  async getActiveCredentialSecret(tenantId: string, integrationId: string) {
    const integration = await this.getForTenant(tenantId, integrationId);
    const credential = integration.credentials[0];

    if (!credential) {
      throw new ConflictException("Credenciais ativas ausentes");
    }

    return JSON.parse(this.decryptSecret(credential.secretCiphertext)) as {
      clientId: string;
      clientSecret: string;
      accessToken: string;
      refreshToken: string | null;
    };
  }

  private async ensureOrderPlatformBelongsToTenant(tenantId: string, orderPlatformId: string) {
    const platform = await this.prisma.orderPlatform.findFirst({
      where: { id: orderPlatformId, tenantId },
      select: { id: true },
    });

    if (!platform) {
      throw new UnprocessableEntityException("Plataforma de pedido invalida para a loja");
    }
  }

  private exchangeToken(provider: PrismaDeliveryProvider, dto: DeliveryCredentialDto) {
    if (provider === DeliveryProvider.IFOOD) {
      return this.ifoodAuth.exchangeAuthorizationCode(dto);
    }

    throw new ConflictException(`Provider ${provider} does not support credentials`);
  }

  private validateProvider(
    provider: PrismaDeliveryProvider,
    externalMerchantId: string,
    credentialSecret: string
  ) {
    if (provider === DeliveryProvider.IFOOD) {
      return this.ifoodClient.validateMerchant({ externalMerchantId, credentialSecret });
    }

    throw new ConflictException(`Provider ${provider} does not support validation`);
  }

  private toResponse(integration: {
    id: string;
    provider: DeliveryProvider;
    displayName: string;
    status: string;
    externalMerchantId: string | null;
    pollingEnabled: boolean;
    webhookEnabled: boolean;
    lastSuccessfulPollingAt: Date | null;
    lastErrorMessage: string | null;
    lastValidationAt: Date | null;
    homologationStatus: string;
    createdAt: Date;
    updatedAt: Date;
    credentials: Array<{ status: string; tokenExpiresAt: Date | null }>;
  }) {
    const credential = integration.credentials[0];

    return {
      id: integration.id,
      provider: integration.provider,
      displayName: integration.displayName,
      status: integration.status,
      externalMerchantId: integration.externalMerchantId,
      pollingEnabled: integration.pollingEnabled,
      webhookEnabled: integration.webhookEnabled,
      lastSuccessfulPollingAt: integration.lastSuccessfulPollingAt?.toISOString() ?? null,
      lastErrorMessage: integration.lastErrorMessage,
      credentialStatus: credential?.status ?? null,
      credentialExpiresAt: credential?.tokenExpiresAt?.toISOString() ?? null,
      homologationStatus: integration.homologationStatus,
      lastValidationAt: integration.lastValidationAt?.toISOString() ?? null,
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    };
  }

  private encryptSecret(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.secretKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  private decryptSecret(cipherText: string): string {
    const buffer = Buffer.from(cipherText, "base64");
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.secretKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }

  private secretKey(): Buffer {
    const configured = this.config.get<string>("DELIVERY_INTEGRATION_SECRET_KEY");

    if (configured) {
      const decoded = Buffer.from(configured, "base64");
      if (decoded.length === 32) {
        return decoded;
      }
    }

    return createHash("sha256")
      .update(configured ?? "burgoos-local-delivery-integration-secret")
      .digest();
  }
}
