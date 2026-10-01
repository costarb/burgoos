# Implementation Plan: MCP Server por Loja para Análises com LLM

**Branch**: `025-store-mcp-server` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-store-mcp-server/spec.md`

## Summary

Expor um servidor MCP somente leitura em `POST /api/mcp`, autenticado por token opaco **de loja** (`rrf_mcp_…`, armazenado como SHA-256), para que clientes como Claude Code, Claude Desktop, Cursor e MCP Inspector consultem os números de uma loja e gerem análises. O servidor roda dentro da API NestJS usando o SDK oficial `@modelcontextprotocol/sdk` em modo Streamable HTTP **stateless**: a cada requisição, o `McpTokenGuard` resolve a loja pelo token, e um `McpServer` é montado só com as tools das áreas de dados liberadas. As 10 tools reaproveitam os services de relatório existentes (vendas, resumo diário, gerencial, DRE, dashboard, engenharia de cardápio, caixa, contas a pagar, estoque) e passam a saída por mappers allow-list, que garantem agregados compactos e nenhum dado pessoal. No admin, uma nova tela **Configuracoes → MCP / IA** permite habilitar o MCP, escolher áreas, gerar e revogar tokens com trechos de configuração prontos, e ver o log de uso. Mudanças de configuração vão para a auditoria de acessos existente. As chamadas vão para uma tabela própria com retenção de 90 dias.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 20

**Primary Dependencies**: NestJS 10 (Express 4), Prisma 5, Next.js 14 App Router, TailwindCSS. **Novas**: `@modelcontextprotocol/sdk` ^1.31 e `zod` ^3.25 (somente em `apps/api`)

**Storage**: PostgreSQL. Três tabelas novas (`store_mcp_configurations`, `store_mcp_tokens`, `mcp_tool_calls`), um enum novo e três valores novos em `AccessAuditEventType`

**Testing**: Vitest. Unit (token, mappers, catálogo de áreas), integração com `Test.createTestingModule(AppModule)` + supertest (padrão de `access-audit.integration.spec.ts`), e um teste e2e usando o `Client` + `StreamableHTTPClientTransport` do próprio SDK contra a app Nest. Web: Vitest + Harness existente

**Target Platform**: API no Render (papel `api`/`all`). Clientes MCP na máquina do usuário

**Project Type**: Monorepo web (apps/api + apps/web + packages/database)

**Performance Goals**: p95 < 3s por chamada de tool com período ≤ 31 dias (SC-005). Validação do token com uma consulta por índice único

**Constraints**: processo com memória limitada (`--max-old-space-size=384`): servidor stateless, sem sessão em memória, recusa sob `MemoryPressureService` HIGH/PEAK, timeout de 20s por tool, máximo de 92 dias por consulta, listas com no máximo 50 itens. Sem PII de cliente nas respostas. Revogação e desabilitação valem na próxima chamada

**Scale/Scope**: dezenas de lojas, até 10 tokens ativos por loja, 60 chamadas/min por token

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Real Operation First**: Pass. Entrega valor direto ao dono da loja (análise dos números reais) sem bloquear o fluxo do piloto. Escopo restrito à fase 1 (token, leitura).
- **II. TypeScript Strict**: Pass. Entradas das tools validadas por schemas zod. DTOs class-validator nos endpoints admin. Saídas com tipos explícitos via mappers.
- **III. Modular Monolith, Domain-Oriented**: Pass. Novo módulo `management/mcp` no domínio Management, consumindo services de Management e Operations por injeção, sem novo serviço ou processo.
- **IV. Tenant Isolation**: Pass, e é requisito central. A loja vem exclusivamente do token (admin: do JWT). Nenhuma tool aceita `storeId`. Todas as tabelas novas têm `tenant_id`. Testes de isolamento entre lojas cobrem todas as tools (SC-003).
- **V. Tests Protect Operational Flow**: Pass. Testes de autenticação, revogação, isolamento, paridade de números, ausência de PII e limite de taxa.
- **Product Scope ("AI assistant" deferred)**: Justificado. A spec 025 promove explicitamente o item, como prevê a governança. Não há assistente embutido: apenas exposição somente leitura para um cliente externo. Ver research R10.
- **Technical Standards ("REST with OpenAPI")**: Justificado. `/api/mcp` segue o protocolo MCP (JSON-RPC), exigido pelos clientes. Endpoints admin continuam REST + OpenAPI (`contracts/store-mcp-admin.openapi.yaml`). Ver Complexity Tracking.
- **Quality Gates**: Pass. spec, plan, data model e contratos explícitos. `tasks.md` na próxima etapa.

## Project Structure

### Documentation (this feature)

```text
specs/025-store-mcp-server/
├── spec.md
├── plan.md                          # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mcp-tools.md                 # tools, resources, prompts, erros
│   └── store-mcp-admin.openapi.yaml # endpoints da tela
├── checklists/requirements.md
└── tasks.md                         # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/database/prisma/
├── schema.prisma                                  # +StoreMcpConfiguration, StoreMcpToken, McpToolCall, enums
└── migrations/20261001090000_store_mcp_server/    # NOVO

