import { Controller, Delete, Get, Inject, Logger, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpToolCallResult } from "@prisma/client";
import type { Response } from "express";
import { areaLabel } from "../mcp-data-areas";
import { McpCallLogService } from "./mcp-call-log.service";
import { McpRequest, McpRequestContext } from "./mcp-context";
import { McpRateLimitGuard } from "./mcp-rate-limit.guard";
import { McpServerFactory, McpToolCatalog } from "./mcp-server.factory";
import { McpTokenGuard } from "./mcp-token.guard";

/**
 * Streamable HTTP endpoint of the store MCP server, in stateless JSON mode: every POST builds a
 * server for the store resolved from the token, answers the JSON-RPC message and is discarded.
 */
@ApiExcludeController()
@Controller("mcp")
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    @Inject(McpServerFactory) private readonly factory: McpServerFactory,
    @Inject(McpToolCatalog) private readonly catalog: McpToolCatalog,
    @Inject(McpCallLogService) private readonly callLog: McpCallLogService
  ) {}

  @Post()
  @UseGuards(McpTokenGuard, McpRateLimitGuard)
  async handle(@Req() request: McpRequest, @Res() response: Response): Promise<void> {
    const context = request.mcpContext as McpRequestContext;

    const blocked = this.disabledToolResponse(context, request.body);
    if (blocked) {
      response.status(200).json(blocked);
      return;
    }

    const server = this.factory.build(context);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      this.logger.error(
        `mcp.transport_failed tenantId=${context.tenantId}`,
        error instanceof Error ? error.stack : String(error)
      );
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Erro interno do servidor MCP." },
          id: null,
        });
      }
    }
  }

  @Get()
  rejectGet(@Res() response: Response): void {
    methodNotAllowed(response);
  }

  @Delete()
  rejectDelete(@Res() response: Response): void {
    methodNotAllowed(response);
  }

  /**
   * Tools of disabled areas are not registered; a direct call to one of them gets an explicit,
   * logged refusal instead of a generic "tool not found".
   */
  private disabledToolResponse(context: McpRequestContext, body: unknown) {
    const message = body as { jsonrpc?: string; id?: unknown; method?: unknown; params?: { name?: unknown } };
    if (!message || Array.isArray(body) || message.method !== "tools/call") return null;
    const name = typeof message.params?.name === "string" ? message.params.name : null;
    const tool = name ? this.catalog.find(name) : undefined;
    if (!tool || context.enabledAreas.includes(tool.area)) return null;

    void this.callLog.record({
      tenantId: context.tenantId,
      tokenId: context.tokenId,
      method: "tools/call",
      target: tool.name,
      result: McpToolCallResult.ERROR,
      errorCode: "AREA_DISABLED",
      durationMs: 0,
    });
    return {
      jsonrpc: "2.0",
      id: message.id ?? null,
      result: {
        isError: true,
        content: [
          {
            type: "text",
            text: `A area de dados ${areaLabel(tool.area)} nao esta liberada para esta loja.`,
          },
        ],
      },
    };
  }
}

function methodNotAllowed(response: Response): void {
  response
    .status(405)
    .setHeader("Allow", "POST")
    .json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Metodo nao permitido. Use POST (modo stateless)." },
      id: null,
    });
}
