import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { McpToolCallResult } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../../../platform/database/prisma.service";
import { normalizeAreas } from "../mcp-data-areas";
import { hashMcpToken, isWellFormedMcpToken, mcpTokenStatus } from "../admin/mcp-token.util";
import { isOAuthAccessToken, OAuthCredentialResolver } from "../oauth/oauth-credential.resolver";
import { MCP_OAUTH_SCOPE, McpOAuthUrls, resolveMcpOAuthUrls } from "../oauth/oauth-urls";
import { McpCallLogService } from "./mcp-call-log.service";
import { McpDeniedReason, McpRequest, McpRequestContext } from "./mcp-context";

export const MCP_UNAUTHORIZED_BODY = {
  error: "unauthorized",
  message: "Token MCP invalido ou sem acesso.",
} as const;

interface DeniedCall {
  tenantId: string;
  tokenId?: string | null;
  connectionId?: string | null;
  reason: McpDeniedReason;
  label: string;
}

/**
 * Resolves the store from the bearer credential: a phase-1 store token (`rrf_mcp_`) or an OAuth
 * access token (`rrf_oat_`). Every refusal answers the same 401, pointing OAuth clients to the
 * protected resource metadata; refusals of known credentials are kept in the usage log.
 */
@Injectable()
export class McpTokenGuard implements CanActivate {
  private readonly logger = new Logger(McpTokenGuard.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(McpCallLogService) private readonly callLog: McpCallLogService,
    @Inject(OAuthCredentialResolver) private readonly oauth: OAuthCredentialResolver,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const urls = resolveMcpOAuthUrls(
      {
        mcpPublicUrl: this.config.get<string>("MCP_PUBLIC_URL"),
        webPublicUrl: this.config.get<string>("WEB_PUBLIC_URL"),
        webOrigin: this.config.get<string>("WEB_ORIGIN"),
      },
      request
    );
    const credential = bearerToken(request.headers.authorization);

    let mcpContext: McpRequestContext | null = null;
    if (credential && isWellFormedMcpToken(credential)) {
      mcpContext = await this.resolveStoreToken(credential, request);
    } else if (credential && isOAuthAccessToken(credential)) {
      const result = await this.oauth.resolve(credential, urls.resource);
      if (result.status === "ok") mcpContext = result.context;
      else if (result.status === "denied") {
        this.recordDenied(request, {
          tenantId: result.tenantId,
          connectionId: result.connectionId,
          reason: result.reason,
          label: `connectionId=${result.connectionId}`,
        });
      }
    }

    if (!mcpContext) return this.reject(response, urls);

    request.mcpContext = mcpContext;
    if (mcpContext.tokenId) void this.callLog.touchToken(mcpContext.tokenId);
    if (mcpContext.connectionId) void this.callLog.touchConnection(mcpContext.connectionId);
    return true;
  }

  private async resolveStoreToken(token: string, request: McpRequest): Promise<McpRequestContext | null> {
    const record = await this.prisma.storeMcpToken.findUnique({
      where: { tokenHash: hashMcpToken(token) },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            active: true,
            deactivatedAt: true,
            mcpConfiguration: { select: { enabled: true, enabledAreas: true } },
          },
        },
      },
    });
    if (!record || !record.tenant) return null;

    const reason = deniedReason(record);
    if (reason) {
      this.recordDenied(request, {
        tenantId: record.tenantId,
        tokenId: record.id,
        reason,
        label: `tokenPrefix=${record.tokenPrefix}`,
      });
      return null;
    }

    return {
      tenantId: record.tenantId,
      tokenId: record.id,
      connectionId: null,
      enabledAreas: normalizeAreas(record.tenant.mcpConfiguration?.enabledAreas ?? []),
      storeName: record.tenant.name,
      storeSlug: record.tenant.slug,
    };
  }

  private recordDenied(request: McpRequest, denied: DeniedCall): void {
    void this.callLog.record({
      tenantId: denied.tenantId,
      tokenId: denied.tokenId ?? null,
      connectionId: denied.connectionId ?? null,
      method: rpcMethod(request.body),
      target: rpcTarget(request.body),
      result: McpToolCallResult.DENIED,
      errorCode: denied.reason,
      durationMs: 0,
    });
    this.logger.warn(`mcp.denied tenantId=${denied.tenantId} ${denied.label} reason=${denied.reason}`);
  }

  private reject(response: Response, urls: McpOAuthUrls): never {
    response.setHeader(
      "WWW-Authenticate",
      `Bearer realm="rrfive-mcp", resource_metadata="${urls.protectedResourceMetadata}", scope="${MCP_OAUTH_SCOPE}"`
    );
    throw new UnauthorizedException(MCP_UNAUTHORIZED_BODY);
  }
}

function deniedReason(record: {
  revokedAt: Date | null;
  expiresAt: Date | null;
  tenant: {
    active: boolean;
    deactivatedAt: Date | null;
    mcpConfiguration: { enabled: boolean } | null;
  };
}): McpDeniedReason | null {
  const status = mcpTokenStatus(record);
  if (status === "REVOKED") return "TOKEN_REVOKED";
  if (status === "EXPIRED") return "TOKEN_EXPIRED";
  if (!record.tenant.active || record.tenant.deactivatedAt) return "STORE_INACTIVE";
  if (!record.tenant.mcpConfiguration?.enabled) return "MCP_DISABLED";
  return null;
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [type, value] = header.trim().split(/\s+/);
  return type?.toLowerCase() === "bearer" && value ? value : null;
}

export function rpcMethod(body: unknown): string {
  const message = Array.isArray(body) ? body[0] : body;
  const method = (message as { method?: unknown } | undefined)?.method;
  return typeof method === "string" ? method : "unknown";
}

export function rpcTarget(body: unknown): string | null {
  const message = Array.isArray(body) ? body[0] : body;
  const params = (message as { params?: { name?: unknown; uri?: unknown } } | undefined)?.params;
  const target = params?.name ?? params?.uri;
  return typeof target === "string" ? target : null;
}