apps/api/src/
├── app.module.ts                                  # importa McpModule
├── common/rate-limit/fixed-window-rate-limit.guard.ts   # + bucketKey(request) protegido (padrão: IP)
├── common/reporting/report-period.ts              # NOVO: parseDate/endOfDay/defaults extraídos dos controllers
├── config/env.validation.ts                       # + MCP_PUBLIC_URL, MCP_RATE_LIMIT_PER_MINUTE, MCP_TOOL_TIMEOUT_MS
├── management/access/permissions/permission-catalog.ts  # + mcp.manage
├── management/reports/financial-reports.controller.ts   # passa a usar report-period.ts (sem mudança de comportamento)
├── management/reports/menu-engineering.controller.ts    # idem
├── management/financial/cash-flow/cash-flow.controller.ts # idem
└── management/mcp/                                # NOVO módulo
    ├── mcp.module.ts
    ├── mcp-data-areas.ts                          # catálogo área → tools/rótulos/descrições
    ├── admin/
    │   ├── store-mcp-admin.controller.ts          # /admin/mcp/configuration|tokens|usage
    │   ├── store-mcp-configuration.service.ts
    │   ├── store-mcp-token.service.ts             # gerar/hash/listar/revogar/limite 10
    │   ├── mcp-usage.service.ts                   # consulta paginada do log
    │   ├── mcp-snippets.ts                        # trechos Inspector/Claude Code/Desktop/Cursor
    │   └── dto/store-mcp.dto.ts
    ├── server/
    │   ├── mcp.controller.ts                      # POST/GET/DELETE /mcp
    │   ├── mcp-token.guard.ts                     # resolve loja, recusas 401 genéricas
    │   ├── mcp-rate-limit.guard.ts                # bucket por tokenId
    │   ├── mcp-server.factory.ts                  # monta McpServer por requisição conforme áreas
    │   ├── mcp-tool-runner.ts                     # timeout, memory pressure, log, erros → isError
    │   ├── mcp-call-log.service.ts                # grava McpToolCall, throttle de lastUsedAt
    │   └── mcp-call-retention.service.ts          # cron diário, apaga > 90 dias (papel worker/all)
    ├── tools/
    │   ├── sales.tools.ts                         # resumo_vendas, resumo_diario, relatorio_gerencial
    │   ├── financial.tools.ts                     # dre, dashboard_financeiro
    │   ├── menu.tools.ts                          # engenharia_cardapio
    │   ├── cash.tools.ts                          # posicao_caixa, extrato_caixa
    │   ├── payables.tools.ts                      # contas_a_pagar
    │   ├── inventory.tools.ts                     # estoque
    │   └── tool-output.ts                         # periodo, Reais, truncamento, semMovimento
    ├── resources/{store-profile.resource.ts, metrics-glossary.resource.ts, glossary.md}
    └── prompts/analysis.prompts.ts

