import { McpDataArea } from "@prisma/client";
import { MCP_OAUTH_SCOPE } from "./oauth/oauth-urls";

/** OAuth scope that lets a connection run write tools (granted only by explicit consent). */
export const MCP_WRITE_SCOPE = "mcp:write";
export const MCP_READ_WRITE_SCOPE = `${MCP_OAUTH_SCOPE} ${MCP_WRITE_SCOPE}`;

/** Write tools per connection per rolling hour, on top of the general MCP rate limit. */
export const MCP_ACTIONS_PER_HOUR = 30;

export type McpActionGroup = "PAYABLES" | "SALES_IMPORT";

export const MCP_ACTION_GROUPS: Record<
  McpActionGroup,
  { permission: string; area: McpDataArea; label: string }
> = {
  PAYABLES: {
    permission: "finance.manage",
    area: McpDataArea.PAYABLES,
    label: "criar, pagar, editar e cancelar contas a pagar",
  },
  SALES_IMPORT: {
    permission: "integrations.sales.manage",
    area: McpDataArea.SALES,
    label: "importar vendas do PagBank, Mercado Pago e iFood",
  },
};

export function hasWriteScope(scope: string | null | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(MCP_WRITE_SCOPE);
}

/** What the connection may do; tokens and read-only connections get `allowed: false`. */
export interface McpActionsContext {
  allowed: boolean;
  /** Permissions of the connection's user in this store (elevated roles hold every action). */
  elevated: boolean;
  permissions: string[];
  /** Origin written to audits and import runs, e.g. "MCP · Claude". */
  channel: string | null;
}

export const NO_ACTIONS: McpActionsContext = {
  allowed: false,
  elevated: false,
  permissions: [],
  channel: null,
};

export function holdsPermission(actions: McpActionsContext, permission: string): boolean {
  return actions.elevated || actions.permissions.includes(permission);
}

/** Action groups the user's permissions unlock (used by the consent screen). */
export function unlockedActionGroups(input: {
  elevated: boolean;
  permissions: string[];
}): McpActionGroup[] {
  return (Object.keys(MCP_ACTION_GROUPS) as McpActionGroup[]).filter(
    (group) => input.elevated || input.permissions.includes(MCP_ACTION_GROUPS[group].permission)
  );
}

/**
 * Why the action cannot run for this connection, or null when it can. Evaluated both when
 * listing tools and on every call (servers are stateless; settings may change in between).
 */
export function actionDeniedMessage(
  actions: McpActionsContext | undefined,
  enabledAreas: McpDataArea[],
  group: McpActionGroup
): string | null {
  const rule = MCP_ACTION_GROUPS[group];
  if (!actions?.allowed) {
    return "Acoes exigem uma conexao OAuth autorizada com a opcao 'Permitir que o assistente execute acoes', e a loja precisa permitir acoes pelos assistentes.";
  }
  if (!enabledAreas.includes(rule.area)) {
    return "A area de dados desta acao nao esta liberada para esta loja.";
  }
  if (!holdsPermission(actions, rule.permission)) {
    return `Seu usuario nao tem a permissao necessaria (${rule.permission}) para ${rule.label}.`;
  }
  return null;
}

export function actionChannel(clientName: string | null | undefined): string {
  return `MCP · ${clientName?.trim() || "assistente"}`.slice(0, 80);
}
