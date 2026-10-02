import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  expiresAtFrom,
  generateMcpToken,
  hashMcpToken,
  isWellFormedMcpToken,
  mcpTokenStatus,
} from "./mcp-token.util";

describe("MCP token util", () => {
  it("generates unique, well-formed tokens with a visible prefix and a sha-256 hash", () => {
    const first = generateMcpToken();
    const second = generateMcpToken();

    expect(first.token).not.toBe(second.token);
    expect(isWellFormedMcpToken(first.token)).toBe(true);
    expect(first.tokenPrefix).toBe(first.token.slice(0, 14));
    expect(first.tokenPrefix.startsWith("rrf_mcp_")).toBe(true);
    expect(first.tokenHash).toBe(createHash("sha256").update(first.token).digest("hex"));
    expect(first.tokenHash).toHaveLength(64);
    expect(hashMcpToken(first.token)).toBe(first.tokenHash);
  });

  it("rejects malformed tokens", () => {
    expect(isWellFormedMcpToken("rrf_mcp_curto")).toBe(false);
    expect(isWellFormedMcpToken(`xyz_mcp_${"a".repeat(43)}`)).toBe(false);
    expect(isWellFormedMcpToken(`rrf_mcp_${"a".repeat(42)}!`)).toBe(false);
  });

  it("derives the token status", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(mcpTokenStatus({ revokedAt: null, expiresAt: null }, now)).toBe("ACTIVE");
    expect(
      mcpTokenStatus({ revokedAt: null, expiresAt: new Date("2026-10-02T00:00:00Z") }, now)
    ).toBe("ACTIVE");
    expect(mcpTokenStatus({ revokedAt: null, expiresAt: now }, now)).toBe("EXPIRED");
    expect(
      mcpTokenStatus({ revokedAt: now, expiresAt: new Date("2025-01-01T00:00:00Z") }, now)
    ).toBe("REVOKED");
  });

  it("computes expiration from days", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(expiresAtFrom(null, now)).toBeNull();
    expect(expiresAtFrom(30, now)).toEqual(new Date("2026-10-31T12:00:00Z"));
  });
});