apps/api/test/
├── mcp-token-auth.integration.spec.ts             # 401/revogação/expiração/desabilitado/loja inativa
├── mcp-tenant-isolation.e2e.spec.ts               # token A nunca vê B, todas as tools
├── mcp-tools-parity.integration.spec.ts           # tool == service para os mesmos parâmetros
├── mcp-privacy.spec.ts                            # varredura de chaves proibidas nas respostas
├── mcp-protocol.e2e.spec.ts                       # Client do SDK: initialize, list, call, resources, prompts
└── store-mcp-admin.integration.spec.ts            # permissão, limite de 10, áreas vazias, auditoria

apps/web/
├── components/admin/admin-navigation.ts           # + item "MCP / IA" (Configuracoes, mcp.manage)
├── lib/api.ts                                     # + funções /admin/mcp/*
└── app/admin/settings/mcp/
    ├── page.tsx
    ├── mcp-settings-client.tsx                    # toggle, áreas, tokens, aba Uso
    ├── mcp-token-created-dialog.tsx               # token uma única vez + trechos com copiar
    ├── mcp-usage-table.tsx
    └── mcp-settings-client.spec.tsx
```

**Structure Decision**: módulo único `management/mcp` com três camadas internas (admin, server, tools), seguindo a organização por domínio já usada em `management/sales-integrations`. As tools dependem dos services existentes via injeção (Management e Operations exportam os services necessários; onde não exportam, o export é adicionado). Nenhuma regra de cálculo é duplicada.

## Design

### Fluxo de uma chamada

```text
POST /api/mcp ─► McpTokenGuard ─► McpRateLimitGuard ─► McpController
                  │ hash→token→config→tenant            │
                  │ falha: 401 genérico (+log DENIED     ├─ McpServerFactory.build(ctx)  (tools das áreas)
                  │        se o token for conhecido)     ├─ new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
                  ▼                                      ├─ server.connect(transport); transport.handleRequest(req, res, req.body)
           req.mcpContext = { tenantId, tokenId,         └─ res.on("close") → transport.close(); server.close()
                              enabledAreas, storeName }
