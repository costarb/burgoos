# Tasks: Conectores de IA com Login (OAuth) no MCP por Loja

**Input**: Design documents from `/specs/026-mcp-oauth-connectors/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/oauth.md, contracts/mcp-connections-admin.openapi.yaml, quickstart.md

**Tests**: Incluídos. A spec exige isolamento entre lojas (SC-004), recusa de redirect não declarado (SC-007) e não regressão da fase 1 (SC-005).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Adicionar `WEB_PUBLIC_URL` (URL opcional; fallback: primeira origem de `WEB_ORIGIN`) em `apps/api/src/config/env.validation.ts` com caso em `env.validation.spec.ts`; documentar em `.env.example` e `apps/api/.env.example`
- [X] T002 Excluir `.well-known/(.*)` do prefixo global em `apps/api/src/main.ts` (`setGlobalPrefix("api", { exclude: [...] })`) e cobrir em `apps/api/src/main.spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 Adicionar ao `packages/database/prisma/schema.prisma` os enums `McpOAuthClientKind`, `McpOAuthRequestStatus` e `McpOAuthTokenKind`, os valores `MCP_CONNECTION_AUTHORIZED|DENIED|REVOKED` e `MCP_CLIENT_REJECTED` em `AccessAuditEventType`, os models `McpOAuthClient`, `McpOAuthAuthorizationRequest`, `McpOAuthConnection` e `McpOAuthToken`, e `McpToolCall.connectionId`, com relações inversas em `Tenant` e `User` (data-model.md)
- [X] T004 Gerar `packages/database/prisma/migrations/20261002090000_mcp_oauth_connectors/migration.sql` por diff do schema anterior (`prisma migrate diff`), revisar o SQL e rodar `npm run db:generate`
- [X] T005 [P] Adicionar a permissão `mcp.connect` em `apps/api/src/management/access/permissions/permission-catalog.ts` e em `packages/database/prisma/seed.ts` (catálogo + perfil "Admin da loja")
- [X] T006 [P] Criar `apps/api/src/management/mcp/oauth/oauth-urls.ts`: issuer (origem de `MCP_PUBLIC_URL` ou da requisição), resource canônico (sem barra final), URLs de PRM/AS/endpoints e `WEB_PUBLIC_URL`, com testes em `oauth-urls.spec.ts`
- [X] T007 [P] Criar `apps/api/src/management/mcp/oauth/oauth-tokens.util.ts` (gerar `rrf_oat_`/`rrf_ort_`/código, SHA-256, verificação PKCE S256 com comparação em tempo constante) e `redirect-uri.ts` (match exato; loopback `localhost`/`127.0.0.1` com porta livre; só https ou loopback http), com testes
- [X] T008 [P] Criar `apps/api/src/management/mcp/oauth/oauth-errors.ts` (erros OAuth `invalid_request|invalid_grant|invalid_client|invalid_target|unsupported_grant_type|invalid_scope|access_denied` e página de erro HTML sem redirecionamento)
- [X] T009 Estender `apps/api/test/support/mcp-fake-prisma.ts` com os modelos OAuth (clients, requests, connections, tokens) e `user`/`userStoreAssignment` mínimos, e criar `apps/api/test/support/mcp-oauth-fixtures.ts` (lojas, usuários com e sem permissão, master, cliente CIMD/DCR, gerador de PKCE)

**Checkpoint**: schema, permissão e utilitários prontos.

---

## Phase 3: User Story 1 - Conectar só com o endereço do servidor (Priority: P1) 🎯 MVP

**Goal**: descoberta + authorize + consentimento web + token + chamadas MCP com `rrf_oat_`

**Independent Test**: quickstart §2–§4 (curl de descoberta, MCP Inspector e Claude Code sem token) e, em produção, §5 (claude.ai)

### Tests for User Story 1

