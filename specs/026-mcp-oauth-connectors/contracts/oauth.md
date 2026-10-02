# Contrato: Descoberta e Servidor de Autorização OAuth

**Feature**: `026-mcp-oauth-connectors`

Valores de exemplo: `MCP_PUBLIC_URL = https://api.rrfive.com.br/api/mcp`, issuer `https://api.rrfive.com.br`, `WEB_PUBLIC_URL = https://app.rrfive.com.br`.

## 1. Recusa do servidor MCP (mudança na fase 1)

`POST /api/mcp` sem credencial válida:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="rrfive-mcp", resource_metadata="https://api.rrfive.com.br/.well-known/oauth-protected-resource", scope="mcp:read"
Content-Type: application/json

{ "error": "unauthorized", "message": "Token MCP invalido ou sem acesso." }
```

## 2. Protected Resource Metadata (RFC 9728)

`GET /.well-known/oauth-protected-resource` e `GET /.well-known/oauth-protected-resource/api/mcp` (fora do prefixo `/api`):

```json
{
  "resource": "https://api.rrfive.com.br/api/mcp",
  "authorization_servers": ["https://api.rrfive.com.br"],
  "scopes_supported": ["mcp:read"],
  "bearer_methods_supported": ["header"],
  "resource_name": "RRFive OS"
}
```

## 3. Authorization Server Metadata (RFC 8414)

`GET /.well-known/oauth-authorization-server`:

```json
{
  "issuer": "https://api.rrfive.com.br",
  "authorization_endpoint": "https://api.rrfive.com.br/api/oauth/authorize",
  "token_endpoint": "https://api.rrfive.com.br/api/oauth/token",
  "registration_endpoint": "https://api.rrfive.com.br/api/oauth/register",
  "revocation_endpoint": "https://api.rrfive.com.br/api/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["mcp:read"],
  "client_id_metadata_document_supported": true,
  "authorization_response_iss_parameter_supported": true
}
```

Respostas de descoberta com `Cache-Control: public, max-age=300` e CORS liberado (`GET`).

## 4. `GET /api/oauth/authorize`

Parâmetros: `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, `state?`, `scope?` (padrão `mcp:read`), `resource?` (se presente, deve ser o canônico do MCP, com ou sem barra final).

| Situação | Resposta |
|---|---|
| `client_id` inválido ou não identificável (CIMD inacessível ou inválido, DCR inexistente) | `400` com página de erro em português, **sem redirecionar**; auditoria `MCP_CLIENT_REJECTED` |
| `redirect_uri` não declarado pelo cliente | `400` com página de erro, **sem redirecionar** |
| Demais parâmetros inválidos (`response_type`, PKCE ausente ou não S256, `resource` de outro servidor, `scope` desconhecido) | `302` para `redirect_uri?error=invalid_request\|invalid_scope\|invalid_target&error_description=…&state=…&iss=…` |
| Válido | Cria `McpOAuthAuthorizationRequest` (`PENDING`, 10 min) e responde `302` para `{WEB_PUBLIC_URL}/conectar/mcp?pedido=<id>` |

## 5. Tela web e endpoints de consentimento (JWT do admin)

### `GET /api/oauth/requests/:id`
Guardas: `JwtAuthGuard`. Pedido inexistente, expirado ou fora de `PENDING`: `404`/`410`.

```json
{
  "id": "…",
  "client": { "name": "Claude", "redirectHost": "claude.ai", "kind": "CIMD" },
  "scopeDescription": "Somente leitura dos números da loja",
  "expiresAt": "2026-10-02T15:10:00.000Z",
  "canAuthorize": true,
  "blockedReason": null,
  "stores": [
    { "id": "…", "name": "Dogão do Mounjaro", "areas": [{ "area": "SALES", "label": "Vendas" }] }
  ]
}
```

`blockedReason`: `MISSING_PERMISSION` (sem `mcp.connect`), `NO_ELIGIBLE_STORE` (nenhuma loja acessível com MCP habilitado) ou `PLATFORM_ADMIN`.

### `POST /api/oauth/requests/:id/approve`
Body `{ "storeId": "uuid" }`. Valida a elegibilidade da loja, a permissão e o limite de 20 conexões (`409 CONNECTION_LIMIT_REACHED`). Cria `McpOAuthConnection`, gera o código (60s) e audita `MCP_CONNECTION_AUTHORIZED`.

```json
{ "redirectUrl": "https://claude.ai/api/mcp/auth_callback?code=…&state=…&iss=https%3A%2F%2Fapi.rrfive.com.br" }
```

### `POST /api/oauth/requests/:id/deny`
Marca `DENIED`, audita `MCP_CONNECTION_DENIED` e responde `{ "redirectUrl": "<redirect_uri>?error=access_denied&state=…&iss=…" }`.

## 6. `POST /api/oauth/token`

`Content-Type: application/x-www-form-urlencoded`. Clientes públicos (sem segredo). As respostas levam `Cache-Control: no-store`.

**authorization_code**: `grant_type`, `code`, `redirect_uri`, `client_id`, `code_verifier`, `resource?`.
**refresh_token**: `grant_type`, `refresh_token`, `client_id`, `resource?`.

Sucesso:

```json
{
  "access_token": "rrf_oat_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rrf_ort_…",
  "scope": "mcp:read"
}
```

| Erro | Quando |
|---|---|
| `400 invalid_request` | parâmetro ausente ou content-type inválido |
| `400 invalid_grant` | código inexistente, expirado, já usado (e revoga a conexão), `code_verifier` não confere, `redirect_uri`/`client_id` divergentes; refresh inválido, expirado, de conexão revogada ou reutilizado (e revoga a conexão) |
| `400 invalid_target` | `resource` diferente do canônico |
| `400 unsupported_grant_type` | outro `grant_type` |
| `401 invalid_client` | `client_id` desconhecido |

## 7. `POST /api/oauth/register` (DCR, RFC 7591)

`Content-Type: application/json`. Body: `client_name?`, `redirect_uris` (obrigatório; https ou loopback http), `grant_types?` ⊆ `[authorization_code, refresh_token]`, `token_endpoint_auth_method?` = `none`.

`201`:

```json
{
  "client_id": "mcpc_…",
  "client_name": "Meu cliente",
  "redirect_uris": ["https://exemplo.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "client_id_issued_at": 1790000000
}
```

`400 invalid_redirect_uri` / `invalid_client_metadata`. Limite de 20 registros por IP por hora.

## 8. `POST /api/oauth/revoke` (RFC 7009)

`token`, `client_id`. Revoga a conexão do token. Sempre responde `200`, mesmo para token desconhecido.

## 9. Credencial nas chamadas MCP

O guard aceita `Bearer rrf_mcp_…` (token da fase 1) ou `Bearer rrf_oat_…` (acesso OAuth). Tokens de refresh no MCP são recusados. As demais regras de recusa estão em `data-model.md`.
