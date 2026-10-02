import { Inject, Injectable, Logger } from "@nestjs/common";
import { McpOAuthRequestStatus, McpOAuthTokenKind } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { OAuthConnectionService } from "./oauth-connection.service";
import { OAuthError } from "./oauth-errors";
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  generateOpaque,
  hashSecret,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_SECONDS,
  verifyPkceS256,
} from "./oauth-tokens.util";
import { matchesResource, McpOAuthUrls } from "./oauth-urls";

export type TokenRequest = Record<string, string | undefined>;

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

@Injectable()
export class OAuthTokenService {
  private readonly logger = new Logger(OAuthTokenService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OAuthConnectionService) private readonly connections: OAuthConnectionService
  ) {}

  async exchange(body: TokenRequest, urls: McpOAuthUrls, now = new Date()): Promise<TokenResponse> {
    switch (body.grant_type) {
      case "authorization_code":
        return this.exchangeCode(body, urls, now);
      case "refresh_token":
        return this.refresh(body, urls, now);
      case undefined:
      case "":
        throw new OAuthError("invalid_request", "grant_type obrigatorio.");
      default:
        throw new OAuthError("unsupported_grant_type", "Use authorization_code ou refresh_token.");
    }
  }

  /** RFC 7009: always succeeds; a known token revokes its whole connection. */
  async revoke(body: TokenRequest): Promise<void> {
    if (!body.token) return;
    const token = await this.prisma.mcpOAuthToken.findUnique({
      where: { tokenHash: hashSecret(body.token) },
      include: { connection: { include: { client: { select: { clientId: true } } } } },
    });
    if (!token || (body.client_id && token.connection.client.clientId !== body.client_id)) return;
    await this.connections.revoke(token.connectionId, "CLIENT_REVOKED");
  }

  private async exchangeCode(body: TokenRequest, urls: McpOAuthUrls, now: Date): Promise<TokenResponse> {
    const { code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId } = body;
    if (!code || !verifier || !redirectUri || !clientId) {
      throw new OAuthError("invalid_request", "code, code_verifier, redirect_uri e client_id sao obrigatorios.");
    }
    if (!matchesResource(body.resource, urls.resource)) {
      throw new OAuthError("invalid_target", "Recurso desconhecido para este servidor.");
    }

    const request = await this.prisma.mcpOAuthAuthorizationRequest.findUnique({
      where: { codeHash: hashSecret(code) },
      include: { client: true, connection: true },
    });
    if (!request || request.client.clientId !== clientId) {
      throw new OAuthError("invalid_grant", "Codigo de autorizacao invalido.");
    }
    if (request.status === McpOAuthRequestStatus.CONSUMED) {
      if (request.connectionId) await this.connections.revoke(request.connectionId, "CODE_REUSE");
      this.logger.warn(`mcp.oauth.code_reuse connectionId=${request.connectionId}`);
      throw new OAuthError("invalid_grant", "Codigo de autorizacao ja utilizado.");
    }
    if (
      request.status !== McpOAuthRequestStatus.APPROVED ||
      !request.codeExpiresAt ||
      request.codeExpiresAt.getTime() <= now.getTime() ||
      !request.connection ||
      request.connection.revokedAt
    ) {
      throw new OAuthError("invalid_grant", "Codigo de autorizacao expirado.");
    }
    if (request.redirectUri !== redirectUri) {
      throw new OAuthError("invalid_grant", "redirect_uri diferente do usado na autorizacao.");
    }
    if (!verifyPkceS256(verifier, request.codeChallenge)) {
      throw new OAuthError("invalid_grant", "code_verifier invalido.");
    }

    const consumed = await this.prisma.mcpOAuthAuthorizationRequest.updateMany({
      where: { id: request.id, status: McpOAuthRequestStatus.APPROVED },
      data: { status: McpOAuthRequestStatus.CONSUMED },
    });
    if (consumed.count === 0) throw new OAuthError("invalid_grant", "Codigo de autorizacao ja utilizado.");

    return this.issue(request.connection.id, request.connection.scope, now);
  }

  private async refresh(body: TokenRequest, urls: McpOAuthUrls, now: Date): Promise<TokenResponse> {
    const { refresh_token: refreshToken, client_id: clientId } = body;
    if (!refreshToken || !clientId) {
      throw new OAuthError("invalid_request", "refresh_token e client_id sao obrigatorios.");
    }
    if (!matchesResource(body.resource, urls.resource)) {
      throw new OAuthError("invalid_target", "Recurso desconhecido para este servidor.");
    }

    const token = await this.prisma.mcpOAuthToken.findUnique({
      where: { tokenHash: hashSecret(refreshToken) },
      include: { connection: { include: { client: { select: { clientId: true } } } } },
    });
    if (!token || token.kind !== McpOAuthTokenKind.REFRESH || token.connection.client.clientId !== clientId) {
      throw new OAuthError("invalid_grant", "Token de renovacao invalido.");
    }
    if (token.rotatedAt) {
      if (!token.connection.revokedAt) {
        await this.connections.revoke(token.connectionId, "REFRESH_REUSE");
        this.logger.warn(`mcp.oauth.refresh_reuse connectionId=${token.connectionId}`);
      }
      throw new OAuthError("invalid_grant", "Token de renovacao ja utilizado.");
    }
    if (token.connection.revokedAt || token.expiresAt.getTime() <= now.getTime()) {
      throw new OAuthError("invalid_grant", "Token de renovacao expirado ou revogado.");
    }

    const rotated = await this.prisma.mcpOAuthToken.updateMany({
      where: { id: token.id, rotatedAt: null },
      data: { rotatedAt: now },
    });
    if (rotated.count === 0) throw new OAuthError("invalid_grant", "Token de renovacao ja utilizado.");

    return this.issue(token.connectionId, token.connection.scope, now);
  }

  private async issue(connectionId: string, scope: string, now: Date): Promise<TokenResponse> {
    const accessToken = generateOpaque(ACCESS_TOKEN_PREFIX);
    const refreshToken = generateOpaque(REFRESH_TOKEN_PREFIX);
    await this.prisma.$transaction([
      this.prisma.mcpOAuthToken.create({
        data: {
          connectionId,
          kind: McpOAuthTokenKind.ACCESS,
          tokenHash: hashSecret(accessToken),
          expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
        },
      }),
      this.prisma.mcpOAuthToken.create({
        data: {
          connectionId,
          kind: McpOAuthTokenKind.REFRESH,
          tokenHash: hashSecret(refreshToken),
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        },
      }),
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope,
    };
  }
}