- [X] T010 [P] [US1] `apps/api/test/mcp-oauth-discovery.integration.spec.ts`: 401 do `/api/mcp` com `resource_metadata` e `scope`, corpo igual à fase 1; PRM em `/.well-known/oauth-protected-resource` e `/…/api/mcp`; AS metadata conforme contrato (S256, `none`, CIMD, `iss`); fora do prefixo `/api`
- [X] T011 [P] [US1] `apps/api/test/mcp-oauth-authorize.integration.spec.ts`: CIMD válido cria pedido e redireciona para a web; `client_id` inválido e `redirect_uri` não declarado retornam 400 **sem** `Location` (SC-007) e auditam `MCP_CLIENT_REJECTED`; PKCE ausente/plain e `resource` de outro servidor redirecionam com erro, `state` e `iss`
- [X] T012 [P] [US1] `apps/api/test/mcp-oauth-consent.integration.spec.ts`: `GET requests/:id` lista só lojas elegíveis (vínculos, master, MCP habilitado, loja ativa), `blockedReason` para sem permissão / sem loja / platform admin; approve cria conexão, código e auditoria, e devolve `redirectUrl` com `code`, `state` e `iss`; loja inelegível 403; limite de 20 `409`; deny devolve `access_denied`; pedido expirado 410
- [X] T013 [P] [US1] `apps/api/test/mcp-oauth-token.integration.spec.ts`: troca de código com verifier correto (form-urlencoded) devolve acesso + refresh com `no-store`; verifier errado, `redirect_uri` divergente ou código expirado dão `invalid_grant`; código reutilizado dá `invalid_grant` e revoga a conexão; refresh rotaciona; refresh reutilizado revoga; `invalid_target`; `unsupported_grant_type`
- [X] T014 [P] [US1] Testes unitários do `cimd-fetcher` em `apps/api/src/management/mcp/oauth/cimd-fetcher.spec.ts`: só https, IP privado/loopback recusado, redirect recusado, timeout, tamanho máximo, `client_id` divergente, `redirect_uris` vazio
- [X] T015 [P] [US1] `apps/api/test/mcp-oauth-flow.e2e.spec.ts`: `Client` do SDK com `authProvider` de teste segue o 401, a descoberta e o authorize; o helper aprova com o JWT; a troca do código conecta e `tools/list` e `tools/call` funcionam para a loja aprovada; a renovação automática funciona após o acesso expirar

### Implementation for User Story 1

