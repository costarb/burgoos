import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { MercadoPagoPlatformConfigurationService } from "../../../platform/integrations/mercado-pago-platform-configuration.service";

@Injectable()
export class MercadoPagoOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: IntegrationSecretService,
    private readonly configuration: MercadoPagoPlatformConfigurationService
  ) {}

  async start(input: {
    tenantId: string;
    integrationId: string;
    userId: string;
    initialLoadDays: 30 | 60 | 90;
  }) {
    const integration = await this.prisma.salesIntegration.findFirst({
      where: { id: input.integrationId, tenantId: input.tenantId, provider: "MERCADO_PAGO" },
    });
    if (!integration) throw new NotFoundException("Integracao Mercado Pago nao encontrada");

    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(64).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.$transaction([
      this.prisma.oAuthAuthorizationAttempt.create({
        data: {
          tenantId: input.tenantId,
          integrationId: input.integrationId,
          requestedByUserId: input.userId,
          environment: integration.environment,
          initialLoadDays: input.initialLoadDays,
          stateHash: this.hashState(state),
          codeVerifierCiphertext: this.secrets.encrypt(verifier),
          expiresAt,
        },
      }),
      this.prisma.salesIntegration.update({
        where: { id: input.integrationId },
        data: {
          credentialMode: "OAUTH",
          status: "PENDING_AUTHORIZATION",
          updatedByUserId: input.userId,
        },
      }),
    ]);

    const url = new URL("https://auth.mercadopago.com/authorization");
    url.search = new URLSearchParams({
      client_id: await this.configuration.required("clientId"),
      response_type: "code",
      platform_id: "mp",
      state,
      redirect_uri: await this.configuration.required("redirectUri"),
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();
    return { authorizationUrl: url.toString(), expiresAt };
  }

  async claim(state: string) {
    const attempt = await this.prisma.oAuthAuthorizationAttempt.findUnique({
      where: { stateHash: this.hashState(state) },
    });
    if (!attempt) throw new ForbiddenException("State OAuth invalido");
    if (attempt.expiresAt <= new Date()) {
      await this.prisma.oAuthAuthorizationAttempt.updateMany({
        where: { id: attempt.id, status: "PENDING" },
        data: { status: "EXPIRED", codeVerifierCiphertext: null },
      });
      throw new GoneException("Autorizacao OAuth expirada");
    }
    const claimed = await this.prisma.oAuthAuthorizationAttempt.updateMany({
      where: { id: attempt.id, status: "PENDING" },
      data: { status: "CONSUMING", consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ConflictException("Autorizacao OAuth ja utilizada");
    if (!(await this.hasAdministrativeAccess(attempt.requestedByUserId, attempt.tenantId))) {
      await this.fail(attempt.id, "ACCESS_REVOKED");
      throw new ForbiddenException("Acesso administrativo ao estabelecimento foi removido");
    }
    if (!attempt.codeVerifierCiphertext) throw new ConflictException("PKCE indisponivel");
    return { ...attempt, codeVerifier: this.secrets.decrypt(attempt.codeVerifierCiphertext) };
  }

  async complete(id: string) {
    await this.prisma.oAuthAuthorizationAttempt.update({
      where: { id },
      data: { status: "COMPLETED", codeVerifierCiphertext: null },
    });
  }
  async fail(id: string, errorCode: string) {
    await this.prisma.oAuthAuthorizationAttempt.update({
      where: { id },
      data: { status: "FAILED", errorCode, codeVerifierCiphertext: null },
    });
  }
  hashState(state: string) {
    return createHash("sha256").update(state).digest("hex");
  }

  private async hasAdministrativeAccess(userId: string, tenantId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: "ACTIVE",
        OR: [
          { isMaster: true },
          { tenantId, role: { in: ["OWNER", "ADMIN"] } },
          {
            storeAssignments: {
              some: {
                tenantId,
                status: "ACTIVE",
                profile: {
                  status: "ACTIVE",
                  permissions: { some: { permission: { key: "integrations.sales.manage" } } },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    return Boolean(user);
  }
}
