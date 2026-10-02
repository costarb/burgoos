import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps internal paths with query strings", () => {
    expect(safeNextPath("/conectar/mcp?pedido=abc")).toBe("/conectar/mcp?pedido=abc");
    expect(safeNextPath("/admin")).toBe("/admin");
  });

  it.each([
    null,
    "",
    "https://evil.example.com",
    "//evil.example.com/path",
    "/\\evil.example.com",
    "javascript:alert(1)",
    "conectar/mcp",
    "/ok\u0000",
  ])("rejects %s", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});