```

`McpToolRunner.run(ctx, toolName, args, fn)` envolve cada handler: checa a pressão de memória, aplica o timeout, converte `BadRequestException` em `INVALID_PERIOD`/`PERIOD_TOO_LONG`, converte erros em `isError: true` com a mensagem do contrato, mede a duração e grava o log em fire-and-forget.

O controller usa `@Res()` e não passa pelo `ValidationPipe` (o body é JSON-RPC, validado pelo SDK). Fica excluído do Swagger com `@ApiExcludeController()`.

### Token

- Geração: `rrf_mcp_` + `randomBytes(32).toString("base64url")`. Persistência: `sha256` hex e prefixo de 14 caracteres. Retornado em claro apenas no `201`.
- Revogação idempotente. Contagem de ativos (`revokedAt null AND (expiresAt null OR > now)`) verificada em transação antes de inserir.
- `lastUsedAt`: atualizado se `null` ou se tiver mais de 60s (`updateMany where lastUsedAt < now-60s`), evitando uma escrita por chamada.

### Admin

- `StoreMcpAdminController` em `admin/mcp`, com `JwtAuthGuard` + `PermissionGuard` + `@RequirePermission("mcp.manage")`, loja = `user.tenantId`.
- `PUT configuration`: valida áreas não vazias quando `enabled`, faz upsert e registra `MCP_CONFIGURATION_CHANGED` com `metadata { before, after }`.
- `POST tokens`: exige o MCP habilitado (`409 MCP_DISABLED`), aplica o limite de 10 (`409 TOKEN_LIMIT_REACHED`), registra `MCP_TOKEN_CREATED` (metadata: id, nome, prefixo, validade; nunca o token).
- `GET configuration` retorna `serverUrl` (`MCP_PUBLIC_URL` ou derivado da requisição) e o catálogo de áreas para a tela.

### Web

- Página server component carrega a configuração, tokens e a primeira página do log. O client component faz as ações via `lib/api.ts` com o token admin, seguindo o padrão de `integrations/delivery`.
- Layout: cabeçalho com estado e toggle; cartão "Áreas de dados" (switches com descrição e tools); cartão "Tokens" (tabela com status, último uso, gerado por, revogar com `confirmation-dialog`); aba "Uso" (tabela paginada com filtros por token, período e resultado).
- `mcp-token-created-dialog`: token em destaque com botão copiar, aviso "não será exibido novamente" e abas Inspector / Claude Code / Claude Desktop / Cursor, cada uma com o trecho e botão copiar.
- Menu: item "MCP / IA" no grupo de Configurações, `permissions: ["mcp.manage"]`.

## Test Strategy

- **Unit**: geração/hash/prefixo do token; estado derivado (ATIVO/EXPIRADO/REVOGADO); catálogo de áreas → tools; `tool-output` (truncamento em 50, `semMovimento`, arredondamento `Reais`); cada mapper com fixture contendo campos de PII, garantindo que eles são descartados; `mcp-snippets`.
- **Integração (supertest + AppModule)**: `401` para ausente, malformado, desconhecido, revogado, expirado, MCP desabilitado e loja inativa, com corpo idêntico em todos; `DENIED` gravado só para tokens conhecidos; `429` após o limite; admin com `mcp.manage` vs. sem permissão vs. platform admin; limite de 10; áreas vazias; auditoria registrada.
- **Paridade (SC-002)**: para cada tool, chamar o service com os mesmos parâmetros e comparar os agregados com o `structuredContent`.
- **Protocolo e isolamento (e2e)**: `Client` do SDK com `StreamableHTTPClientTransport` contra a app escutando em porta efêmera: `initialize`, `tools/list` (respeita áreas), `tools/call` de todas as tools, `resources/read`, `prompts/list`/`get`. Duas lojas no banco de teste: todas as tools com o token A, verificando que nenhum id ou nome da loja B aparece.
- **Privacidade (SC-006)**: varredura recursiva de todas as respostas do e2e buscando as chaves proibidas e a regex de `redact`.
- **Web**: render da tela por estado (desabilitado, habilitado sem tokens, com tokens), diálogo exibindo o token uma vez, revogação com confirmação, validação de áreas.
- **Regressão**: suítes existentes de relatórios e caixa (refactor de `report-period.ts`), `typecheck`, `lint`.

## Constitution Check - Post Design

Todos os gates permanecem aprovados. O desenho mantém o isolamento por loja na camada de autenticação (token → loja), não introduz processo nem estado em memória entre requisições, e reaproveita 100% das regras de cálculo existentes. Os dois desvios (promoção de "AI assistant" e endpoint não-REST) estão justificados abaixo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Endpoint `/api/mcp` fora do padrão REST/OpenAPI | Clientes MCP (Claude, Cursor, Inspector) só falam o protocolo MCP (JSON-RPC 2.0 sobre Streamable HTTP) | Expor só REST exigiria um adaptador MCP instalado na máquina do usuário e não funcionaria com os clientes de forma nativa |
| Item "AI assistant" do *Explicitly Deferred* | Pedido explícito do produto (spec 025), promovido como a governança permite | Não fazer impediria o objetivo da feature. O escopo foi reduzido a leitura via cliente externo, sem LLM embutido |
| Duas dependências novas (`@modelcontextprotocol/sdk`, `zod`) | Implementação oficial do protocolo; zod é peer dependency obrigatória do SDK | JSON-RPC/MCP manual seria mais código, mais frágil e sem acompanhar a evolução da especificação |
