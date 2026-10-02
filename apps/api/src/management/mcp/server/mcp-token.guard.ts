import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { McpToolCallResult } from "@prisma/client";
import type { Response } from "express";
import { PrismaService } from "../../../platform/database/prisma.service";
import { normalizeAreas } from "../mcp-data-areas";
import { hashMcpToken, isWellFormedMcpToken, mcpTokenStatus } from "../admin/mcp-token.util";
import { McpCallLogService } from "./mcp-call-log.service";
import { McpDeniedReason, McpRequest } from "./mcp-context";

export const MCP_UNAUTHORIZED_BODY = {
  error: "unauthorized",
  message: "Token MCP invalido ou sem acesso.",
} as const;

/**
 * Resolves the store from the bearer token. Every refusal answers the same 401 so callers cannot
 * learn whether a token or store exists; refusals of known tokens are kept in the usage log.
 */
@Injectable()
export class McpTokenGuard implements CanActivate {
  private readonly logger = new Logger(McpTokenGuard.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(McpCallLogService) private readonly callLog: McpCallLogService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<McpRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const token = bearerToken(request.headers.authorization);

    if (!token || !isWellFormedMcpToken(token)) return this.reject(response);

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

    if (!record || !record.tenant) return this.reject(response);

    const reason = deniedReason(record);
    if (reason) {
      void this.callLog.record({
        tenantId: record.tenantId,
        tokenId: record.id,
        method: rpcMethod(request.body),
        target: rpcTarget(request.body),
        result: McpToolCallResult.DENIED,
        errorCode: reason,
        durationMs: 0,
      });
      this.logger.warn(
        `mcp.denied tenantId=${record.tenantId} tokenPrefix=${record.tokenPrefix} reason=${reason}`
      );
      return this.reject(response);
    }

    request.mcpContext = {
      tenantId: record.tenantId,
      tokenId: record.id,
      enabledAreas: normalizeAreas(record.tenant.mcpConfiguration?.enabledAreas ?? []),
      storeName: record.tenant.name,
      storeSlug: record.tenant.slug,
    };
    void this.callLog.touchToken(record.id);
    return true;
  }

  private reject(response: Response): never {
    response.setHeader("WWW-Authenticate", 'Bearer realm="rrfive-mcp"');
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
