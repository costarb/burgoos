import { Inject, Injectable, Logger } from "@nestjs/common";
import { McpToolCallResult, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";

const MAX_ARGUMENT_BYTES = 1024;
const LAST_USED_THROTTLE_MS = 60_000;

export interface McpCallRecord {
  tenantId: string;
  tokenId: string | null;
  connectionId?: string | null;
  method: string;
  target?: string | null;
  arguments?: unknown;
  result: McpToolCallResult;
  errorCode?: string | null;
  durationMs: number;
  isAction?: boolean;
}

@Injectable()
export class McpCallLogService {
  private readonly logger = new Logger(McpCallLogService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Persists a call without delaying or failing the MCP response. */
  record(call: McpCallRecord): Promise<void> {
    return this.prisma.mcpToolCall
      .create({
        data: {
          tenantId: call.tenantId,
          tokenId: call.tokenId,
          connectionId: call.connectionId ?? null,
          method: call.method.slice(0, 40),
          target: call.target ? call.target.slice(0, 80) : null,
          arguments: sanitizeArguments(call.arguments),
          result: call.result,
          errorCode: call.errorCode ?? null,
          durationMs: Math.max(0, Math.round(call.durationMs)),
          isAction: call.isAction ?? false,
        },
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.warn(
          `mcp.call_log_failed tenantId=${call.tenantId} method=${call.method} ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
  }

  /** Successful write tools of a connection since the given instant (action rate limit). */
  countActions(connectionId: string, since: Date): Promise<number> {
    return this.prisma.mcpToolCall.count({
      where: {
        connectionId,
        isAction: true,
        result: McpToolCallResult.SUCCESS,
        occurredAt: { gte: since },
      },
    });
  }

  /** Updates the OAuth connection's `lastUsedAt` at most once per minute. */
  touchConnection(connectionId: string, now = new Date()): Promise<void> {
    return this.prisma.mcpOAuthConnection
      .updateMany({
        where: {
          id: connectionId,
          OR: [
            { lastUsedAt: null },
            { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_THROTTLE_MS) } },
          ],
        },
        data: { lastUsedAt: now },
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.warn(
          `mcp.touch_connection_failed connectionId=${connectionId} ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }

  /** Updates `lastUsedAt` at most once per minute per token. */
  touchToken(tokenId: string, now = new Date()): Promise<void> {
    return this.prisma.storeMcpToken
      .updateMany({
        where: {
          id: tokenId,
          OR: [
            { lastUsedAt: null },
            { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_THROTTLE_MS) } },
          ],
        },
        data: { lastUsedAt: now },
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.warn(
          `mcp.touch_token_failed tokenId=${tokenId} ${error instanceof Error ? error.message : String(error)}`
        );
      });
  }
}

export function sanitizeArguments(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) return Prisma.DbNull;
  if (typeof value !== "object" || Array.isArray(value)) return Prisma.DbNull;
  const serialized = JSON.stringify(value);
  if (serialized === "{}") return Prisma.DbNull;
  if (Buffer.byteLength(serialized, "utf8") <= MAX_ARGUMENT_BYTES) {
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  }
  return { truncado: true, previa: serialized.slice(0, MAX_ARGUMENT_BYTES - 64) };
}
