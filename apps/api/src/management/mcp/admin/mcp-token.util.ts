import { createHash, randomBytes } from "crypto";

export const MCP_TOKEN_PREFIX = "rrf_mcp_";
export const MCP_TOKEN_VISIBLE_CHARS = 6;
export const MCP_MAX_ACTIVE_TOKENS = 10;
const MCP_TOKEN_PATTERN = /^rrf_mcp_[A-Za-z0-9_-]{43}$/;

export type McpTokenStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface GeneratedMcpToken {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

export function generateMcpToken(): GeneratedMcpToken {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashMcpToken(token), tokenPrefix: mcpTokenPrefix(token) };
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function mcpTokenPrefix(token: string): string {
  return token.slice(0, MCP_TOKEN_PREFIX.length + MCP_TOKEN_VISIBLE_CHARS);
}

export function isWellFormedMcpToken(value: string): boolean {
  return MCP_TOKEN_PATTERN.test(value);
}

export function mcpTokenStatus(
  token: { revokedAt: Date | null; expiresAt: Date | null },
  now = new Date()
): McpTokenStatus {
  if (token.revokedAt) return "REVOKED";
  if (token.expiresAt && token.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "ACTIVE";
}

export function expiresAtFrom(expiresInDays: number | null, now = new Date()): Date | null {
  if (expiresInDays === null) return null;
  return new Date(now.getTime() + expiresInDays * 86_400_000);
}
