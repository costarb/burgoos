import type { McpDataArea } from "@prisma/client";
import type { McpActionsContext } from "../mcp-actions";
import type { Request } from "express";

/**
 * Store resolved from the credential (a phase-1 store token or an OAuth connection); the only
 * source of tenant for every MCP call.
 */
export interface McpRequestContext {
  tenantId: string;
  /** Phase-1 store token, when the call used `rrf_mcp_`. */
  tokenId: string | null;
  /** OAuth connection, when the call used `rrf_oat_`. */
  connectionId?: string | null;
  userId?: string | null;
  clientName?: string | null;
  enabledAreas: McpDataArea[];
  /** Write permissions of the call; absent or not allowed = read-only. */
  actions?: McpActionsContext;
  storeName: string;
  storeSlug: string;
}

export interface McpRequest extends Request {
  mcpContext?: McpRequestContext;
}

export type McpErrorCode =
  | "INVALID_PERIOD"
  | "PERIOD_TOO_LONG"
  | "INVALID_FILTER"
  | "AREA_DISABLED"
  | "TIMEOUT"
  | "MEMORY_PRESSURE"
  | "ACTION_NOT_ALLOWED"
  | "ACTION_RATE_LIMITED"
  | "BUSINESS_RULE"
  | "NOT_FOUND"
  | "INTERNAL";

export type McpDeniedReason =
  | "TOKEN_REVOKED"
  | "TOKEN_EXPIRED"
  | "MCP_DISABLED"
  | "STORE_INACTIVE"
  | "RATE_LIMITED"
  | "CONNECTION_REVOKED"
  | "USER_INACTIVE"
  | "STORE_ACCESS_LOST";

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
