import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  DeliveryIntegrationAuditAction,
  DeliveryProvider,
  DeliveryProvider as PrismaDeliveryProvider,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import {
  DeliveryAuthorizationCodeDto,
  DeliveryCredentialDto,
  DeliveryIntegrationDto,
  DeliveryIntegrationUpdateDto,
} from "./dto/delivery-integration.dto";
import { IfoodAuthService } from "./ifood/ifood-auth.service";
import { DeliveryIntegrationAuditService } from "./delivery-integration-audit.service";
import { DeliveryProviderRegistryService } from "./delivery-provider-registry.service";

@Injectable()
export class DeliveryIntegrationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly integrationSecrets: IntegrationSecretService,
    @Inject(IfoodAuthService) private readonly ifoodAuth: IfoodAuthService,
    @Inject(DeliveryProviderRegistryService)
    private readonly providerRegistry: DeliveryProviderRegistryService,
    @Inject(DeliveryIntegrationAuditService)
    private readonly audit: DeliveryIntegrationAuditService
  ) {}

  async list(tenantId: string) {
    const integrations = await this.prisma.deliveryIntegration.findMany({
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

    return integrations.map((integration) => this.toResponse(integration));
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
    const authMode = dto.authMode === "CENTRALIZED" ? "CENTRALIZED" : "DISTRIBUTED";

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
          credentialType:
            authMode === "CENTRALIZED" ? "CENTRALIZED_CLIENT_CREDENTIALS" : "DISTRIBUTED_OAUTH",
          secretCiphertext: this.integrationSecrets.encrypt(
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
            authMode,
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
      metadata: { provider: integration.provider, authMode, tokenExpiresAt: token.expiresAt },
    });
  }

  async requestAuthorizationCode(
    tenantId: string,
    actorUserId: string,
    integrationId: string,
    dto: DeliveryAuthorizationCodeDto
  ) {
    const integration = await this.getForTenant(tenantId, integrationId);

    if (integration.provider !== DeliveryProvider.IFOOD) {
      throw new ConflictException(`Provider ${integration.provider} does not support user code`);
    }

    const userCode = await this.ifoodAuth.requestUserCode(dto);

    await this.audit.record({
      tenantId,
      integrationId,
      actorUserId,
      action: DeliveryIntegrationAuditAction.VALIDATION_RUN,
      entityType: "DeliveryIntegration",
      entityId: integrationId,
      result: "USER_CODE_CREATED",
      metadata: {
        provider: integration.provider,
        userCode: userCode.userCode,
        expiresIn: userCode.expiresIn,
      },
    });

    return {
      userCode: userCode.userCode,
      authorizationCodeVerifier: userCode.authorizationCodeVerifier,
      verificationUrl: userCode.verificationUrl,
      verificationUrlComplete: userCode.verificationUrlComplete,
      expiresIn: userCode.expiresIn,
    };
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

    const secret = JSON.parse(this.integrationSecrets.decrypt(credential.secretCiphertext)) as {
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

    return JSON.parse(this.integrationSecrets.decrypt(credential.secretCiphertext)) as {
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
      return this.providerRegistry.get(provider).validateMerchant({
        externalMerchantId,
        credentialSecret,
      });
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
    credentials: Array<{
      status: string;
      credentialType: string;
      tokenExpiresAt: Date | null;
      metadata: Prisma.JsonValue | null;
    }>;
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
      credentialType: credential?.credentialType ?? null,
      authMode: this.authModeFromCredential(credential),
      credentialExpiresAt: credential?.tokenExpiresAt?.toISOString() ?? null,
      homologationStatus: integration.homologationStatus,
      lastValidationAt: integration.lastValidationAt?.toISOString() ?? null,
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
      capabilities: this.providerRegistry.get(integration.provider).capabilities,
    };
  }

  private authModeFromCredential(
    credential:
      | {
          credentialType: string;
          metadata: Prisma.JsonValue | null;
        }
      | undefined
  ) {
    if (!credential) {
      return null;
    }

    const metadata =
      credential.metadata &&
      typeof credential.metadata === "object" &&
      !Array.isArray(credential.metadata)
        ? (credential.metadata as Record<string, unknown>)
        : {};
    const metadataMode = metadata.authMode;
    if (metadataMode === "CENTRALIZED" || metadataMode === "DISTRIBUTED") {
      return metadataMode;
    }

    return credential.credentialType === "CENTRALIZED_CLIENT_CREDENTIALS"
      ? "CENTRALIZED"
      : "DISTRIBUTED";
  }

}
