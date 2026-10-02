import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccessAuditEventType,
  AccessAuditResult,
  McpOAuthClient,
  McpOAuthRequestStatus,
} from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { AccessAuditService } from "../../access/access-audit.service";
import { areaLabel } from "../mcp-data-areas";
import { OAuthClientService } from "./oauth-client.service";
import {
  RedirectableAuthorizationError,
  UntrustedAuthorizationRequest,
} from "./oauth-errors";
import {
  AUTHORIZATION_CODE_PREFIX,
  AUTHORIZATION_CODE_TTL_SECONDS,
  AUTHORIZATION_REQUEST_TTL_SECONDS,
  generateOpaque,
  hashSecret,
  isValidCodeChallenge,
  MAX_ACTIVE_CONNECTIONS_PER_STORE,
} from "./oauth-tokens.util";
import { MCP_OAUTH_SCOPE, matchesResource, McpOAuthUrls } from "./oauth-urls";
import {
  buildRedirect,
  matchesRegisteredRedirect,
  onlyLoopbackRedirects,
  redirectHost,
} from "./redirect-uri";
import { StoreEligibilityService } from "./store-eligibility";

const TOLERATED_SCOPES = new Set([MCP_OAUTH_SCOPE, "offline_access"]);

export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
}

export type BlockedReason = "MISSING_PERMISSION" | "NO_ELIGIBLE_STORE" | "PLATFORM_ADMIN";

export interface AuthorizationRequestView {
  id: string;
  client: { name: string; redirectHost: string; kind: "CIMD" | "DCR"; loopbackOnly: boolean };
  scopeDescription: string;
  expiresAt: string;
  canAuthorize: boolean;
  blockedReason: BlockedReason | null;
  stores: Array<{ id: string; name: string; areas: Array<{ area: string; label: string }> }>;
}

