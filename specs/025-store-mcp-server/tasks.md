# Tasks: MCP Server por Loja para Análises com LLM

**Input**: Design documents from `/specs/025-store-mcp-server/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-tools.md, contracts/store-mcp-admin.openapi.yaml, quickstart.md

**Tests**: Incluídos. A spec exige testes automatizados de isolamento (SC-003), privacidade (SC-006) e paridade (SC-002), e a constituição exige testes de isolamento entre lojas.

**Organization**: tarefas agrupadas por user story, para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: user story da spec (US1–US5)

---

## Phase 1: Setup

**Purpose**: dependências e configuração de ambiente

- [X] T001 Adicionar `@modelcontextprotocol/sdk@^1.31` e `zod@^3.25` às dependências de `apps/api/package.json` e rodar `npm install` na raiz
- [X] T002 [P] Adicionar `MCP_PUBLIC_URL` (opcional, URL), `MCP_RATE_LIMIT_PER_MINUTE` (padrão 60) e `MCP_TOOL_TIMEOUT_MS` (padrão 20000) em `apps/api/src/config/env.validation.ts`, com casos em `apps/api/src/config/env.validation.spec.ts`
- [X] T003 [P] Documentar as três variáveis novas em `.env.example` e `apps/api/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modelo de dados, permissão, catálogo de áreas e utilitários compartilhados

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase

- [X] T004 Adicionar ao `packages/database/prisma/schema.prisma` os enums `McpDataArea` e `McpToolCallResult`, os valores `MCP_CONFIGURATION_CHANGED`, `MCP_TOKEN_CREATED` e `MCP_TOKEN_REVOKED` em `AccessAuditEventType`, os models `StoreMcpConfiguration`, `StoreMcpToken` e `McpToolCall` (campos, índices e `@@map` conforme data-model.md) e as relações inversas em `Tenant` e `User`
- [X] T005 Gerar a migration `packages/database/prisma/migrations/20261001090000_store_mcp_server/migration.sql` com `npm run db:migrate` e conferir o SQL (índices únicos `tenant_id` e `token_hash`, índice de retenção em `occurred_at`); rodar `npm run db:generate`
- [X] T006 [P] Adicionar a permissão `mcp.manage` (área "Integracoes", tela "MCP / IA", ação `MANAGE`, `sensitive: true`) em `apps/api/src/management/access/permissions/permission-catalog.ts` e atualizar o teste de catálogo existente, se houver contagem fixa
- [X] T007 [P] Criar `apps/api/src/management/mcp/mcp-data-areas.ts` com o catálogo `McpDataArea → { label, description, tools[] }` e helpers `toolsForAreas(areas)` e `areaOfTool(name)`, com testes em `apps/api/src/management/mcp/mcp-data-areas.spec.ts`
- [X] T008 [P] Extrair `parseDate`, `endOfDay`, `addDays`, `firstDayOfCurrentMonth` e `lastDayOfCurrentMonth` para `apps/api/src/common/reporting/report-period.ts`, com testes em `apps/api/src/common/reporting/report-period.spec.ts`
- [X] T009 Substituir as funções locais de data por `report-period.ts` em `apps/api/src/management/reports/financial-reports.controller.ts`, `apps/api/src/management/reports/menu-engineering.controller.ts` e `apps/api/src/management/financial/cash-flow/cash-flow.controller.ts`, sem mudança de comportamento (rodar as suítes `dre`, `menu-engineering` e `cash-flow` existentes)
- [X] T010 [P] Criar `apps/api/src/management/mcp/admin/mcp-token.util.ts` (gerar `rrf_mcp_` + 32 bytes base64url, `hashToken` SHA-256 hex, `tokenPrefix` de 14 caracteres, `tokenStatus(token, now)` ATIVO/EXPIRADO/REVOGADO), com testes em `apps/api/src/management/mcp/admin/mcp-token.util.spec.ts`
- [X] T011 Criar `apps/api/src/management/mcp/mcp.module.ts` (imports: DatabaseModule, módulos que proveem os services de relatório, caixa, contas a pagar e estoque, ObservabilityModule) e registrá-lo em `apps/api/src/app.module.ts`; adicionar `exports` dos services necessários em `apps/api/src/management/management.module.ts` e `apps/api/src/operations/operations.module.ts` onde ainda faltarem

