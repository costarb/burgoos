import { ExecutionContext, HttpException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { McpToolCallResult } from "@prisma/client";
import type { Request } from "express";
import { FixedWindowRateLimitGuard } from "../../../common/rate-limit/fixed-window-rate-limit.guard";
import { McpCallLogService } from "./mcp-call-log.service";
import { McpRequest } from "./mcp-context";
import { rpcMethod, rpcTarget } from "./mcp-token.guard";

/** Per-token request budget; runs after McpTokenGuard has resolved the token. */
@Injectable()
export class McpRateLimitGuard extends FixedWindowRateLimitGuard {
  protected readonly limit: number;
  protected readonly namespace = "mcp";

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(McpCallLogService) private readonly callLog: McpCallLogService
  ) {
    super();
    this.limit = config.get<number>("MCP_RATE_LIMIT_PER_MINUTE") ?? 60;
  }

  canActivate(context: ExecutionContext): boolean {
    try {
      return super.canActivate(context);
    } catch (error) {
      const request = context.switchToHttp().getRequest<McpRequest>();
      if (error instanceof HttpException && request.mcpContext) {
        void this.callLog.record({
          tenantId: request.mcpContext.tenantId,
          tokenId: request.mcpContext.tokenId,
          method: rpcMethod(request.body),
          target: rpcTarget(request.body),
          result: McpToolCallResult.DENIED,
          errorCode: "RATE_LIMITED",
          durationMs: 0,
        });
      }
      throw error;
    }
  }

  protected bucketKey(request: Request): string {
    return (request as McpRequest).mcpContext?.tokenId ?? super.bucketKey(request);
  }
}
