import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { CreateMcpTokenDto, McpUsageQueryDto, UpdateMcpConfigurationDto } from "./store-mcp.dto";

function errors<T extends object>(type: new () => T, payload: unknown): string[] {
  const instance = plainToInstance(type, payload);
  return validateSync(instance, { whitelist: true, forbidNonWhitelisted: true }).map(
    (error) => error.property
  );
}

describe("store MCP DTOs", () => {
  it("validates token name and expiration options", () => {
    expect(errors(CreateMcpTokenDto, { name: "Notebook", expiresInDays: 30 })).toEqual([]);
    expect(errors(CreateMcpTokenDto, { name: "Sem validade", expiresInDays: null })).toEqual([]);
    expect(errors(CreateMcpTokenDto, { name: "   ", expiresInDays: 30 })).toEqual(["name"]);
    expect(errors(CreateMcpTokenDto, { name: "x".repeat(81), expiresInDays: 30 })).toEqual([
      "name",
    ]);
    expect(errors(CreateMcpTokenDto, { name: "Notebook", expiresInDays: 45 })).toEqual([
      "expiresInDays",
    ]);
    expect(errors(CreateMcpTokenDto, { name: "Notebook" })).toEqual(["expiresInDays"]);
  });

  it("trims the token name", () => {
    expect(plainToInstance(CreateMcpTokenDto, { name: "  Notebook  " }).name).toBe("Notebook");
  });

  it("validates configuration areas", () => {
    expect(errors(UpdateMcpConfigurationDto, { enabled: true, enabledAreas: ["SALES"] })).toEqual(
      []
    );
    expect(errors(UpdateMcpConfigurationDto, { enabled: true, enabledAreas: ["UNKNOWN"] })).toEqual(
      ["enabledAreas"]
    );
    expect(
      errors(UpdateMcpConfigurationDto, { enabled: true, enabledAreas: ["SALES", "SALES"] })
    ).toEqual(["enabledAreas"]);
    expect(errors(UpdateMcpConfigurationDto, { enabledAreas: [] })).toEqual(["enabled"]);
  });

  it("validates usage filters", () => {
    expect(errors(McpUsageQueryDto, { page: "2", pageSize: "50", result: "DENIED" })).toEqual([]);
    expect(errors(McpUsageQueryDto, { pageSize: "500" })).toEqual(["pageSize"]);
    expect(errors(McpUsageQueryDto, { tokenId: "abc" })).toEqual(["tokenId"]);
  });
});
