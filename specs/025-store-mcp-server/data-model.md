# Data Model: MCP Server por Loja

**Feature**: `025-store-mcp-server` | **Date**: 2026-10-01

Três tabelas novas, um enum novo e três valores novos em um enum existente. Todas as tabelas carregam `tenant_id` (Constituição IV). Migration: `packages/database/prisma/migrations/20261001090000_store_mcp_server/`.

## Enum `McpDataArea` (novo)

| Valor | Rótulo na tela | Tools |
|---|---|---|
| `SALES` | Vendas | `resumo_vendas`, `resumo_diario`, `relatorio_gerencial` |
| `FINANCIAL` | Financeiro/DRE | `dre`, `dashboard_financeiro` |
| `MENU` | Cardápio e Margem | `engenharia_cardapio` |
| `CASH` | Caixa | `posicao_caixa`, `extrato_caixa` |
| `PAYABLES` | Contas a pagar | `contas_a_pagar` |
| `INVENTORY` | Estoque | `estoque` |

Recursos (`perfil_loja`, `glossario_metricas`) não dependem de área e sempre ficam disponíveis. Cada prompt declara as áreas de que depende e só aparece se **todas** estiverem liberadas.

## Enum `McpToolCallResult` (novo)

`SUCCESS` · `ERROR` (falha de validação, timeout, pressão de memória, erro interno) · `DENIED` (token conhecido, mas revogado, expirado, MCP desabilitado, loja inativa, área não liberada ou limite de taxa excedido)

## `AccessAuditEventType` (existente, valores novos)

`MCP_CONFIGURATION_CHANGED` · `MCP_TOKEN_CREATED` · `MCP_TOKEN_REVOKED`

## `StoreMcpConfiguration` → `store_mcp_configurations`

Uma por loja, criada sob demanda na primeira habilitação. Ausência do registro equivale a "desabilitado" (FR-001).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `tenantId` | uuid, **único**, FK `Tenant` (cascade) | uma configuração por loja |
| `enabled` | boolean, default `false` | |
| `enabledAreas` | `McpDataArea[]`, default todas | não pode ficar vazio enquanto `enabled = true` (US4-3) |
| `updatedByUserId` | uuid?, FK `User` (set null) | |
| `createdAt` / `updatedAt` | timestamp | |

## `StoreMcpToken` → `store_mcp_tokens`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `tenantId` | uuid, FK `Tenant` (cascade) | loja dona do token. Única fonte da loja nas chamadas (FR-011) |
| `name` | varchar(80) | obrigatório, 1–80 caracteres, sem espaços nas pontas |
| `tokenHash` | char(64), **único** | SHA-256 hex do token completo. O token em claro nunca é persistido (FR-004) |
| `tokenPrefix` | varchar(16) | `rrf_mcp_` + 6 primeiros caracteres, exibido na tela (FR-005) |
| `expiresAt` | timestamp? | `null` = sem expiração. Opções na criação: 30, 90, 365 dias ou nenhuma |
| `revokedAt` | timestamp? | |
| `revokedByUserId` | uuid?, FK `User` (set null) | |
| `lastUsedAt` | timestamp? | atualizado com throttle de 1 minuto (FR-025) |
| `createdByUserId` | uuid?, FK `User` (set null) | exibido como "gerado por" |
| `createdAt` | timestamp | |

Índices: `@@unique([tokenHash])`, `@@index([tenantId, revokedAt])`.

**Estado derivado** (calculado, não persistido):

```text
              revogar                    
ATIVO ────────────────────────► REVOGADO   (terminal)
  │
  │ now >= expiresAt
  ▼
EXPIRADO  (terminal; revogar continua permitido, para limpar a lista)
```

`status = revokedAt ? "REVOKED" : (expiresAt && expiresAt <= now ? "EXPIRED" : "ACTIVE")`

Regra de limite: no máximo **10** tokens `ACTIVE` por loja na criação (FR-007), verificado na mesma transação da inserção.

**Validação de uma chamada** (ordem, todas as falhas resultam no mesmo `401`, FR-012):

1. Header `Authorization: Bearer rrf_mcp_…` presente e bem formado.
2. `tokenHash` encontrado. Se não for encontrado, a recusa não é registrada.
3. `revokedAt` nulo, `expiresAt` nulo ou futuro.
4. `StoreMcpConfiguration.enabled = true`.
5. `Tenant.active = true` e `deactivatedAt` nulo.

Falhas nos passos 3–5 geram `McpToolCall` com `result = DENIED`.

## `McpToolCall` → `mcp_tool_calls`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `tenantId` | uuid, FK `Tenant` (cascade) | |
| `tokenId` | uuid?, FK `StoreMcpToken` (set null) | |
| `method` | varchar(40) | `tools/call`, `resources/read`, `prompts/get` ou `initialize` (só em recusas) |
| `target` | varchar(80)? | nome da tool, resource ou prompt |
| `arguments` | jsonb? | apenas os argumentos declarados da tool, serializados e truncados em 1 KB |
| `result` | `McpToolCallResult` | |
| `errorCode` | varchar(40)? | ex.: `TOKEN_REVOKED`, `TOKEN_EXPIRED`, `MCP_DISABLED`, `STORE_INACTIVE`, `AREA_DISABLED`, `RATE_LIMITED`, `INVALID_PERIOD`, `TIMEOUT`, `MEMORY_PRESSURE`, `INTERNAL` |
| `durationMs` | int | |
| `occurredAt` | timestamp, default now | |

Índices: `@@index([tenantId, occurredAt(sort: Desc)])`, `@@index([tenantId, tokenId, occurredAt])`, `@@index([occurredAt])` (para a retenção).

Chamadas de listagem (`tools/list`, `resources/list`, `prompts/list`) e `initialize` bem-sucedido **não** são registradas, para manter o log focado em consultas de dados.

Retenção: registros com `occurredAt` mais antigo que 90 dias são apagados por um job diário (FR-026).

## Relações com o modelo existente

```text
Tenant 1 ── 0..1 StoreMcpConfiguration
Tenant 1 ── *    StoreMcpToken
Tenant 1 ── *    McpToolCall
StoreMcpToken 1 ── * McpToolCall
User   1 ── *    StoreMcpToken (createdBy / revokedBy)
```

Novas relações inversas em `Tenant` e `User` seguem o padrão já existente (ex.: `OperationalNotification`).

## Permissão nova

`mcp.manage`: área "Integracoes", tela "MCP / IA", ação `MANAGE`, `sensitive: true`. `OWNER`, `ADMIN` e master já passam no `PermissionGuard` sem precisar da chave (FR-003). A chave também é adicionada ao catálogo para poder ser concedida a perfis customizados.
