export type McpDataArea = "SALES" | "FINANCIAL" | "MENU" | "CASH" | "PAYABLES" | "INVENTORY";
export type McpTokenStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type McpToolCallResult = "SUCCESS" | "ERROR" | "DENIED";
export type McpTokenExpiration = 30 | 90 | 365 | null;

export interface McpDataAreaOption {
  area: McpDataArea;
  label: string;
  description: string;
  tools: string[];
}

export interface McpConfiguration {
  enabled: boolean;
  enabledAreas: McpDataArea[];
  availableAreas: McpDataAreaOption[];
  serverUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface McpConfigurationPayload {
  enabled: boolean;
  enabledAreas: McpDataArea[];
}

export interface McpToken {
  id: string;
  name: string;
  tokenPrefix: string;
  status: McpTokenStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  revokedAt: string | null;
}

export interface McpConfigurationSnippets {
  inspector: string;
  claudeCode: string;
  claudeDesktop: string;
  claudeDesktopWindows: string;
  cursor: string;
}

export interface CreatedMcpToken extends McpToken {
  token: string;
  snippets: McpConfigurationSnippets;
}

export interface CreateMcpTokenPayload {
  name: string;
  expiresInDays: McpTokenExpiration;
}

export interface McpUsageEntry {
  id: string;
  occurredAt: string;
  tokenName: string | null;
  tokenPrefix: string | null;
  method: string;
  target: string | null;
  arguments: Record<string, unknown> | null;
  result: McpToolCallResult;
  errorCode: string | null;
  durationMs: number;
}

export interface McpUsagePage {
  page: number;
  pageSize: number;
  total: number;
  items: McpUsageEntry[];
}

export interface McpUsageQuery {
  tokenId?: string;
  start?: string;
  end?: string;
  result?: McpToolCallResult;
  page?: number;
  pageSize?: number;
}