**Checkpoint**: schema migrado, permissão e catálogo prontos. As user stories podem começar.

---

## Phase 3: User Story 1 - Habilitar o MCP da loja e gerar um token (Priority: P1) 🎯 MVP

**Goal**: administrador habilita o MCP, escolhe áreas (padrão todas), gera, lista e revoga tokens com trechos de configuração prontos

**Independent Test**: no admin da loja, abrir Configuracoes → MCP / IA, habilitar, gerar token e ver o valor uma única vez junto dos trechos para Inspector, Claude Code, Claude Desktop e Cursor (quickstart §2)

### Tests for User Story 1

- [X] T012 [P] [US1] Teste de integração em `apps/api/test/store-mcp-admin.integration.spec.ts`: `GET configuration` padrão desabilitado; `PUT` habilita e audita `MCP_CONFIGURATION_CHANGED`; `POST tokens` exige MCP habilitado (`409 MCP_DISABLED`), retorna o token só no `201` e nunca no `GET`; limite de 10 ativos (`409 TOKEN_LIMIT_REACHED`); revogação idempotente com auditoria; `403` sem `mcp.manage`; `403` para platform admin; master opera somente sobre a loja ativa
- [X] T013 [P] [US1] Testes unitários de `apps/api/src/management/mcp/admin/mcp-snippets.spec.ts` (URL e token aplicados nos 4 trechos, JSON válido para Desktop e Cursor)

### Implementation for User Story 1

- [X] T014 [P] [US1] Criar DTOs `UpdateMcpConfigurationDto`, `CreateMcpTokenDto` (nome 1–80, `expiresInDays` ∈ {30, 90, 365, null}) e `McpUsageQueryDto` em `apps/api/src/management/mcp/admin/dto/store-mcp.dto.ts`
- [X] T015 [P] [US1] Criar `apps/api/src/management/mcp/admin/mcp-snippets.ts` com a geração dos trechos Inspector, Claude Code (`claude mcp add --transport http …`), Claude Desktop (`mcp-remote`) e Cursor (`url` + `headers`)
- [X] T016 [US1] Implementar `apps/api/src/management/mcp/admin/store-mcp-configuration.service.ts`: `get(tenantId)` (padrão desabilitado + catálogo de áreas + `serverUrl`), `update(user, dto)` com upsert, validação de áreas não vazias (`400 AREAS_REQUIRED`) e `AccessAuditService.record` com `before/after`
- [X] T017 [US1] Implementar `apps/api/src/management/mcp/admin/store-mcp-token.service.ts`: `list(tenantId)`, `create(user, dto, serverUrl)` (transação: MCP habilitado, contagem de ativos < 10, insere hash e prefixo, audita `MCP_TOKEN_CREATED` sem o segredo, retorna token + snippets) e `revoke(user, id)` (escopo por `tenantId`, `404` para outra loja, audita `MCP_TOKEN_REVOKED`)
- [X] T018 [US1] Criar `apps/api/src/management/mcp/admin/store-mcp-admin.controller.ts` (`admin/mcp/configuration` GET/PUT, `admin/mcp/tokens` GET/POST, `admin/mcp/tokens/:id/revoke` POST) com `JwtAuthGuard`, `PermissionGuard` e `@RequirePermission("mcp.manage")`, derivando `serverUrl` de `MCP_PUBLIC_URL` ou da requisição; registrar no `McpModule`
- [X] T019 [P] [US1] Adicionar tipos e funções `getMcpConfiguration`, `updateMcpConfiguration`, `listMcpTokens`, `createMcpToken` e `revokeMcpToken` em `apps/web/lib/api.ts` (tipos compartilhados em `packages/types/src` se for o padrão das outras integrações)
- [X] T020 [P] [US1] Adicionar o item "MCP / IA" (`/admin/settings/mcp`, ícone `Bot` ou `Sparkles`, `permissions: ["mcp.manage"]`) no grupo de configurações de `apps/web/components/admin/admin-navigation.ts`
- [X] T021 [US1] Criar `apps/web/app/admin/settings/mcp/page.tsx` (server component, carrega configuração e tokens, `PermissionGate`) e `apps/web/app/admin/settings/mcp/mcp-settings-client.tsx` (cabeçalho com estado e toggle, explicação curta, tabela de tokens com status, último uso, gerado por e revogar via `confirmation-dialog`, formulário de novo token)
- [X] T022 [US1] Criar `apps/web/app/admin/settings/mcp/mcp-token-created-dialog.tsx`: token em destaque, botão copiar, aviso "não será exibido novamente", abas com os 4 trechos e botão copiar em cada um
- [X] T023 [US1] Testes da tela em `apps/web/app/admin/settings/mcp/mcp-settings-client.spec.tsx`: estado desabilitado, habilitar, gerar token (diálogo mostra token e trechos; após fechar, só o prefixo), revogar com confirmação, erro de limite de 10

