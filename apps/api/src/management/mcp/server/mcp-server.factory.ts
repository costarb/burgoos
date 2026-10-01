import { Inject, Injectable } from "@nestjs/common";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { areaLabel } from "../mcp-data-areas";
import { ANALYSIS_PROMPTS, McpPromptDefinition } from "../prompts/analysis.prompts";
import { McpResources } from "../resources/mcp-resources";
import { CashTools } from "../tools/cash.tools";
import { FinancialTools } from "../tools/financial.tools";
import { InventoryTools } from "../tools/inventory.tools";
import { MenuTools } from "../tools/menu.tools";
import { PayablesTools } from "../tools/payables.tools";
import { SalesTools } from "../tools/sales.tools";
import { McpToolDefinition, ToolOutput } from "../tools/tool-output";
import { McpRequestContext } from "./mcp-context";
import { McpToolRunner } from "./mcp-tool-runner";

const SERVER_VERSION = "0.1.0";

/** Collects every tool definition, regardless of the store's enabled areas. */
@Injectable()
export class McpToolCatalog {
  constructor(
    @Inject(SalesTools) private readonly sales: SalesTools,
    @Inject(FinancialTools) private readonly financial: FinancialTools,
    @Inject(MenuTools) private readonly menu: MenuTools,
    @Inject(CashTools) private readonly cash: CashTools,
    @Inject(PayablesTools) private readonly payables: PayablesTools,
    @Inject(InventoryTools) private readonly inventory: InventoryTools
  ) {}

  all(): McpToolDefinition[] {
    return [
      ...this.sales.definitions(),
      ...this.financial.definitions(),
      ...this.menu.definitions(),
      ...this.cash.definitions(),
      ...this.payables.definitions(),
      ...this.inventory.definitions(),
    ];
  }

  find(name: string): McpToolDefinition | undefined {
    return this.all().find((definition) => definition.name === name);
  }
}

/**
 * Builds a fresh, stateless MCP server per request exposing only what the store's enabled data
 * areas allow; tools of disabled areas are never registered, so they are neither listed nor
 * callable.
 */
@Injectable()
export class McpServerFactory {
  constructor(
    @Inject(McpToolCatalog) private readonly catalog: McpToolCatalog,
    @Inject(McpResources) private readonly resources: McpResources,
    @Inject(McpToolRunner) private readonly runner: McpToolRunner
  ) {}

  build(context: McpRequestContext): McpServer {
    const enabled = new Set(context.enabledAreas);
    const server = new McpServer(
      { name: "rrfive-os", version: SERVER_VERSION },
      { instructions: instructions(context) }
    );

    for (const tool of this.catalog.all().filter((definition) => enabled.has(definition.area))) {
      this.registerTool(server, context, tool);
    }
    for (const resource of this.resources.definitions()) {
      server.registerResource(
        resource.name,
        resource.uri,
        { title: resource.title, description: resource.description, mimeType: resource.mimeType },
        async (uri) => {
          const outcome = await this.runner.run(
            context,
            { method: "resources/read", target: resource.name },
            () => resource.read(context)
          );
          if (!outcome.ok) throw new Error(outcome.message);
          return {
            contents: [{ uri: uri.href, mimeType: resource.mimeType, text: outcome.value }],
          };
        }
      );
    }
    // The SDK's generic prompt signature is too deep for the compiler with a dynamic args shape.
    const registerPrompt = server.registerPrompt.bind(server) as unknown as (
      name: string,
      config: { title: string; description: string; argsSchema: McpPromptDefinition["argsSchema"] },
      callback: (args: Record<string, string | undefined>) => Promise<GetPromptResult>
    ) => void;
    for (const prompt of ANALYSIS_PROMPTS.filter((item) =>
      item.areas.every((area) => enabled.has(area))
    )) {
      registerPrompt(
        prompt.name,
        { title: prompt.title, description: prompt.description, argsSchema: prompt.argsSchema },
        async (args) => ({
          description: prompt.description,
          messages: [{ role: "user", content: { type: "text", text: prompt.build(args ?? {}) } }],
        })
      );
    }

    return server;
  }

  private registerTool(server: McpServer, context: McpRequestContext, tool: McpToolDefinition) {
    // Same as prompts: the generic tool signature is too deep for a dynamic input shape.
    const registerTool = server.registerTool.bind(server) as unknown as (
      name: string,
      config: {
        title: string;
        description: string;
        inputSchema: McpToolDefinition["inputSchema"];
        annotations: Record<string, boolean>;
      },
      callback: (args: Record<string, unknown>) => Promise<CallToolResult>
    ) => void;

    registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
      },
      async (args) => {
        const outcome = await this.runner.run(
          context,
          { method: "tools/call", target: tool.name, args },
          () => tool.handler(context, args ?? {})
        );
        return outcome.ok ? toolResult(outcome.value) : toolError(outcome.message);
      }
    );
  }
}

export function toolResult(value: ToolOutput): CallToolResult {
  return {
    structuredContent: value,
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

export function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function instructions(context: McpRequestContext): string {
  const areas = context.enabledAreas.map((area) => areaLabel(area)).join(", ");
  return [
    `Servidor MCP somente leitura do RRFive OS para a loja "${context.storeName}".`,
    `Areas de dados liberadas: ${areas}.`,
    "Datas no formato AAAA-MM-DD, fuso America/Sao_Paulo; no maximo 92 dias por consulta.",
    "Valores em reais (campos terminados em Reais). Consulte o recurso glossario_metricas para as definicoes.",
    "Use apenas os numeros retornados pelas ferramentas.",
  ].join(" ");
}
