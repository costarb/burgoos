# Data Model: Ações pelo MCP

Migration `20261004100000_mcp_write_actions` — só colunas novas com default ou nulas; sem backfill.

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
| `requestedVia` | `requested_via` | `VarChar(80)?` | Igual ao canal da auditoria financeira (o campo `channel` já existe e indica API/arquivo). Exibido no histórico de importações. |

## Origem da ação

A origem é propagada por `AsyncLocalStorage` (`common/observability/action-origin.ts`): a tool roda dentro de `asMcpAction`, e `FinancialAuditService` e `SalesImportPreviewService.create` gravam o valor. Telas não definem origem (nulo).

## Constantes (código)

- `MCP_WRITE_SCOPE = "mcp:write"`.
- Permissão por ação: contas a pagar → `finance.manage` (área `PAYABLES`); importação → `integrations.sales.manage` (área `SALES`).
- Limite: 30 ações por conexão por hora.
