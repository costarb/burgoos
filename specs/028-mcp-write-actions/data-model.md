# Data Model: Ações pelo MCP

Migration `2026100410xxxx_mcp_write_actions` — só colunas novas com default ou nulas; sem backfill.

## `StoreMcpConfiguration`

| Campo | Coluna | Tipo | Default | Regra |
|---|---|---|---|---|
| `actionsEnabled` | `actions_enabled` | `Boolean` | `false` | Liga as ações para conexões OAuth com `mcp:write`. Alteração auditada. |

## `McpOAuthConnection.scope` (sem mudança de schema)

Passa a aceitar `"mcp:read mcp:write"`. Valor decidido no consentimento.

## `McpToolCall`

| Campo | Coluna | Tipo | Default | Regra |
|---|---|---|---|---|
| `isAction` | `is_action` | `Boolean` | `false` | Chamada de tool de ação. Índice `(tenant_id, connection_id, is_action, occurred_at)` para o limite por hora. |

## `FinancialAudit`

| Campo | Coluna | Tipo | Regra |
|---|---|---|---|
| `channel` | `channel` | `VarChar(80)?` | Nulo = tela. `MCP · <cliente>` quando feito pelo assistente. |

## `SalesImportRun`

| Campo | Coluna | Tipo | Regra |
|---|---|---|---|
| `channel` | `channel` | `VarChar(80)?` | Igual ao da auditoria financeira. Exibido no histórico de importações. |

## Constantes (código)

- `MCP_WRITE_SCOPE = "mcp:write"`.
- Permissão por ação: contas a pagar → `finance.manage` (área `PAYABLES`); importação → `integrations.sales.manage` (área `SALES`).
- Limite: 30 ações por conexão por hora.