@Injectable()
export class OAuthAuthorizationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OAuthClientService) private readonly clients: OAuthClientService,
    @Inject(StoreEligibilityService) private readonly eligibility: StoreEligibilityService,
    @Inject(AccessAuditService) private readonly audit: AccessAuditService
  ) {}

  /**
   * Validates an authorization request. Client and redirect URI are checked first and raise
   * UntrustedAuthorizationRequest (never redirected); the rest raise RedirectableAuthorizationError.
   */
  async start(query: AuthorizeQuery, urls: McpOAuthUrls, now = new Date()): Promise<string> {
    const client = await this.resolveClient(query.client_id);
    const redirectUri = query.redirect_uri;
    if (!redirectUri || !matchesRegisteredRedirect(redirectUri, client.redirectUris)) {
      await this.auditRejectedClient(client.clientId, "INVALID_REDIRECT_URI");
      throw new UntrustedAuthorizationRequest(
        "INVALID_REDIRECT_URI",
        "O endereco de retorno informado nao foi declarado pelo aplicativo."
      );
    }

    if (query.response_type !== "code") {
      throw new RedirectableAuthorizationError("unsupported_response_type", "Use response_type=code.");
    }
    if (query.code_challenge_method !== "S256" || !isValidCodeChallenge(query.code_challenge)) {
      throw new RedirectableAuthorizationError("invalid_request", "PKCE S256 obrigatorio.");
    }
    const scopes = (query.scope ?? MCP_OAUTH_SCOPE).split(/\s+/).filter(Boolean);
    if (!scopes.every((scope) => TOLERATED_SCOPES.has(scope))) {
      throw new RedirectableAuthorizationError("invalid_scope", `Escopo suportado: ${MCP_OAUTH_SCOPE}.`);
    }
    if (!matchesResource(query.resource, urls.resource)) {
      throw new RedirectableAuthorizationError("invalid_target", "Recurso desconhecido para este servidor.");
    }

    const request = await this.prisma.mcpOAuthAuthorizationRequest.create({
      data: {
        clientId: client.id,
        redirectUri,
        state: query.state?.slice(0, 512) ?? null,
        codeChallenge: query.code_challenge,
        scope: MCP_OAUTH_SCOPE,
        resource: urls.resource,
        expiresAt: new Date(now.getTime() + AUTHORIZATION_REQUEST_TTL_SECONDS * 1000),
      },
    });
    return `${urls.consentPage}?pedido=${request.id}`;
  }

  async view(user: AuthUser, requestId: string, now = new Date()): Promise<AuthorizationRequestView> {
    const request = await this.loadPending(requestId, now);
    const base = {
      id: request.id,
      client: {
        name: request.client.name,
        redirectHost: redirectHost(request.redirectUri),
        kind: request.client.kind,
        loopbackOnly: onlyLoopbackRedirects(request.client.redirectUris),
      },
      scopeDescription: "Somente leitura dos numeros da loja",
      expiresAt: request.expiresAt.toISOString(),
    };

    if (user.isPlatformAdmin) {
      return { ...base, canAuthorize: false, blockedReason: "PLATFORM_ADMIN", stores: [] };
    }
    const { reachable, authorizable } = await this.eligibility.forUser(user.id);
    const blockedReason: BlockedReason | null =
      reachable.length === 0 ? "NO_ELIGIBLE_STORE" : authorizable.length === 0 ? "MISSING_PERMISSION" : null;

    return {
      ...base,
      canAuthorize: blockedReason === null,
      blockedReason,
      stores: authorizable.map((store) => ({
        id: store.id,
        name: store.name,
        areas: store.areas.map((area) => ({ area, label: areaLabel(area) })),
      })),
    };
  }

  async approve(
    user: AuthUser,
    requestId: string,
    storeId: string,
    urls: McpOAuthUrls,
    now = new Date()
  ): Promise<{ redirectUrl: string }> {
    if (user.isPlatformAdmin) throw new ForbiddenException("Administradores de plataforma nao autorizam conectores.");
    const request = await this.loadPending(requestId, now);
    const { authorizable } = await this.eligibility.forUser(user.id);
    if (!authorizable.some((store) => store.id === storeId)) {
      throw new ForbiddenException("Voce nao pode conectar assistentes a esta loja.");
    }

    const code = generateOpaque(AUTHORIZATION_CODE_PREFIX);
    await this.prisma.$transaction(async (tx) => {
      const active = await tx.mcpOAuthConnection.count({ where: { tenantId: storeId, revokedAt: null } });
      if (active >= MAX_ACTIVE_CONNECTIONS_PER_STORE) {
        throw new ConflictException({
          code: "CONNECTION_LIMIT_REACHED",
          message: `A loja ja possui ${MAX_ACTIVE_CONNECTIONS_PER_STORE} conexoes ativas. Revogue conexoes sem uso em Configuracoes > MCP / IA.`,
        });
      }
      const connection = await tx.mcpOAuthConnection.create({
        data: {
          tenantId: storeId,
          userId: user.id,
          clientId: request.clientId,
          scope: request.scope,
          resource: request.resource,
        },
      });
      await tx.mcpOAuthAuthorizationRequest.update({
        where: { id: request.id },
        data: {
          status: McpOAuthRequestStatus.APPROVED,
          userId: user.id,
          tenantId: storeId,
          connectionId: connection.id,
          codeHash: hashSecret(code),
          codeExpiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_SECONDS * 1000),
        },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          storeId,
          eventType: AccessAuditEventType.MCP_CONNECTION_AUTHORIZED,
          result: AccessAuditResult.SUCCESS,
          metadata: { mcpConnectionId: connection.id, client: request.client.name },
        },
        tx
      );
    });

    return {
      redirectUrl: buildRedirect(request.redirectUri, { code, state: request.state, iss: urls.issuer }),
    };
  }

  async deny(user: AuthUser, requestId: string, urls: McpOAuthUrls, now = new Date()) {
    const request = await this.loadPending(requestId, now);
    await this.prisma.mcpOAuthAuthorizationRequest.update({
      where: { id: request.id },
      data: { status: McpOAuthRequestStatus.DENIED, userId: user.id },
    });
    await this.audit.record({
      actorUserId: user.id,
      eventType: AccessAuditEventType.MCP_CONNECTION_DENIED,
      result: AccessAuditResult.DENIED,
      metadata: { client: request.client.name },
    });
    return {
      redirectUrl: buildRedirect(request.redirectUri, {
        error: "access_denied",
        error_description: "O usuario cancelou a autorizacao.",
        state: request.state,
        iss: urls.issuer,
      }),
    };
  }

  private async resolveClient(clientId: string | undefined): Promise<McpOAuthClient> {
    try {
      return await this.clients.resolve(clientId);
    } catch (error) {
      if (error instanceof UntrustedAuthorizationRequest) {
        await this.auditRejectedClient(clientId ?? null, error.reason);
      }
      throw error;
    }
  }

  private async loadPending(requestId: string, now: Date) {
    const request = await this.prisma.mcpOAuthAuthorizationRequest.findUnique({
      where: { id: requestId },
      include: { client: true },
    });
    if (!request) throw new NotFoundException("Pedido de autorizacao nao encontrado.");
    if (request.status !== McpOAuthRequestStatus.PENDING || request.expiresAt.getTime() <= now.getTime()) {
      throw new GoneException("Este pedido de autorizacao expirou. Volte ao assistente e conecte novamente.");
    }
    return request;
  }

  private auditRejectedClient(clientId: string | null, reason: string) {
    return this.audit.record({
      eventType: AccessAuditEventType.MCP_CLIENT_REJECTED,
      result: AccessAuditResult.DENIED,
      reason,
      metadata: { client: clientId?.slice(0, 200) ?? null },
    });
  }
}
