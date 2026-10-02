import { McpDataArea } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ALL_MCP_DATA_AREAS,
  areaOfTool,
  MCP_DATA_AREAS,
  normalizeAreas,
  toolsForAreas,
} from "./mcp-data-areas";

describe("MCP data areas", () => {
  it("covers every area of the enum exactly once", () => {
    expect([...ALL_MCP_DATA_AREAS].sort()).toEqual(Object.values(McpDataArea).sort());
  });

  it("maps each tool to a single area", () => {
    const tools = MCP_DATA_AREAS.flatMap((definition) => definition.tools);
    expect(new Set(tools).size).toBe(tools.length);
    expect(tools).toHaveLength(10);
    expect(areaOfTool("dre")).toBe(McpDataArea.FINANCIAL);
    expect(areaOfTool("estoque")).toBe(McpDataArea.INVENTORY);
    expect(areaOfTool("desconhecida")).toBeUndefined();
  });

  it("returns only tools of the enabled areas", () => {
    expect(toolsForAreas([McpDataArea.SALES])).toEqual([
      "resumo_vendas",
      "resumo_diario",
      "relatorio_gerencial",
    ]);
    expect(toolsForAreas([])).toEqual([]);
  });

  it("normalizes areas to catalog order without duplicates", () => {
    expect(
      normalizeAreas([McpDataArea.INVENTORY, McpDataArea.SALES, McpDataArea.SALES])
    ).toEqual([McpDataArea.SALES, McpDataArea.INVENTORY]);
  });
});
