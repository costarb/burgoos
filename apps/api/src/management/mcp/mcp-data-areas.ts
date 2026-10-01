import { McpDataArea } from "@prisma/client";

export interface McpDataAreaDefinition {
  area: McpDataArea;
  label: string;
  description: string;
  tools: readonly string[];
}

export const MCP_DATA_AREAS: readonly McpDataAreaDefinition[] = [
  {
    area: McpDataArea.SALES,
    label: "Vendas",
    description: "Faturamento, pedidos, ticket medio e quebras por dia, plataforma e pagamento.",
    tools: ["resumo_vendas", "resumo_diario", "relatorio_gerencial"],
  },
  {
    area: McpDataArea.FINANCIAL,
    label: "Financeiro/DRE",
    description: "DRE do periodo e indicadores do dashboard financeiro.",
    tools: ["dre", "dashboard_financeiro"],
  },
  {
    area: McpDataArea.MENU,
    label: "Cardapio e Margem",
    description: "Engenharia de cardapio: produtos por popularidade e margem.",
    tools: ["engenharia_cardapio"],
  },
  {
    area: McpDataArea.CASH,
    label: "Caixa",
    description: "Saldo por conta, projecao e extrato consolidado.",
    tools: ["posicao_caixa", "extrato_caixa"],
  },
  {
    area: McpDataArea.PAYABLES,
    label: "Contas a pagar",
    description: "Contas vencidas, a vencer e pagas, com totais por categoria e a lista de contas.",
    tools: ["contas_a_pagar"],
  },
  {
    area: McpDataArea.INVENTORY,
    label: "Estoque",
    description: "Saldo estimado de ingredientes e itens abaixo do minimo.",
    tools: ["estoque"],
  },
];

export const ALL_MCP_DATA_AREAS: readonly McpDataArea[] = MCP_DATA_AREAS.map(
  (definition) => definition.area
);

const AREA_BY_TOOL = new Map<string, McpDataArea>(
  MCP_DATA_AREAS.flatMap((definition) =>
    definition.tools.map((tool) => [tool, definition.area] as const)
  )
);

export function toolsForAreas(areas: readonly McpDataArea[]): string[] {
  const enabled = new Set(areas);
  return MCP_DATA_AREAS.filter((definition) => enabled.has(definition.area)).flatMap(
    (definition) => [...definition.tools]
  );
}

export function areaOfTool(tool: string): McpDataArea | undefined {
  return AREA_BY_TOOL.get(tool);
}

export function areaLabel(area: McpDataArea): string {
  return MCP_DATA_AREAS.find((definition) => definition.area === area)?.label ?? area;
}

export function normalizeAreas(areas: readonly McpDataArea[]): McpDataArea[] {
  const requested = new Set(areas);
  return ALL_MCP_DATA_AREAS.filter((area) => requested.has(area));
}
