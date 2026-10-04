import { UserRole } from "@prisma/client";
import { runWithActionOrigin } from "../../../common/observability/action-origin";
import { AuthUser } from "../../../platform/auth/auth.types";
import { actionChannel } from "../mcp-actions";
import { McpRequestContext, McpToolError } from "./mcp-context";

/**
 * The user behind an OAuth connection, shaped as the AuthUser the screens' services expect,
 * scoped to the connection's store. Only reachable after the runner allowed the action.
 */
export function mcpActor(context: McpRequestContext): AuthUser {
  if (!context.userId || !context.actions?.allowed) {
    throw new McpToolError(
      "ACTION_NOT_ALLOWED",
      "Acoes exigem uma conexao OAuth com acoes autorizadas."
    );
  }
  return {
    id: context.userId,
    tenantId: context.tenantId,
    activeStoreId: context.tenantId,
    role: context.actions.elevated ? UserRole.ADMIN : UserRole.OPERATOR,
    email: "",
    name: context.clientName ?? "Assistente",
    permissions: context.actions.permissions,
  };
}

/** Runs a write with the MCP origin recorded in audits and import runs. */
export function asMcpAction<T>(context: McpRequestContext, callback: () => Promise<T>): Promise<T> {
  return runWithActionOrigin(
    context.actions?.channel ?? actionChannel(context.clientName),
    callback
  );
}