- [X] T016 [US1] `apps/api/src/management/mcp/oauth/well-known.controller.ts` (PRM nos dois caminhos + AS metadata, `Cache-Control` e CORS GET) e ajuste do 401 em `server/mcp-token.guard.ts` (`WWW-Authenticate` com `resource_metadata` e `scope`)
- [X] T017 [US1] `apps/api/src/management/mcp/oauth/cimd-fetcher.ts` (fetch seguro) e `oauth-client.service.ts` (resolver `client_id`: URL → CIMD com cache de 24h em `McpOAuthClient`; senão DCR existente)
- [X] T018 [US1] `apps/api/src/management/mcp/oauth/oauth-authorization.service.ts`: validar o pedido (ordem: cliente → redirect → demais parâmetros), criar o pedido pendente, calcular lojas elegíveis e permissão `mcp.connect` (role OWNER/ADMIN, master ou perfil do vínculo da loja), aprovar (conexão + código 60s + auditoria), negar (auditoria) e expirar
- [X] T019 [US1] `apps/api/src/management/mcp/oauth/oauth-authorize.controller.ts` (`GET /oauth/authorize`: 302 para a web ou para o redirect com erro, página 400 sem redirect) e `oauth-consent.controller.ts` (`GET /oauth/requests/:id`, `POST …/approve`, `POST …/deny` com `JwtAuthGuard`)
- [X] T020 [US1] `apps/api/src/management/mcp/oauth/oauth-token.service.ts` e `oauth-token.controller.ts` (`POST /oauth/token` form-urlencoded: `authorization_code` com PKCE e `resource`, `refresh_token` com rotação e detecção de reutilização; `POST /oauth/revoke`)
- [X] T021 [US1] `apps/api/src/management/mcp/oauth/oauth-credential.resolver.ts` (`rrf_oat_` → valida token, conexão, resource, MCP, loja, usuário ativo e acesso à loja → `McpRequestContext` com `connectionId`, `userId` e `clientName`) e integração em `server/mcp-token.guard.ts` (despacho por prefixo; recusas `DENIED` com motivo e `connectionId`)
- [X] T022 [US1] Atualizar `server/mcp-context.ts`, `server/mcp-rate-limit.guard.ts` (bucket `connectionId ?? tokenId`) e `server/mcp-call-log.service.ts` (`connectionId` no registro, `touchConnection` com throttle) e registrar os providers e controllers OAuth em `mcp.module.ts`
- [X] T023 [P] [US1] `apps/web/app/login/page.tsx`: aceitar `?next=` apenas para caminhos internos (começando com `/`, sem `//` nem esquema), com teste em `apps/web/app/login/login-next.spec.tsx`
- [X] T024 [US1] Tipos em `packages/types/src/mcp.ts` (pedido de consentimento, loja elegível, conexão) e funções em `apps/web/lib/api.ts` (`getMcpAuthorizationRequest`, `approveMcpAuthorization`, `denyMcpAuthorization`)
- [X] T025 [US1] Tela `apps/web/app/conectar/mcp/page.tsx` + `mcp-consent-client.tsx` (fora do shell admin; sem sessão → `/login?next=…`; aplicativo e domínio de retorno em destaque; aviso para cliente só-loopback; lista de lojas com áreas, pré-seleção quando há uma; Autorizar/Cancelar → `window.location.assign(redirectUrl)`; mensagens de `blockedReason`, pedido expirado e limite)
- [X] T026 [US1] Testes da tela em `apps/web/app/conectar/mcp/mcp-consent-client.spec.tsx` (sem permissão, sem loja, uma loja pré-selecionada, várias lojas, autorizar, cancelar, aviso de loopback, erro de limite)

**Checkpoint**: MVP. O Inspector e o Claude Code conectam só com a URL.

---

## Phase 4: User Story 2 - Mesmo endereço no ChatGPT (Priority: P1)

**Goal**: compatibilidade com DCR e com o comportamento do ChatGPT (redirect estável via `iss`)

**Independent Test**: quickstart §6 em produção

- [ ] T027 [P] [US2] `apps/api/test/mcp-oauth-register.integration.spec.ts`: DCR válido 201 (RFC 7591); redirect inválido `invalid_redirect_uri`; `token_endpoint_auth_method` ≠ `none` recusado; limite por IP; cliente DCR completa o fluxo do authorize
- [ ] T028 [US2] `apps/api/src/management/mcp/oauth/oauth-register.controller.ts` + `dto/oauth.dto.ts` (`POST /oauth/register` JSON, `client_id` `mcpc_…`, rate limit por IP com `FixedWindowRateLimitGuard`)
- [ ] T029 [US2] Teste em `mcp-oauth-flow.e2e.spec.ts` com duas conexões (dois clientes) para a mesma loja: revogar uma não afeta a outra

---

## Phase 5: User Story 3 - Ver e revogar conexões (Priority: P1)

**Goal**: lista "Conexões autorizadas", revogação, recusas por usuário/loja/MCP e log com origem OAuth

**Independent Test**: quickstart §7 itens 4–7, 9 e 10

### Tests for User Story 3

- [ ] T030 [P] [US3] `apps/api/test/mcp-oauth-isolation.e2e.spec.ts`: usuário com acesso às lojas A e B autoriza A e nenhuma resposta contém dados de B (SC-004); revogação, MCP desabilitado, loja inativa, usuário inativado e vínculo removido recusam com o mesmo 401 e registram `DENIED` com motivo; reabilitar o MCP restaura
- [ ] T031 [P] [US3] Casos em `apps/api/test/store-mcp-admin.integration.spec.ts`: `GET /admin/mcp/connections` só da loja ativa; revoke idempotente com auditoria `MCP_CONNECTION_REVOKED`; 404 para conexão de outra loja; uso com `clientName` e `userName`

