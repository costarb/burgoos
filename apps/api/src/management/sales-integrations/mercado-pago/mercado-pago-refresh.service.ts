import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { IntegrationAuditService } from "../integration-audit.service";
import { SalesIntegrationOperationLockService } from "../sales-integration-operation-lock.service";
import { MercadoPagoClient } from "./mercado-pago.client";

@Injectable()
export class MercadoPagoRefreshService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly client: MercadoPagoClient,
    private readonly locks: SalesIntegrationOperationLockService,
    private readonly audit: IntegrationAuditService
  ) {}

  async refresh(tenantId: string, integrationId: string): Promise<boolean> {
    const owner = `mp-refresh:${randomUUID()}`;
    if (!(await this.locks.acquire({ tenantId, integrationId, owner, leaseMs: 60_000 })))
      return false;
    try {
      const connection = await this.prisma.salesIntegration.findFirst({
        where: { id: integrationId, tenantId, provider: "MERCADO_PAGO", credentialMode: "OAUTH" },
        include: { credentials: { where: { status: "ACTIVE" }, take: 1 } },
      });
      if (!connection) throw new NotFoundException("Conexao OAuth Mercado Pago nao encontrada");
      const credential = connection.credentials[0];
      if (!credential) throw new ConflictException("Credencial OAuth ausente");
      const envelope = this.secrets.decryptEnvelope(credential.secretCiphertext);
      if (envelope.kind !== "MERCADO_PAGO_OAUTH")
        throw new ConflictException("Credencial OAuth invalida");
      await this.prisma.salesIntegration.update({
        where: { id: integrationId },
        data: { status: "REFRESHING" },
      });
      const refreshed = await this.client.refreshAuthorization(envelope.refreshToken);
      if (!refreshed.refresh_token)
        throw new ConflictException("Refresh token nao retornado pelo Mercado Pago");
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      const scopes = (refreshed.scope ?? "").split(/\s+/).filter(Boolean);
      const ciphertext = this.secrets.encryptEnvelope({
        version: 1,
        kind: "MERCADO_PAGO_OAUTH",
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
      });
      await this.prisma.$transaction(async (tx) => {
        const rotated = await tx.salesIntegrationCredential.updateMany({
          where: { id: credential.id, status: "ACTIVE" },
          data: { status: "ROTATED", rotatedAt: new Date() },
        });
        if (rotated.count !== 1) throw new ConflictException("Credencial OAuth ja foi renovada");
        await tx.salesIntegrationCredential.create({
          data: {
            tenantId,
            integrationId,
            credentialType: "MERCADO_PAGO_OAUTH",
            secretCiphertext: ciphertext,
            fingerprint: this.secrets.fingerprint(refreshed.access_token),
            expiresAt,
            scopes,
            validatedProviderUserId: String(refreshed.user_id),
            validationStatus: "VALID",
            createdByUserId: credential.createdByUserId,
          },
        });
        await tx.salesIntegration.update({
          where: { id: integrationId },
          data: {
            status: "ACTIVE",
            tokenExpiresAt: expiresAt,
            scopes,
            providerUserId: String(refreshed.user_id),
            lastValidationAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
      });
      await this.audit.record({
        tenantId,
        integrationId,
        action: "MERCADO_PAGO_TOKEN_REFRESHED",
        outcome: "SUCCESS",
        metadata: { expiresAt: expiresAt.toISOString() },
      });
      return true;
    } catch (error) {
      await this.prisma.salesIntegration.updateMany({
        where: { id: integrationId, tenantId },
        data: {
          status: "REAUTHORIZATION_REQUIRED",
          lastErrorCode: "TOKEN_REFRESH_FAILED",
          lastErrorMessage: "Nao foi possivel renovar a autorizacao Mercado Pago",
        },
      });
      await this.audit.record({
        tenantId,
        integrationId,
        action: "MERCADO_PAGO_TOKEN_REFRESHED",
        outcome: "FAILED",
      });
      throw error;
    } finally {
      await this.locks.release({ tenantId, integrationId, owner });
    }
  }
}
