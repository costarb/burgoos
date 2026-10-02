# Research: Conectores de IA com Login (OAuth) no MCP por Loja

**Feature**: `026-mcp-oauth-connectors` | **Date**: 2026-10-02

Fontes consultadas em 2026-10-02:
- [MCP Authorization (2026-07-28)](https://modelcontextprotocol.io/specification/latest/basic/authorization)
- [Claude: Authentication for connectors](https://claude.com/docs/connectors/building/authentication)
- [OpenAI: Authentication (Apps/connectors)](https://developers.openai.com/plugins/build/auth)

## R1. Requisitos normativos que o RRFive OS precisa cumprir

| Requisito | Origem | Decisão |
|---|---|---|
| Servidor MCP publica Protected Resource Metadata (RFC 9728) | MCP **MUST** | `GET /.well-known/oauth-protected-resource` e `/.well-known/oauth-protected-resource/api/mcp` |
| 401 com `WWW-Authenticate: Bearer resource_metadata=…` | MCP; Claude exige 401 (ignora o header em 200) | Ajustar `McpTokenGuard` para incluir `resource_metadata` e `scope="mcp:read"` em toda recusa |
| `resource` do PRM igual à URL que o usuário digita | Claude | `resource = MCP_PUBLIC_URL` sem barra final; aceitar requisições com e sem barra |
| AS metadata (RFC 8414 ou OIDC Discovery) | MCP **MUST** (um dos dois) | RFC 8414 em `/.well-known/oauth-authorization-server` |
| OAuth 2.1, PKCE S256, `code_challenge_methods_supported: ["S256"]` | MCP, Claude | PKCE obrigatório; só S256 |
| Resource Indicators (RFC 8707) e validação de audiência | MCP **MUST** | O token guarda o `resource` emitido; o guard aceita só o canônico do MCP |
| `iss` na resposta de autorização (RFC 9207) | MCP **SHOULD**; ChatGPT usa redirect estável quando presente | Incluir `iss` e anunciar `authorization_response_iss_parameter_supported: true` |
| Client ID Metadata Documents (CIMD) | MCP **SHOULD**; Claude/ChatGPT preferem | Suportar; anunciar `client_id_metadata_document_supported: true` |
| Dynamic Client Registration (RFC 7591) | MCP **MAY** (obsoleto, por compatibilidade) | Suportar `POST /api/oauth/register` para clientes que não usam CIMD |
| Token endpoint aceita `application/x-www-form-urlencoded` | Claude | Parser urlencoded já existe em `main.ts`; validar no teste |
| Rotação do refresh token para clientes públicos | MCP/OAuth 2.1, Claude | Rotação a cada uso; reutilização revoga a conexão |
| Erro de refresh inválido = `invalid_grant` | Claude | Seguir RFC 6749 nos erros |
| Endpoints de descoberta, registro e token respondem em menos de 10s; refresh em menos de 30s | Claude | Operações simples de banco; meta abaixo de 2s (SC-006) |
| Token endpoint auth `none` (cliente público) | Claude/CIMD | `token_endpoint_auth_methods_supported: ["none"]` |
| Tokens nunca na query string; não repassar tokens | MCP **MUST** | Só header `Authorization`; o servidor só aceita os próprios tokens |
| Não incluir `offline_access` no PRM | MCP **SHOULD NOT** | Refresh sempre emitido para `authorization_code`; o PRM anuncia só `mcp:read` |

## R2. Servidor de autorização: próprio x externo

- **Decision**: servidor de autorização embutido na API NestJS, usando as contas `User` existentes. Issuer = origem pública da API (ex.: `https://api.rrfive.com.br`), derivada de `MCP_PUBLIC_URL`.
- **Rationale**: a spec exige as contas do RRFive OS (FR-003). Um IdP externo (Auth0, Entra) duplicaria usuários e permissões. O escopo de OAuth necessário é pequeno: um único recurso, um único escopo, só clientes públicos e `authorization_code` + `refresh_token`.
- **Alternatives considered**: `oidc-provider` (node-oidc-provider; rejeitado por ser um framework completo de OIDC com estado e configuração próprios, difícil de encaixar no Nest e no modelo multi-loja); Auth0/Keycloak (rejeitado: identidade duplicada, custo e operação).

## R3. Tela de autorização e sessão

- **Decision**: o fluxo atravessa API e web:
  1. `GET /api/oauth/authorize` valida os parâmetros e o cliente (CIMD/DCR) e **só então** grava uma `McpOAuthAuthorizationRequest` pendente (10 min). Depois redireciona para a web em `{WEB_URL}/conectar/mcp?pedido=<id>`.
  2. A página web exige sessão do admin. Sem sessão, vai para `/login?next=/conectar/mcp?pedido=<id>`; a tela de login passa a aceitar `next` somente para caminhos internos.
  3. A página chama `GET /api/oauth/requests/:id` (JWT) para obter o cliente, o domínio de retorno e as lojas elegíveis do usuário.
  4. **Autorizar** chama `POST /api/oauth/requests/:id/approve { storeId }`, que cria a conexão, gera o código (60s) e devolve a URL de retorno. **Cancelar** chama `…/deny`, que devolve a URL com `error=access_denied`.
  5. A web faz `window.location.assign(url)`.
- **Rationale**: reaproveita login, sessão e permissões existentes sem criar um novo mecanismo de sessão na API. Erros de validação de `redirect_uri`/`client_id` são exibidos **sem redirecionar** (OAuth 2.1 §4.1.2.1), por isso a validação acontece antes de criar o pedido.
- **Alternatives considered**: tela de login servida pela API (rejeitado: duplicaria UI, i18n e regras de login); cookie de sessão próprio da API (rejeitado: hoje a sessão é JWT em cookie da web, em outro domínio).
- **Nova variável**: `WEB_PUBLIC_URL` (URL da web para montar o redirecionamento). Fallback: primeira origem de `WEB_ORIGIN`.

## R4. CIMD (Client ID Metadata Documents)

- **Decision**: quando `client_id` é uma URL `https://`, a API busca o documento JSON com timeout de 5s, limite de 64 KB, sem seguir redirecionamentos, bloqueando IPs privados e de loopback (proteção contra SSRF). Valida que `client_id` do documento é igual à URL e que `redirect_uri` pedido está em `redirect_uris`. O resultado vai para cache em `McpOAuthClient` por 24h. O nome exibido vem de `client_name`.
- **Rationale**: é o mecanismo preferido do protocolo, do Claude e do ChatGPT, e evita acumular clientes registrados.
- **Redirects de loopback**: para `http://localhost/...` e `http://127.0.0.1/...` declarados no documento, aceitar qualquer porta (RFC 8252 §7.3; Claude Code usa porta efêmera).

## R5. DCR (compatibilidade)

- **Decision**: `POST /api/oauth/register` aceita `client_name`, `redirect_uris` (https, ou loopback http), `grant_types ⊆ {authorization_code, refresh_token}`, `token_endpoint_auth_method = none`. Gera `client_id` aleatório e responde 201 conforme a RFC 7591. Limite de taxa por IP. Clientes DCR sem nenhuma conexão por 30 dias são removidos pela rotina de retenção.
- **Rationale**: obsoleto, mas clientes antigos e o próprio Claude, quando não detecta CIMD, ainda usam.

## R6. Formato e armazenamento dos tokens

- **Decision**: tokens opacos, como na fase 1:
  - acesso: `rrf_oat_` + 32 bytes base64url, 1h;
  - renovação: `rrf_ort_` + 32 bytes, 30 dias.

  O banco guarda o SHA-256 em `McpOAuthToken (connectionId, kind, tokenHash, expiresAt, rotatedAt)`. A cada renovação, o refresh usado recebe `rotatedAt` e um novo par é emitido. Apresentar um refresh já rotacionado revoga a conexão (`REFRESH_REUSE`) e registra auditoria. O código de autorização fica no próprio pedido (`codeHash`, 60s, uso único).
- **Rationale**: o mesmo padrão já validado (hash + lookup por índice único) mantém a revogação imediata e evita gerenciar chaves de assinatura (JWT). O guard distingue os tipos pelo prefixo: `rrf_mcp_` (fase 1) e `rrf_oat_` (OAuth).
- **Alternatives considered**: JWT de acesso (rejeitado: revogação imediata exigiria consulta ao banco de qualquer forma, o que anula a vantagem).

## R7. Autorização por loja e permissões (FR-008, FR-009, FR-012)

- **Decision**:
  - **Lojas elegíveis**: as lojas do usuário (própria + vínculos ativos; para master, todas as lojas ativas) com MCP habilitado e loja ativa.
  - **Permissão no momento de autorizar**: `role ∈ {OWNER, ADMIN}` ou `isMaster`, ou um vínculo ativo da loja escolhida cujo perfil tem `mcp.connect`.
  - **Checagem em cada chamada**: conexão ativa, token válido, MCP habilitado, loja ativa, usuário ativo e ainda com acesso à loja. A remoção posterior da permissão `mcp.connect` não derruba a conexão automaticamente; o administrador revoga na tela. Isso fica documentado.
  - **Áreas**: as da configuração MCP da loja no momento da chamada.
- **Rationale**: segue a decisão do usuário (FR-009 B). Checar a permissão a cada chamada exigiria recomputar perfis por requisição; checar acesso à loja e status do usuário cobre os casos de desligamento.

## R8. Integração com o servidor MCP da fase 1

- **Decision**: `McpTokenGuard` passa a resolver dois tipos de credencial e produz o mesmo `McpRequestContext`, agora com `connectionId?`, `tokenId?`, `clientName?` e `userId?`. Rate limit por `connectionId ?? tokenId`. `McpToolCall` ganha `connectionId` (FK opcional). Todo o restante (factory, runner, tools, log) não muda.
- **401**: o corpo continua igual ao da fase 1. O header passa a ser `WWW-Authenticate: Bearer realm="rrfive-mcp", resource_metadata="<origem>/.well-known/oauth-protected-resource", scope="mcp:read"`. Clientes da fase 1 (Inspector, `mcp-remote` com token válido) não são afetados.
- **Efeito colateral positivo**: o `mcp-remote` sem token passa a conseguir o fluxo OAuth completo, em vez de falhar em `/register` (404) como no diagnóstico da fase 1.

## R9. Rotas fora do prefixo `/api`

- **Decision**: `app.setGlobalPrefix("api", { exclude: [".well-known/(.*)"] })` em `main.ts`, com controller `WellKnownController`. Os endpoints OAuth ficam em `/api/oauth/*` (AS metadata aponta para eles).
- **Rationale**: a RFC 8414 e a RFC 9728 exigem caminhos `/.well-known/*` na origem.

## R10. Desvios da constituição

- Continua o desvio já justificado na fase 1 (endpoint MCP fora de REST/OpenAPI). Os endpoints OAuth seguem RFCs (formatos `application/x-www-form-urlencoded`, erros OAuth) e ficam documentados em `contracts/oauth.md`, fora do Swagger. Os endpoints de gestão (`/api/admin/mcp/connections`) continuam REST com OpenAPI.
