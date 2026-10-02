# Implementation Plan: Conectores de IA com Login (OAuth) no MCP por Loja

**Branch**: `026-mcp-oauth-connectors` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-mcp-oauth-connectors/spec.md`

## Summary

Transformar o servidor MCP da fase 1 em recurso protegido OAuth 2.1 conforme a especificação MCP 2026-07-28, com um servidor de autorização embutido na própria API e baseado nas contas do RRFive OS.

- **Descoberta:** a API publica *Protected Resource Metadata* (RFC 9728) e *Authorization Server Metadata* (RFC 8414) em `/.well-known/*`, e o 401 do `/api/mcp` passa a apontar para eles.
- **Identificação do cliente:** clientes como claude.ai, Claude Code e ChatGPT se identificam por CIMD (preferencial) ou DCR (compatibilidade).
- **Autorização:** o usuário passa pelo `/api/oauth/authorize` e por uma tela web nova (`/conectar/mcp`). Lá faz login com a sessão do admin, escolhe uma loja elegível e consente.
- **Credenciais:** a troca usa PKCE S256 e devolve tokens opacos de acesso (1h) e renovação (30 dias, com rotação e detecção de reutilização), guardados como SHA-256.
- **Chamadas MCP:** o `McpTokenGuard` passa a aceitar os dois tipos de credencial e gera o mesmo contexto de loja. Tools, áreas, limites e log da fase 1 seguem iguais.
- **Tela MCP / IA:** ganha "Conectar pelo endereço" e "Conexões autorizadas" (listar e revogar).
- **Permissão:** nova, `mcp.connect`.

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20

**Primary Dependencies**: NestJS 10 (Express 4), Prisma 5, Next.js 14, `@modelcontextprotocol/sdk` (fase 1). Nenhuma dependência nova: PKCE, hashes e tokens usam `node:crypto`; o fetch de CIMD usa o `fetch` nativo do Node 20 com timeout e bloqueio de IP privado via `node:dns/promises` + `node:net`

**Storage**: PostgreSQL. Tabelas `mcp_oauth_clients`, `mcp_oauth_authorization_requests`, `mcp_oauth_connections`, `mcp_oauth_tokens`; coluna `connection_id` em `mcp_tool_calls`; 4 valores em `AccessAuditEventType`

**Testing**: Vitest. Módulo de teste focado + Prisma em memória (padrão da fase 1), supertest para os endpoints OAuth e o `Client` do SDK com um `OAuthClientProvider` de teste para o fluxo completo ponta a ponta. Web: Vitest + Harness

**Target Platform**: API e web no Render (HTTPS público); clientes Claude e ChatGPT

**Project Type**: Monorepo web (apps/api, apps/web, packages/database, packages/types)

**Performance Goals**: descoberta e token abaixo de 2s no p95 (os clientes desistem em 10s); validação de credencial com uma consulta por índice único

**Constraints**: sem estado em memória (fluxo todo persistido); `/.well-known/*` fora do prefixo `/api`; erros de `client_id`/`redirect_uri` nunca redirecionam; fetch de CIMD com proteção SSRF; tokens nunca em query string nem em logs; compatibilidade total com tokens `rrf_mcp_`

**Scale/Scope**: dezenas de lojas, até 20 conexões OAuth ativas por loja

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Real Operation First**: Pass. Remove o atrito real observado na validação da fase 1 (token incompleto, URL de outro ambiente) e habilita o uso pelo celular e pela web.
- **II. TypeScript Strict**: Pass. DTOs validados, incluindo o parsing do form-urlencoded do token endpoint; metadados CIMD validados com schema antes do uso.
- **III. Modular Monolith**: Pass. Submódulo `management/mcp/oauth` dentro do módulo MCP existente.
- **IV. Tenant Isolation**: Pass. A loja vem da conexão (escolhida no consentimento entre as lojas acessíveis ao usuário), nunca de parâmetro de tool. Testes de isolamento com usuário multi-loja (SC-004).
- **V. Tests Protect Operational Flow**: Pass. Testes de PKCE, rotação e reutilização de refresh, redirect não declarado, SSRF do CIMD, revogação, perda de acesso e compatibilidade com a fase 1.
- **Technical Standards (REST/OpenAPI, JWT)**: Justificado. Endpoints OAuth seguem RFCs (form-urlencoded, erros OAuth) e ficam documentados em `contracts/oauth.md`. Os endpoints admin continuam REST + OpenAPI. Os tokens OAuth são opacos, separados do JWT do admin, conforme a regra MCP de não repassar tokens.
- **Quality Gates**: Pass.

## Project Structure

### Documentation (this feature)

```text
specs/026-mcp-oauth-connectors/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── oauth.md
│   └── mcp-connections-admin.openapi.yaml
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/database/prisma/
├── schema.prisma                                       # +4 models, +3 enums, +AccessAuditEventType, McpToolCall.connectionId
├── migrations/20261002090000_mcp_oauth_connectors/
└── seed.ts                                             # +mcp.connect no catálogo e no perfil Admin da loja

apps/api/src/
├── main.ts                                             # setGlobalPrefix("api", { exclude: [".well-known/(.*)"] })
├── config/env.validation.ts                            # +WEB_PUBLIC_URL
├── management/access/permissions/permission-catalog.ts # +mcp.connect
└── management/mcp/
    ├── mcp.module.ts                                   # registra o submódulo oauth
    ├── oauth/
    │   ├── oauth-urls.ts                               # issuer, resource canônico, URLs de metadata e web
    │   ├── well-known.controller.ts                    # PRM + AS metadata
    │   ├── oauth-authorize.controller.ts               # GET /oauth/authorize, página de erro sem redirect
    │   ├── oauth-consent.controller.ts                 # GET/POST /oauth/requests/:id (JWT)
    │   ├── oauth-token.controller.ts                   # POST /oauth/token, /oauth/revoke
    │   ├── oauth-register.controller.ts                # POST /oauth/register (DCR)
    │   ├── oauth-client.service.ts                     # resolve cliente: CIMD (fetch + cache) ou DCR
    │   ├── cimd-fetcher.ts                             # fetch seguro (https, 5s, 64KB, sem redirect, anti-SSRF)
    │   ├── redirect-uri.ts                             # match exato; loopback com porta livre
    │   ├── oauth-authorization.service.ts              # pedidos, elegibilidade, aprovação, negação, códigos
    │   ├── oauth-token.service.ts                      # PKCE, emissão, rotação, reutilização, revogação
    │   ├── oauth-credential.resolver.ts                # rrf_oat_ → contexto da loja (usado pelo guard)
    │   ├── oauth-retention.service.ts                  # limpeza diária de pedidos, tokens e clientes DCR
    │   ├── oauth-errors.ts                             # erros OAuth padronizados
    │   └── dto/oauth.dto.ts
    ├── admin/mcp-connections.service.ts                # listar e revogar conexões
    ├── admin/store-mcp-admin.controller.ts             # +GET connections, +POST connections/:id/revoke
    ├── admin/mcp-usage.service.ts                      # +clientName/userName/connectionId
    └── server/
        ├── mcp-context.ts                              # +connectionId?, userId?, clientName?
        ├── mcp-token.guard.ts                          # dois tipos de credencial; 401 com resource_metadata
        ├── mcp-rate-limit.guard.ts                     # bucket por connectionId ?? tokenId
        └── mcp-call-log.service.ts                     # +connectionId, touchConnection

apps/api/test/
├── mcp-oauth-discovery.integration.spec.ts
├── mcp-oauth-authorize.integration.spec.ts
├── mcp-oauth-token.integration.spec.ts
├── mcp-oauth-register.integration.spec.ts
├── mcp-oauth-flow.e2e.spec.ts                          # SDK Client + OAuthClientProvider de teste
├── mcp-oauth-isolation.e2e.spec.ts                     # usuário multi-loja, revogação, perda de acesso
└── support/mcp-fake-prisma.ts                          # +modelos OAuth

apps/web/
├── app/conectar/mcp/page.tsx                           # tela de consentimento (fora do shell admin)
├── app/conectar/mcp/mcp-consent-client.tsx
├── app/conectar/mcp/mcp-consent-client.spec.tsx
├── app/login/page.tsx                                  # aceita ?next= (somente caminho interno)
├── app/admin/settings/mcp/mcp-settings-client.tsx      # "Conectar pelo endereço" + "Conexões autorizadas"
├── app/admin/settings/mcp/mcp-connections-table.tsx
├── app/admin/settings/mcp/mcp-usage-table.tsx          # coluna origem: token ou aplicativo/usuário
└── lib/api.ts                                          # +funções OAuth/consentimento/conexões
```

**Structure Decision**: submódulo `oauth/` dentro de `management/mcp`, separando o servidor de autorização (pedidos, tokens, clientes) do servidor de recurso (fase 1). Os dois se encontram em um único ponto: o `oauth-credential.resolver`, consumido pelo `McpTokenGuard`.

## Design

### Sequência

```text
Cliente MCP          API (/api/mcp, /.well-known, /api/oauth)       Web (/conectar/mcp)
    │ POST /api/mcp (sem token)
    │◄──── 401 WWW-Authenticate resource_metadata
    │ GET /.well-known/oauth-protected-resource ─► { resource, authorization_servers }
    │ GET /.well-known/oauth-authorization-server ─► { endpoints, cimd:true, S256 }
    │ navegador: GET /api/oauth/authorize?client_id=<url CIMD>&redirect_uri&code_challenge&state&resource
    │        └ valida cliente (fetch CIMD) + redirect → cria pedido → 302 ──────► /conectar/mcp?pedido=id
    │                                                       sessão? senão /login?next=… → GET requests/:id
    │                                                       Autorizar(storeId) → POST approve → redirectUrl
    │◄──────────────────────── 302 redirect_uri?code&state&iss ◄──────────────────┘
    │ POST /api/oauth/token (code + code_verifier) ─► access rrf_oat_ + refresh rrf_ort_
    │ POST /api/mcp  Authorization: Bearer rrf_oat_… ─► guard → contexto da loja → tools (fase 1)
```

### Pontos de segurança

- **PKCE**: `BASE64URL(SHA256(code_verifier)) == code_challenge`, com comparação em tempo constante.
- **Validação de `redirect_uri`**: string exata. Para loopback (`http://localhost` e `http://127.0.0.1`), comparação ignorando apenas a porta. Nunca redirecionar antes de validar cliente e redirect.
- **Fetch do CIMD**:
  - só `https:`;
  - resolve DNS e recusa IPs privados, loopback, link-local e ULA;
  - `redirect: "manual"`, timeout de 5s, limite de 64 KB;
  - o documento precisa ter `client_id` igual à URL e `redirect_uris` não vazio.
- **Tokens**: SHA-256 no banco. O prefixo distingue o tipo. `Cache-Control: no-store` no token endpoint. Os logs registram só `connectionId` e o nome do cliente.
- **Reutilização**: refresh rotacionado ou código já consumido reapresentado → revoga a conexão (`REFRESH_REUSE`/`CODE_REUSE`) e audita.
- **Consentimento**: o nome do cliente e o host do redirect ficam em destaque. Para clientes só com loopback, a tela mostra aviso extra (a especificação MCP recomenda).
- **CSRF no consentimento**: approve e deny exigem o JWT no header `Authorization` (não cookie), então uma página de terceiros não consegue aprovar.

### Compatibilidade com a fase 1

- `rrf_mcp_` segue o caminho atual do guard sem nenhuma mudança de comportamento.
- O 401 ganha apenas `resource_metadata` e `scope` no `WWW-Authenticate`; o corpo é idêntico.
- O log de uso ganha `connectionId`, e a tela mostra "Token: <nome>" ou "<Aplicativo> · <usuário>".

## Test Strategy

- **Unit**:
  - PKCE e redirect-uri (casos exato e loopback);
  - CIMD: validação de documento, IP privado, redirect, timeout e tamanho;
  - emissão e rotação de tokens;
  - elegibilidade de lojas (próprias, vínculos, master, MCP desabilitado, loja inativa).
- **Integração (supertest)**:
  - descoberta (`/.well-known` fora de `/api`, JSON conforme o contrato);
  - `/authorize`: cliente inválido e redirect não declarado sem redirecionar; PKCE ausente com redirect de erro; pedido criado e 302 para a web;
  - consentimento: permissão, loja inelegível, limite de 20, deny;
  - token: code válido, verifier errado, code reutilizado (revoga), refresh com rotação, refresh reutilizado (revoga), `invalid_target`, form-urlencoded;
  - DCR;
  - revoke.
- **E2E**: `Client` + `StreamableHTTPClientTransport` com `authProvider` de teste que segue o 401, a descoberta e o authorize; um helper aprova com o JWT. Depois chama tools e confere a loja.
- **Isolamento**: usuário com acesso às lojas A e B autoriza A, e nenhuma tool retorna dados de B. Revogação, MCP desabilitado, usuário inativado e vínculo removido derrubam a conexão.
- **Regressão**: suítes MCP da fase 1 (protocolo, auth, isolamento, privacidade), typecheck e lint.
- **Web**: tela de consentimento (sem permissão, sem loja, uma loja pré-selecionada, autorizar, cancelar, aviso de loopback); login com `next` seguro (recusa URL externa); tabela de conexões (revogar).

## Constitution Check - Post Design

Todos os gates aprovados. O isolamento por loja continua centralizado no guard; a única entrada de loja é a conexão, criada em consentimento autenticado.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Endpoints OAuth fora do padrão REST/OpenAPI | Os clientes (Claude, ChatGPT) exigem as RFCs OAuth/MCP (form-urlencoded, `/.well-known`) | Uma API REST própria não seria descoberta pelos conectores |
| Servidor de autorização próprio | A spec exige as contas do RRFive OS e consentimento por loja | IdP externo duplicaria usuários, permissões e o vínculo usuário–loja |
| Fetch externo do CIMD | Mecanismo preferido do protocolo e dos clientes; evita registros ilimitados | Só DCR acumula clientes e está obsoleto no protocolo |