**Checkpoint**: US1 funcional. Tokens podem ser gerados e gerenciados.

---

## Phase 4: User Story 2 - Consultar os números da loja a partir de um assistente de IA (Priority: P1)

**Goal**: `POST /api/mcp` autenticado pelo token, com 10 tools, 2 resources e 4 prompts retornando os mesmos números das telas, sem PII

**Independent Test**: MCP Inspector conectado com o token da US1, listar as tools, executar `resumo_vendas` e `dre` de setembro e comparar com as telas (quickstart §3); pergunta livre no Claude Code (quickstart §4)

### Tests for User Story 2

- [X] T024 [P] [US2] Teste e2e de protocolo em `apps/api/test/mcp-protocol.e2e.spec.ts` usando `Client` + `StreamableHTTPClientTransport` do SDK contra a app Nest em porta efêmera: `initialize`, `tools/list` (10 tools, descrições em português), `tools/call` de cada tool, `resources/list|read`, `prompts/list|get`; `GET`/`DELETE` → `405`
- [X] T025 [P] [US2] Teste de paridade em `apps/api/test/mcp-tools-parity.integration.spec.ts`: para cada tool, comparar os agregados do `structuredContent` com a saída do service correspondente para os mesmos parâmetros (incluindo período padrão)
- [X] T026 [P] [US2] Testes unitários dos mappers em `apps/api/src/management/mcp/tools/tools.spec.ts`: fixtures com campos de cliente (`customerName`, `phone`, `address`, `document`, `email`) e de segredo são descartadas; truncamento em 50 com `truncado`/`totalItens`; `semMovimento`; arredondamento `Reais`; `periodo.padraoAplicado`
- [X] T027 [P] [US2] Testes de período em `apps/api/src/management/mcp/server/mcp-tool-runner.spec.ts`: início > fim → `INVALID_PERIOD`; > 92 dias → `PERIOD_TOO_LONG`; timeout → `TIMEOUT`; pressão de memória HIGH → `MEMORY_PRESSURE`; erro inesperado → `INTERNAL` sem vazar a mensagem

### Implementation for User Story 2

