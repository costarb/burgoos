# Data Model: Conectores de IA com Login (OAuth) no MCP por Loja

**Feature**: `026-mcp-oauth-connectors` | **Date**: 2026-10-02

Migration: `packages/database/prisma/migrations/20261002090000_mcp_oauth_connectors/`. Quatro tabelas novas, três enums novos, uma coluna nova em `mcp_tool_calls` e valores novos em `AccessAuditEventType`.

## Enums novos

- `McpOAuthClientKind`: `CIMD` · `DCR`
- `McpOAuthRequestStatus`: `PENDING` · `APPROVED` · `DENIED` · `CONSUMED` · `EXPIRED`
- `McpOAuthTokenKind`: `ACCESS` · `REFRESH`

`AccessAuditEventType` ganha: `MCP_CONNECTION_AUTHORIZED`, `MCP_CONNECTION_DENIED`, `MCP_CONNECTION_REVOKED`, `MCP_CLIENT_REJECTED`.

## `McpOAuthClient` → `mcp_oauth_clients`

Aplicativo identificado por CIMD (cache) ou registrado por DCR. Global (não pertence a loja).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `clientId` | varchar(512), **único** | URL do documento (CIMD) ou id aleatório (DCR) |
| `kind` | `McpOAuthClientKind` | |
| `name` | varchar(120) | `client_name`; fallback = host do `clientId` ou "Aplicativo MCP" |
| `redirectUris` | text[] | https, ou loopback http (porta ignorada na comparação) |
| `metadataFetchedAt` | timestamp? | CIMD: último fetch válido (cache de 24h) |
| `createdAt` / `updatedAt` | timestamp | |

## `McpOAuthAuthorizationRequest` → `mcp_oauth_authorization_requests`

Pedido de autorização desde o `/authorize` até a troca do código.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | usado na URL da tela web (`?pedido=`) |
| `clientId` | uuid FK `McpOAuthClient` (cascade) | |
| `redirectUri` | varchar(2048) | exatamente o recebido no `/authorize` |
| `state` | varchar(512)? | devolvido sem alteração |
| `codeChallenge` | varchar(128) | S256 |
| `scope` | varchar(200) | normalizado para `mcp:read` |
| `resource` | varchar(512) | canônico do MCP (RFC 8707) |
| `status` | `McpOAuthRequestStatus` | `PENDING → APPROVED → CONSUMED`, ou `PENDING → DENIED`, ou `→ EXPIRED` |
| `expiresAt` | timestamp | criação + 10 min (pendente) |
| `userId` / `tenantId` | uuid? FKs | preenchidos na aprovação |
| `connectionId` | uuid? FK `McpOAuthConnection` | preenchido na aprovação |
| `codeHash` | char(64)?, **único** | SHA-256 do código |
| `codeExpiresAt` | timestamp? | aprovação + 60s |
| `createdAt` | timestamp | |

Índice: `@@index([expiresAt])` para a limpeza.

```text
PENDING ──approve──► APPROVED ──token(code)──► CONSUMED
   │                     │
   ├──deny──► DENIED     └──60s sem troca──► EXPIRED
   └──10 min──► EXPIRED
```

Código reapresentado depois de `CONSUMED` revoga a conexão gerada por ele (OAuth 2.1 §4.1.3).

## `McpOAuthConnection` → `mcp_oauth_connections`

Vínculo aplicativo + usuário + loja criado no consentimento.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `tenantId` | uuid FK `Tenant` (cascade) | **única fonte da loja** nas chamadas |
| `userId` | uuid FK `User` (cascade) | quem autorizou |
| `clientId` | uuid FK `McpOAuthClient` (cascade) | |
| `scope` | varchar(200) | `mcp:read` |
| `resource` | varchar(512) | audiência dos tokens |
| `lastUsedAt` | timestamp? | throttle de 1 min |
| `revokedAt` | timestamp? | |
| `revokedByUserId` | uuid? FK `User` (set null) | |
| `revokedReason` | varchar(40)? | `MANUAL`, `REFRESH_REUSE`, `CODE_REUSE` |
| `createdAt` | timestamp | |

Índices: `@@index([tenantId, revokedAt])`, `@@index([userId])`. Limite: no máximo 20 com `revokedAt = null` por loja, verificado na aprovação.

## `McpOAuthToken` → `mcp_oauth_tokens`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK | |
| `connectionId` | uuid FK `McpOAuthConnection` (cascade) | |
| `kind` | `McpOAuthTokenKind` | |
| `tokenHash` | char(64), **único** | SHA-256 |
| `expiresAt` | timestamp | acesso 1h; renovação 30 dias |
| `rotatedAt` | timestamp? | refresh já trocado; reapresentação = reutilização |
| `createdAt` | timestamp | |

Índices: `@@index([connectionId, kind])`, `@@index([expiresAt])`. Tokens expirados há mais de 7 dias são apagados pela rotina diária (junto com pedidos expirados e clientes DCR sem conexão há 30 dias).

## Mudança em `McpToolCall` (fase 1)

| Campo novo | Tipo | Regras |
|---|---|---|
| `connectionId` | uuid? FK `McpOAuthConnection` (set null) | preenchido em chamadas OAuth; `tokenId` continua para a fase 1 |

Índice: `@@index([tenantId, connectionId, occurredAt])`.

## Permissão nova

`mcp.connect` · área "Integracoes" · tela "MCP / IA" · ação `CREATE` · `sensitive: true` · descrição "Conectar assistentes de IA à loja pelo login". Incluída no perfil "Admin da loja" do seed. OWNER, ADMIN e master passam automaticamente.

## Validação de uma chamada OAuth (ordem, todas as falhas resultam no mesmo `401`)

1. `Authorization: Bearer rrf_oat_…` bem formado.
2. `tokenHash` encontrado, `kind = ACCESS`, `expiresAt` no futuro. Se não for encontrado, a recusa não é registrada.
3. Conexão sem `revokedAt` e `resource` igual ao canônico do MCP.
4. MCP da loja habilitado e loja ativa.
5. Usuário ativo (`ACTIVE` ou `INVITED`) e com acesso à loja (loja própria, vínculo ativo ou master).

Falhas nos passos 3–5 geram `McpToolCall` `DENIED` com `connectionId` e motivo (`CONNECTION_REVOKED`, `MCP_DISABLED`, `STORE_INACTIVE`, `USER_INACTIVE`, `STORE_ACCESS_LOST`).
