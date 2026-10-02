import type { McpDataArea } from "@prisma/client";
import type { Request } from "express";

/** Store resolved from the MCP token; the only source of tenant for every MCP call. */
export interface McpRequestContext {
  tenantId: string;
  tokenId: string;
  enabledAreas: McpDataArea[];
  storeName: string;
  storeSlug: string;
}

export interface McpRequest extends Request {
  mcpContext?: McpRequestContext;
}

export type McpErrorCode =
  | "INVALID_PERIOD"
  | "PERIOD_TOO_LONG"
  | "AREA_DISABLED"
  | "TIMEOUT"
  | "MEMORY_PRESSURE"
  | "INTERNAL";

export type McpDeniedReason =
  | "TOKEN_REVOKED"
  | "TOKEN_EXPIRED"
  | "MCP_DISABLED"
  | "STORE_INACTIVE"
  | "RATE_LIMITED";

/** Business error surfaced to the LLM as a tool result with `isError: true`. */
export class McpToolError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string
  ) {
    super(message);
    this.name = "McpToolError";
  }
}