- [X] T028 [US2] Criar `apps/api/src/management/mcp/server/mcp-token.guard.ts`: extrai `Bearer rrf_mcp_…`, busca por `tokenHash` com `include` de configuração e tenant, valida revogação, expiração, `enabled`, `Tenant.active`/`deactivatedAt`; em sucesso popula `req.mcpContext { tenantId, tokenId, enabledAreas, storeName, storeSlug }`; em falha responde `401` genérico com `WWW-Authenticate: Bearer` (corpo conforme contracts/mcp-tools.md)
- [X] T029 [P] [US2] Criar `apps/api/src/management/mcp/tools/tool-output.ts` (helpers `periodo`, `reais`, `percentual`, `truncate(list, 50)`, `semMovimento`, `toToolResult(structured)` com `structuredContent` + bloco `text`)
- [X] T030 [US2] Criar `apps/api/src/management/mcp/server/mcp-tool-runner.ts`: checa `MemoryPressureService`, aplica timeout `MCP_TOOL_TIMEOUT_MS`, mapeia `BadRequestException`/`assertInteractivePeriod` para os códigos do contrato, retorna `isError: true` com mensagem em português e expõe um hook `onFinish(ctx, call)` para o log (implementado na US5)
- [X] T031 [P] [US2] Implementar `apps/api/src/management/mcp/tools/sales.tools.ts`: `resumo_vendas` (`parseSalesReportQuery` + `SalesReportService.getReport`, sem pedidos individuais), `resumo_diario` (`ReportsService.getDailySummary`) e `relatorio_gerencial` (`parseManagementReportQuery` + `ManagementReportService.getReport`), com schemas zod e mappers allow-list
- [X] T032 [P] [US2] Implementar `apps/api/src/management/mcp/tools/financial.tools.ts`: `dre` (`DreService.getSummary`, padrão mês corrente via `report-period.ts`) e `dashboard_financeiro` (`FinancialDashboardService.getIndicators`)
- [X] T033 [P] [US2] Implementar `apps/api/src/management/mcp/tools/menu.tools.ts`: `engenharia_cardapio` (`MenuEngineeringService.getReport`, filtro `classificacao` STAR/WORKHORSE/PUZZLE/DOG, top 50 por faturamento, contagem por classificação)
- [X] T034 [P] [US2] Implementar `apps/api/src/management/mcp/tools/cash.tools.ts`: `posicao_caixa` (`CashFlowService.getPosition`, sem `ledger` detalhado, projeção máx. 92 dias) e `extrato_caixa` (`CashFlowService.getStatement`, agregado por categoria/dia, sem descrições livres)
- [X] T035 [P] [US2] Implementar `apps/api/src/management/mcp/tools/payables.tools.ts`: `contas_a_pagar` (`AccountsPayableService.list` com `pageSize` 50, padrão hoje-30..hoje+30, totais por categoria e fornecedor, sem dados bancários e documentos)
- [X] T036 [P] [US2] Implementar `apps/api/src/management/mcp/tools/inventory.tools.ts`: `estoque` (`InventoryService.listBalances`, críticos primeiro, totais por situação)
- [X] T037 [P] [US2] Criar resources `apps/api/src/management/mcp/resources/store-profile.resource.ts` (`rrfive://loja/perfil`: nome, slug, fuso, plataformas, meios de pagamento, instituições, áreas liberadas) e `apps/api/src/management/mcp/resources/metrics-glossary.resource.ts` + `glossary.md` (`rrfive://glossario`)
- [X] T038 [P] [US2] Criar `apps/api/src/management/mcp/prompts/analysis.prompts.ts` com `analise_semanal`, `comparar_periodos`, `diagnostico_margem_cardapio` e `saude_caixa_30_dias`, cada um declarando as áreas exigidas
- [X] T039 [US2] Criar `apps/api/src/management/mcp/server/mcp-server.factory.ts`: `build(ctx)` cria `McpServer({ name: "rrfive-os", version }, { instructions })` e registra só as tools, resources e prompts permitidos por `ctx.enabledAreas`, cada handler passando pelo `McpToolRunner`
- [X] T040 [US2] Criar `apps/api/src/management/mcp/server/mcp.controller.ts` (`@Controller("mcp")`, `@ApiExcludeController()`, `@UseGuards(McpTokenGuard)`): `POST` monta o servidor e um `StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, chama `handleRequest(req, res, req.body)` e fecha ambos em `res.on("close")`; `GET`/`DELETE` → `405`; registrar no `McpModule`

**Checkpoint**: US1 + US2 entregam o MVP testável com o roteiro do quickstart §2–4.

---

## Phase 5: User Story 3 - Isolamento entre lojas e revogação imediata (Priority: P1)

**Goal**: garantir por testes e limite de taxa que um token só acessa a sua loja e que revogar ou desabilitar corta o acesso na próxima chamada

**Independent Test**: tokens das lojas A e B; todas as tools com o token A sem dados da B; revogar → `401`; desabilitar → `401`; reabilitar → volta (quickstart §5)

### Tests for User Story 3

- [X] T041 [P] [US3] Teste e2e em `apps/api/test/mcp-tenant-isolation.e2e.spec.ts`: banco de teste com duas lojas e dados distintos; chamar todas as tools e resources com o token A e verificar que nenhum id, nome de produto, plataforma ou valor da loja B aparece; confirmar que nenhuma tool aceita parâmetro de loja (schemas sem `storeId`/`tenantId`)
- [X] T042 [P] [US3] Teste de integração em `apps/api/test/mcp-token-auth.integration.spec.ts`: `401` com corpo idêntico para ausente, malformado, desconhecido, revogado, expirado, MCP desabilitado, loja inativa; reabilitar o MCP restaura tokens válidos; revogar durante uso bloqueia a chamada seguinte; tool de área desligada não é listada e a chamada direta retorna `AREA_DISABLED`
- [X] T043 [P] [US3] Teste de privacidade em `apps/api/test/mcp-privacy.spec.ts`: varredura recursiva das respostas de todas as tools e resources buscando chaves proibidas (`customer`, `phone`, `address`, `document`, `cpf`, `cnpj`, `email`, `token`, `secret`) e aplicando a regex de `IntegrationSecretService.redact`

### Implementation for User Story 3

- [X] T044 [US3] Adicionar o método protegido `bucketKey(request)` (padrão: IP, comportamento atual inalterado) em `apps/api/src/common/rate-limit/fixed-window-rate-limit.guard.ts`
- [X] T045 [US3] Criar `apps/api/src/management/mcp/server/mcp-rate-limit.guard.ts` estendendo `FixedWindowRateLimitGuard` com `bucketKey = mcp:<tokenId>` e `limit = MCP_RATE_LIMIT_PER_MINUTE`; aplicar depois do `McpTokenGuard` em `mcp.controller.ts`; teste de `429` em `apps/api/test/mcp-token-auth.integration.spec.ts`
- [X] T046 [US3] Em `mcp-token.guard.ts`, distinguir internamente o motivo da recusa (`TOKEN_REVOKED`, `TOKEN_EXPIRED`, `MCP_DISABLED`, `STORE_INACTIVE`) mantendo a resposta externa idêntica, e expor o motivo para o log (US5)

**Checkpoint**: requisito de segurança da feature coberto. Bloqueante para produção.

---

## Phase 6: User Story 4 - Escolher quais áreas de dados ficam visíveis (Priority: P2)

**Goal**: administrador liga e desliga áreas na tela e o MCP reflete isso na próxima conexão

**Independent Test**: desligar "Estoque", reconectar o Inspector e confirmar que `estoque` some da lista (quickstart §5, item 4)

### Tests for User Story 4

- [X] T047 [P] [US4] Em `apps/api/test/store-mcp-admin.integration.spec.ts`: `PUT` com `enabledAreas: []` e `enabled: true` → `400 AREAS_REQUIRED`; auditoria com `before/after` das áreas
- [X] T048 [P] [US4] Em `apps/api/test/mcp-protocol.e2e.spec.ts`: com áreas `[SALES]`, `tools/list` retorna só as 3 tools de vendas e `prompts/list` só `analise_semanal`

### Implementation for User Story 4

- [X] T049 [US4] Adicionar o cartão "Áreas de dados" em `apps/web/app/admin/settings/mcp/mcp-settings-client.tsx` (switch por área com rótulo, descrição e tools vindos de `availableAreas`; bloqueio e mensagem ao tentar desligar a última área com o MCP habilitado) e casos correspondentes em `mcp-settings-client.spec.tsx`

**Checkpoint**: controle granular de exposição disponível.

---

## Phase 7: User Story 5 - Acompanhar o uso do MCP (Priority: P2)

**Goal**: cada chamada de tool, resource ou prompt e cada recusa de token conhecido aparecem no log da tela; `lastUsedAt` atualizado; retenção de 90 dias

**Independent Test**: executar tools pelo Inspector e ver as chamadas na aba Uso, com filtros, e as recusas como "Recusada" (quickstart §6)

### Tests for User Story 5

- [X] T050 [P] [US5] Testes unitários em `apps/api/src/management/mcp/server/mcp-call-log.service.spec.ts`: argumentos truncados em 1 KB; só argumentos declarados; throttle de `lastUsedAt` (uma escrita por minuto); falha ao gravar o log não quebra a resposta
- [X] T051 [P] [US5] Testes em `apps/api/src/management/mcp/server/mcp-call-retention.service.spec.ts`: apaga só registros > 90 dias, em lotes, apenas no papel `worker`/`all`
- [X] T052 [P] [US5] Em `apps/api/test/store-mcp-admin.integration.spec.ts`: `GET admin/mcp/usage` paginado, filtros `tokenId`/`start`/`end`/`result`, escopo por loja; recusa de token desconhecido não gera registro

### Implementation for User Story 5

- [X] T053 [US5] Implementar `apps/api/src/management/mcp/server/mcp-call-log.service.ts` (`record(ctx, call)` fire-and-forget em `mcp_tool_calls`; `touchToken(tokenId)` com `updateMany where lastUsedAt null or < now-60s`) e ligá-lo ao `onFinish` do `McpToolRunner` e às recusas `DENIED` do `McpTokenGuard`/`McpRateLimitGuard`
- [X] T054 [US5] Implementar `apps/api/src/management/mcp/server/mcp-call-retention.service.ts` (`@Cron` diário, `RuntimeRoleService`, lotes de `RETENTION_BATCH_SIZE`) e registrá-lo no `McpModule`
- [X] T055 [US5] Implementar `apps/api/src/management/mcp/admin/mcp-usage.service.ts` e a rota `GET admin/mcp/usage` em `store-mcp-admin.controller.ts` (contracts/store-mcp-admin.openapi.yaml)
- [X] T056 [US5] Adicionar `getMcpUsage` em `apps/web/lib/api.ts`, criar `apps/web/app/admin/settings/mcp/mcp-usage-table.tsx` (tabela paginada com filtros por token, período e resultado; badge "Recusada") e a aba "Uso" em `mcp-settings-client.tsx`, com casos em `mcp-settings-client.spec.tsx`
- [X] T057 [US5] Exibir rótulos legíveis para os eventos `MCP_*` na tela de auditoria de acessos (`apps/web/app/admin/access-audit/access-audit-client.tsx`)

**Checkpoint**: todas as user stories funcionais.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T058 [P] Adicionar a seção "MCP / IA" em `docs/USER_GUIDE.md` (habilitar, gerar token, configurar clientes, revogar) e o módulo `management/mcp` em `docs/ARCHITECTURE.md`; tabelas novas em `docs/DATA_DICTIONARY.md`
- [X] T059 [P] Logs estruturados no `McpTokenGuard` e no `McpToolRunner` (tenantId, tokenPrefix, tool, resultado, duração; nunca o token) seguindo `common/observability`
- [ ] T060 Rodar `npm run typecheck`, `npm run lint` e `npm run test` na raiz e corrigir regressões
- [ ] T061 Executar o roteiro completo de `specs/025-store-mcp-server/quickstart.md` (Inspector + Claude Code) e registrar o resultado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** → user stories
- **US1 (3)**: depende só da Foundational
- **US2 (4)**: depende da Foundational e, para teste manual, de tokens gerados na US1 (os testes automatizados criam tokens direto no banco, então a implementação pode andar em paralelo com a US1)
- **US3 (5)**: depende do `McpTokenGuard` e do controller da US2
- **US4 (6)**: backend já coberto pelas US1/US2 (áreas na configuração + factory); depende delas para a tela e os testes
- **US5 (7)**: depende do `McpToolRunner` (US2) e dos motivos de recusa (US3, T046)
- **Polish (8)**: depois das stories desejadas

### Within Each User Story

- Testes escritos primeiro e falhando antes da implementação
- DTOs/utilitários → services → controllers → web

### Parallel Opportunities

- Setup: T002 e T003
- Foundational: T006, T007, T008 e T010 em paralelo; T009 depois de T008; T011 depois de T004/T005
- US1: T012–T015 em paralelo; T019 e T020 em paralelo com o backend
- US2: T024–T027 em paralelo; as 6 tools (T031–T036), resources (T037) e prompts (T038) em paralelo após T029/T030
- US3: T041–T043 em paralelo

## Parallel Example: User Story 2

```bash
# Testes primeiro (em paralelo):
Task: "Teste e2e de protocolo em apps/api/test/mcp-protocol.e2e.spec.ts"
Task: "Teste de paridade em apps/api/test/mcp-tools-parity.integration.spec.ts"
Task: "Testes dos mappers em apps/api/src/management/mcp/tools/tools.spec.ts"

# Depois de tool-output.ts e mcp-tool-runner.ts, tools em paralelo:
Task: "sales.tools.ts"   Task: "financial.tools.ts"   Task: "menu.tools.ts"
Task: "cash.tools.ts"    Task: "payables.tools.ts"    Task: "inventory.tools.ts"
```

## Implementation Strategy

### MVP (US1 + US2 + US3)

1. Setup + Foundational
2. US1: habilitar e gerar token
3. US2: endpoint MCP e tools. **Validar com quickstart §2–4** (Inspector e Claude Code)
4. US3: isolamento, revogação e limite de taxa. **Obrigatório antes de produção**
5. Deploy em homologação e teste com o Claude Desktop apontando para HTTPS

### Incremental Delivery

6. US4: seleção de áreas na tela
7. US5: log de uso, retenção e auditoria na tela
8. Polish: documentação e roteiro completo
