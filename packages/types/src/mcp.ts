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
  /** Write tools for OAuth connections granted actions (off by default). */
  actionsEnabled: boolean;
  availableAreas: McpDataAreaOption[];
  serverUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface McpConfigurationPayload {
  enabled: boolean;
  enabledAreas: McpDataArea[];
  /** Absent keeps the current value. */
  actionsEnabled?: boolean;
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
  connectionId: string | null;
  clientName: string | null;
  userName: string | null;
  method: string;
  target: string | null;
  arguments: Record<string, unknown> | null;
  result: McpToolCallResult;
  errorCode: string | null;
  durationMs: number;
  /** Write tool (action) call. */
  isAction: boolean;
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

export type McpAuthorizationBlockedReason = "MISSING_PERMISSION" | "NO_ELIGIBLE_STORE" | "PLATFORM_ADMIN";

export interface McpAuthorizationStore {
  id: string;
  name: string;
  areas: Array<{ area: McpDataArea; label: string }>;
  /** Actions this user may grant on this store (empty when not allowed). */
  actions: Array<{ group: McpActionGroup; label: string }>;
}

export type McpActionGroup = "PAYABLES" | "SALES_IMPORT";

export interface McpAuthorizationRequest {
  id: string;
  client: { name: string; redirectHost: string; kind: "CIMD" | "DCR"; loopbackOnly: boolean };
  scopeDescription: string;
  expiresAt: string;
  canAuthorize: boolean;
  blockedReason: McpAuthorizationBlockedReason | null;
  stores: McpAuthorizationStore[];
}

export interface McpConnection {
  id: string;
  clientName: string;
  clientKind: "CIMD" | "DCR";
  redirectHost: string;
  userName: string;
  status: "ACTIVE" | "REVOKED";
  /** Connection was granted write tools. */
  actions: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}