### Implementation for User Story 3

- [ ] T032 [US3] `apps/api/src/management/mcp/admin/mcp-connections.service.ts` + rotas em `admin/store-mcp-admin.controller.ts` (listar; revogar com auditoria)
- [ ] T033 [US3] `admin/mcp-usage.service.ts`: incluir `connectionId`, `clientName` e `userName`; filtro existente por token mantido
- [ ] T034 [US3] Web: `apps/web/app/admin/settings/mcp/mcp-connections-table.tsx` (aplicativo, domínio, usuário, desde, último uso, status, revogar com confirmação) integrado em `mcp-settings-client.tsx`/`page.tsx`; coluna de origem em `mcp-usage-table.tsx`; testes em `mcp-settings-client.spec.tsx`
- [ ] T035 [US3] Rótulos dos eventos `MCP_CONNECTION_*` e `MCP_CLIENT_REJECTED` em `apps/web/app/admin/access-audit/access-audit-client.tsx`

---

## Phase 6: User Story 4 - Tokens da fase 1 continuam funcionando (Priority: P2)

**Goal**: não regressão e tela com "Conectar pelo endereço" como opção principal

- [ ] T036 [US4] Rodar e manter verdes as suítes da fase 1 (`mcp-protocol`, `mcp-token-auth`, `mcp-tenant-isolation`, `mcp-privacy`, `mcp-tools-parity`, `store-mcp-admin`), ajustando só a expectativa do header `WWW-Authenticate` (agora com `resource_metadata`)
- [ ] T037 [US4] Web: seção "Conectar pelo endereço" no topo de `mcp-settings-client.tsx` (URL do servidor com copiar + passo a passo para claude.ai/Desktop/mobile, Claude Code e ChatGPT) e "Tokens de acesso" como "Avançado"; testes

---

## Phase 7: Polish & Cross-Cutting

- [ ] T038 [P] `apps/api/src/management/mcp/oauth/oauth-retention.service.ts` (cron diário: pedidos expirados, tokens expirados há mais de 7 dias, clientes DCR sem conexão há 30 dias) com testes
- [ ] T039 [P] Documentação: `docs/USER_GUIDE.md` (seção 11.1: conectar pelo endereço no Claude e ChatGPT, revogar conexões), `docs/ARCHITECTURE.md` (10.1: servidor de autorização), regenerar `docs/DATA_DICTIONARY.md` (domínio MCP com os modelos OAuth em `scripts/generate-data-dictionary.mjs`)
- [ ] T040 Rodar `npm run typecheck`, `npm run lint` e as suítes completas de API e web; comparar com o baseline do `develop`
- [ ] T041 Roteiro do `quickstart.md`: local (Inspector, Claude Code) e produção (claude.ai, ChatGPT)

---

## Dependencies & Execution Order

- Setup (1) → Foundational (2) → US1 (3) → {US2 (4), US3 (5), US4 (6)} → Polish (7)
- US2, US3 e US4 dependem do fluxo de token e do guard da US1 e podem andar em paralelo entre si
- Dentro de cada story: testes → serviços → controllers → web

### Parallel Opportunities

- Foundational: T005–T008 em paralelo após T003/T004
- US1: testes T010–T015 em paralelo; T023 (login) em paralelo com o backend
- US3: T030/T031 em paralelo

## Implementation Strategy

1. **MVP (US1)**: descoberta, authorize, consentimento, token e guard. Validar localmente com Inspector e Claude Code.
2. **US3 antes do deploy**: revogação e recusas são requisito de segurança para produção.
3. **US2 + US4**: ChatGPT/DCR e tela com a opção principal nova.
4. **Deploy**: definir `WEB_PUBLIC_URL` e confirmar `MCP_PUBLIC_URL` no Render; validar claude.ai e ChatGPT (T041).
