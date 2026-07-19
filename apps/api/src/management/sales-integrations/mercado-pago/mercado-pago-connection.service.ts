import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { IntegrationAuditService } from "../integration-audit.service";
import { MercadoPagoClient } from "./mercado-pago.client";
import { MercadoPagoOAuthService } from "./mercado-pago-oauth.service";
import { SalesImportPreviewService } from "../sales-import-preview.service";
import { SalesImportRunProcessor } from "../sales-import-run.processor";
import { period } from "./mercado-pago-sync.controller";

@Injectable()
export class MercadoPagoConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly client: MercadoPagoClient,
    private readonly oauth: MercadoPagoOAuthService,
    private readonly audit: IntegrationAuditService,
    private readonly preview: SalesImportPreviewService = undefined as unknown as SalesImportPreviewService,
    private readonly processor: SalesImportRunProcessor = undefined as unknown as SalesImportRunProcessor
  ) {}

  startOAuth(input: {
    tenantId: string;
    integrationId: string;
    userId: string;
    initialLoadDays: 30 | 60 | 90;
  }) {
    return this.oauth.start(input);
  }

  async connectFixedToken(input: {
    tenantId: string;
    integrationId: string;
    userId: string;
    accessToken: string;
  }) {
    const integration = await this.requireIntegration(input.tenantId, input.integrationId);
    const account = await this.client.validateAccessToken(input.accessToken);
    const encrypted = this.secrets.encryptEnvelope({
      version: 1,
      kind: "MERCADO_PAGO_FIXED",
      accessToken: input.accessToken,
    });
    await this.activate({
      tenantId: input.tenantId,
      integrationId: integration.id,
      userId: input.userId,
      environment: integration.environment,
      providerUserId: String(account.id),
      credentialMode: "FIXED_TOKEN",
      credentialType: "MERCADO_PAGO_FIXED",
      ciphertext: encrypted,
      fingerprint: this.secrets.fingerprint(input.accessToken),
      scopes: [],
      expiresAt: null,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      integrationId: integration.id,
      actorUserId: input.userId,
      action: "MERCADO_PAGO_FIXED_TOKEN_CONNECTED",
      outcome: "SUCCESS",
      metadata: { providerUserId: String(account.id) },
    });
    return this.publicView(integration.id, input.tenantId);
  }

  async completeOAuth(code: string, state: string) {
    const attempt = await this.oauth.claim(state);
    try {
      const token = await this.client.exchangeAuthorizationCode({
        code,
        codeVerifier: attempt.codeVerifier,
      });
      if (!token.refresh_token || !(token.scope ?? "").split(/\s+/).includes("offline_access")) {
        throw new ConflictException("Mercado Pago nao concedeu acesso offline; reconecte a conta");
      }
      const expiresAt = new Date(Date.now() + token.expires_in * 1000);
      await this.activate({
        tenantId: attempt.tenantId,
        integrationId: attempt.integrationId,
        userId: attempt.requestedByUserId,
        environment: attempt.environment,
        providerUserId: String(token.user_id),
        credentialMode: "OAUTH",
        credentialType: "MERCADO_PAGO_OAUTH",
        ciphertext: this.secrets.encryptEnvelope({
          version: 1,
          kind: "MERCADO_PAGO_OAUTH",
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
        }),
        fingerprint: this.secrets.fingerprint(token.access_token),
        scopes: (token.scope ?? "").split(/\s+/).filter(Boolean),
        expiresAt,
      });
      await this.oauth.complete(attempt.id);
      await this.audit.record({
        tenantId: attempt.tenantId,
        integrationId: attempt.integrationId,
        actorUserId: attempt.requestedByUserId,
        action: "MERCADO_PAGO_OAUTH_CONNECTED",
        outcome: "SUCCESS",
        metadata: {
          providerUserId: String(token.user_id),
          initialLoadDays: attempt.initialLoadDays,
        },
      });
      if (this.preview && this.processor) {
        const dates = period(attempt.initialLoadDays as 30 | 60 | 90);
        const run = await this.preview.create(
          attempt.tenantId,
          attempt.requestedByUserId,
          { integrationId: attempt.integrationId, ...dates, strategy: "PRICE_WEIGHTED" },
          "INITIAL_LOAD"
        );
        this.processor.queuePreview(run.id, attempt.tenantId);
        return {
          integrationId: attempt.integrationId,
          initialLoadDays: attempt.initialLoadDays,
          runId: run.id,
        };
      }
      return {
        integrationId: attempt.integrationId,
        initialLoadDays: attempt.initialLoadDays,
        runId: undefined,
      };
    } catch (error) {
      await this.oauth.fail(attempt.id, "TOKEN_EXCHANGE_FAILED");
      throw error;
    }
  }

  async disconnect(tenantId: string, integrationId: string, userId: string) {
    await this.requireIntegration(tenantId, integrationId);
    await this.prisma.$transaction([
      this.prisma.salesIntegrationCredential.updateMany({
        where: { tenantId, integrationId, status: "ACTIVE" },
        data: { status: "REVOKED", rotatedAt: new Date() },
      }),
      this.prisma.salesIntegration.update({
        where: { id: integrationId },
        data: {
          status: "DISABLED",
          providerUserId: null,
          tokenExpiresAt: null,
          scopes: [],
          disconnectedAt: new Date(),
          updatedByUserId: userId,
        },
      }),
    ]);
    await this.audit.record({
      tenantId,
      integrationId,
      actorUserId: userId,
      action: "MERCADO_PAGO_DISCONNECTED",
      outcome: "SUCCESS",
    });
    return this.publicView(integrationId, tenantId);
  }

  private async activate(input: {
    tenantId: string;
    integrationId: string;
    userId: string;
    environment: "TEST" | "PRODUCTION";
    providerUserId: string;
    credentialMode: "OAUTH" | "FIXED_TOKEN";
    credentialType: string;
    ciphertext: string;
    fingerprint: string;
    scopes: string[];
    expiresAt: Date | null;
  }) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.salesIntegration.findFirst({
          where: {
            provider: "MERCADO_PAGO",
            providerUserId: input.providerUserId,
            environment: input.environment,
            NOT: { id: input.integrationId },
          },
          select: { id: true },
        });
        if (duplicate)
          throw new ConflictException("Conta Mercado Pago ja conectada a outro estabelecimento");
        await tx.salesIntegrationCredential.updateMany({
          where: { tenantId: input.tenantId, integrationId: input.integrationId, status: "ACTIVE" },
          data: { status: "ROTATED", rotatedAt: new Date() },
        });
        await tx.salesIntegrationCredential.create({
          data: {
            tenantId: input.tenantId,
            integrationId: input.integrationId,
            credentialType: input.credentialType,
            secretCiphertext: input.ciphertext,
            fingerprint: input.fingerprint,
            expiresAt: input.expiresAt,
            scopes: input.scopes,
            validatedProviderUserId: input.providerUserId,
            validationStatus: "VALID",
            createdByUserId: input.userId,
          },
        });
        await tx.salesIntegration.update({
          where: { id: input.integrationId },
          data: {
            credentialMode: input.credentialMode,
            status: "ACTIVE",
            providerUserId: input.providerUserId,
            tokenExpiresAt: input.expiresAt,
            scopes: input.scopes,
            connectedAt: new Date(),
            disconnectedAt: null,
            lastValidationAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
            updatedByUserId: input.userId,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Conta Mercado Pago ja conectada a outro estabelecimento");
      throw error;
    }
  }

  private async requireIntegration(tenantId: string, integrationId: string) {
    const integration = await this.prisma.salesIntegration.findFirst({
      where: { id: integrationId, tenantId, provider: "MERCADO_PAGO" },
    });
    if (!integration) throw new NotFoundException("Integracao Mercado Pago nao encontrada");
    return integration;
  }

  private async publicView(id: string, tenantId: string) {
    return this.prisma.salesIntegration.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        provider: true,
        environment: true,
        credentialMode: true,
        status: true,
        providerUserId: true,
        tokenExpiresAt: true,
        connectedAt: true,
        lastSyncAt: true,
        disconnectedAt: true,
      },
    });
  }
}
