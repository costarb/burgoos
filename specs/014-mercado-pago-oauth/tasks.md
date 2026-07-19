# Tasks: Conexao Mercado Pago Multiempresa

**Input**: Design documents from `/specs/014-mercado-pago-oauth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mercado-pago.openapi.yaml, quickstart.md

**Tests**: Testes fazem parte das tarefas porque a especificacao exige protecao do fluxo operacional, tenant isolation, seguranca de credenciais, idempotencia e gate de rollout.

**Organization**: As tarefas estao agrupadas por historia de usuario e em ordem de dependencia. Cada tarefa de historia usa `[USn]`; `[P]` indica trabalho seguro em paralelo quando os pre-requisitos da fase estiverem concluidos.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar configuracao, tipos e fixtures sem alterar ainda o comportamento existente.

- [x] T001 Documentar e validar variaveis Mercado Pago sem valores secretos em `.env.example` e `apps/api/src/config/env.validation.ts`
- [x] T002 [P] Adicionar enums, DTOs de conexao e tipos de payload Mercado Pago em `packages/types/src/sales-integrations.ts`
- [x] T003 [P] Criar tipos HTTP estritos de OAuth, pagamento, order e webhook em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.types.ts`
- [x] T004 [P] Criar fixtures sanitizadas de token, pagamentos, order e notificacoes em `apps/api/src/management/sales-integrations/mercado-pago/__fixtures__/mercado-pago.fixtures.ts`
- [x] T005 Instalar `@nestjs/schedule` na API e atualizar o lockfile em `apps/api/package.json` e `package-lock.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Evoluir persistencia, cifra e contrato de provider sem quebrar PagBank.

**CRITICAL**: Nenhuma historia deve iniciar antes desta fase e dos testes de regressao PagBank passarem.

- [x] T006 Atualizar enums, relacoes e entidades `SalesIntegration`, `SalesIntegrationCredential`, `OAuthAuthorizationAttempt`, `ProviderTransactionState`, `ProviderNotification`, `IntegrationAuditEvent`, runs, movimentos e identidades em `packages/database/prisma/schema.prisma`
- [x] T007 Criar migracao com backfill PagBank para ambiente `PRODUCTION`, modo `PROVIDER_TOKEN` e novos indices tenant/provider/ambiente em `packages/database/prisma/migrations/20260718000000_mercado_pago_oauth/migration.sql`
- [x] T008 [P] Ampliar envelopes cifrados tipados para PagBank, OAuth e token fixo sem expor fragmentos em `apps/api/src/security/integration-secret.service.ts`
- [x] T009 [P] Adicionar testes de compatibilidade e redacao dos envelopes de segredo em `apps/api/src/security/integration-secret.service.spec.ts`
- [x] T010 Evoluir o contrato comum de coleta de `fetchDay` para `fetchRange` paginado em `apps/api/src/management/sales-integrations/sales-provider.adapter.ts`
- [x] T011 Adaptar PagBank ao contrato `fetchRange` por decomposicao diaria em `apps/api/src/management/sales-integrations/pagbank/pagbank-sales-provider.adapter.ts`
- [x] T012 Atualizar testes do adapter PagBank e registry para comprovar regressao zero em `apps/api/src/management/sales-integrations/pagbank/pagbank-edi.client.spec.ts`
- [x] T013 [P] Atualizar catalogo e DTOs comuns com Mercado Pago, ambiente, modo, estados e metadados seguros em `apps/api/src/management/sales-integrations/dto/sales-integration.dto.ts`
- [x] T014 [P] Atualizar contratos compartilhados consumidos pela UI em `packages/types/src/sales-integrations.ts`
- [x] T015 Implementar repository/service de claim persistente por conexao para sync e refresh em `apps/api/src/management/sales-integrations/sales-integration-operation-lock.service.ts`
- [x] T016 [P] Implementar gravacao allowlisted de auditoria sem segredos em `apps/api/src/management/sales-integrations/integration-audit.service.ts`
- [x] T017 Inicializar `ScheduleModule` uma unica vez e registrar novos providers e servicos fundamentais em `apps/api/src/management/sales-integrations/sales-integrations.module.ts`
- [x] T018 Validar a migracao, gerar Prisma Client e executar a suite PagBank existente conforme `specs/014-mercado-pago-oauth/quickstart.md`

**Checkpoint**: Persistencia e interfaces comuns prontas, com PagBank operando pelo contrato novo.

---

## Phase 3: User Story 1 - Conectar a conta Mercado Pago (Priority: P1) MVP

**Goal**: Permitir que um administrador conecte a conta da loja por OAuth ou Access Token fixo write-only, com isolamento e troca segura de modo.

**Independent Test**: Conectar duas lojas, uma por OAuth e outra por token fixo, validar conta/status e comprovar que token, verifier e codigo nunca retornam nem cruzam tenants.

### Tests for User Story 1

- [x] T019 [P] [US1] Criar testes de PKCE S256, hash de state, expiracao e replay em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-oauth.service.spec.ts`
- [x] T020 [P] [US1] Criar testes de validacao e troca atomica de token fixo sem eco do segredo e com conclusao em ate dez segundos usando provider simulado em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-connection.service.spec.ts`
- [x] T021 [P] [US1] Criar testes HTTP de autorizacao administrativa, perda de acesso antes do callback, replay, isolamento tenant e conclusao em ate dez segundos com provider simulado em `apps/api/test/mercado-pago-connection.e2e-spec.ts`
- [x] T022 [P] [US1] Criar testes de UI para selecao OAuth/token fixo, aviso e campo write-only em `apps/web/app/admin/orders/import/mercado-pago-connection-panel.spec.tsx`

### Implementation for User Story 1

- [x] T023 [P] [US1] Implementar cliente de troca OAuth e validacao de identidade da conta em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.ts`
- [x] T024 [P] [US1] Implementar geracao criptografica de state/verifier/challenge, persistencia do periodo inicial 30/60/90 e consumo atomico da tentativa em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-oauth.service.ts`
- [x] T025 [US1] Implementar conexao por OAuth ou token fixo, unicidade da conta e troca segura de credencial candidata em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-connection.service.ts`
- [x] T026 [US1] Implementar endpoints administrativos de modo, connect e disconnect em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-connection.controller.ts`
- [x] T027 [US1] Implementar callback publico em `/api/integrations/mercadopago/callback`, revalidar acesso administrativo, persistir a conexao e iniciar o periodo escolhido antes do redirecionamento seguro em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-oauth.controller.ts`
- [x] T028 [US1] Integrar criacao e leitura segura da conexao Mercado Pago ao service comum em `apps/api/src/management/sales-integrations/sales-integration.service.ts`
- [x] T029 [US1] Adicionar cliente web para endpoints OAuth/token fixo sem persistir token no estado apos submit em `apps/web/lib/api.ts`
- [x] T030 [US1] Criar painel de selecao OAuth/token fixo, periodo inicial 30/60/90 com default 30, callback, troca de modo e desconexao em `apps/web/app/admin/orders/import/mercado-pago-connection-panel.tsx`
- [x] T031 [US1] Integrar o painel Mercado Pago ao seletor de providers existente em `apps/web/app/admin/orders/import/sales-integration-panel.tsx`
- [x] T032 [US1] Executar testes US1 e validar manualmente ausencia de segredos seguindo `specs/014-mercado-pago-oauth/quickstart.md`

**Checkpoint**: Loja conecta e desconecta com qualquer modo, sem capacidade de consultar vendas ainda.

---

## Phase 4: User Story 2 - Consultar e importar vendas por periodo (Priority: P1)

**Goal**: Coletar todas as paginas de pagamentos por periodo, normalizar no pipeline comum e importar pedidos sem duplicidade.

**Independent Test**: Consultar 30 dias com pagamentos aprovados e nao elegiveis, importar a previa e repetir o mesmo periodo criando zero pedidos duplicados.

### Tests for User Story 2

- [x] T033 [P] [US2] Criar testes de paginacao ascendente, limites, retry controlado e deduplicacao de paginas em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.spec.ts`
- [x] T034 [P] [US2] Criar testes de mapeamento de status, valores, taxas, metodos e payload redigido em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.spec.ts`
- [x] T035 [P] [US2] Criar testes do adapter por intervalo e distribuicao de evidencia diaria em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-sales-provider.adapter.spec.ts`
- [x] T036 [P] [US2] Criar teste E2E de preview/importacao repetida e isolamento entre duas contas em `apps/api/test/mercado-pago-sales-import.e2e-spec.ts`
- [x] T037 [P] [US2] Criar testes de UI para periodos 30/60/90, progresso e previa Mercado Pago em `apps/web/app/admin/orders/import/mercado-pago-sync.spec.tsx`

### Implementation for User Story 2

- [x] T038 [P] [US2] Implementar parser e normalizador de pagamentos Mercado Pago em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.mapper.ts`
- [x] T039 [US2] Implementar busca `/v1/payments/search` com range menor que 365 dias, limit/offset e ordem ascendente em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.ts`
- [x] T040 [US2] Implementar `fetchRange` e capabilities Mercado Pago em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-sales-provider.adapter.ts`
- [x] T041 [US2] Persistir/upsert do estado canonico antes de gerar movimentos historicos em `apps/api/src/management/sales-integrations/provider-transaction-state.service.ts`
- [x] T042 [US2] Adaptar processamento de runs para trigger, intervalos paginados e evidencia diaria sem uma requisicao remota por dia em `apps/api/src/management/sales-integrations/sales-import-run.processor.ts`
- [x] T043 [US2] Ampliar identidade externa com ambiente e conexao preservando idempotencia PagBank em `apps/api/src/management/sales-integrations/external-sale-identity.service.ts`
- [x] T044 [US2] Implementar endpoint Mercado Pago de carga inicial/manual conforme contrato em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-sync.controller.ts`
- [x] T045 [US2] Adicionar controles 30/60/90 e periodo especifico ao fluxo de preview existente em `apps/web/app/admin/orders/import/mercado-pago-connection-panel.tsx`
- [x] T046 [US2] Exibir metadados e classificacoes Mercado Pago na previa comum em `apps/web/app/admin/orders/import/order-import-client.tsx`
- [x] T047 [US2] Executar testes US2, regressao PagBank e importacao repetida seguindo `specs/014-mercado-pago-oauth/quickstart.md`

**Checkpoint**: Conexao Mercado Pago entrega consulta, previa e importacao manual idempotente.

---

## Phase 5: User Story 3 - Manter a autorizacao ativa (Priority: P1)

**Goal**: Renovar OAuth de forma atomica e concorrencia segura, tratar 401 uma vez e exigir intervencao no token fixo.

**Independent Test**: Executar dois refreshes concorrentes de token proximo do vencimento, observar uma chamada remota e validar transicao para reautorizacao quando a recuperacao falha.

### Tests for User Story 3

- [x] T048 [P] [US3] Criar testes de claim, refresh token rotacionado e persistencia atomica em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-refresh.service.spec.ts`
- [x] T049 [P] [US3] Criar testes do wrapper 401 com um unico refresh/retry e comportamento fixed token em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service.spec.ts`
- [x] T050 [P] [US3] Criar teste E2E de reconexao, desconexao e preservacao de historico em `apps/api/test/mercado-pago-token-lifecycle.e2e-spec.ts`

### Implementation for User Story 3

- [x] T051 [US3] Implementar refresh com lock, rotacao atomica e estados seguros em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-refresh.service.ts`
- [x] T052 [US3] Implementar chamada autenticada com no maximo um refresh/retry e redacao de erros em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service.ts`
- [x] T053 [US3] Implementar job diario para conexoes OAuth a 15 dias do vencimento em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-refresh.scheduler.ts`
- [x] T054 [US3] Integrar o wrapper autenticado ao cliente de busca e recurso individual em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago.client.ts`
- [x] T055 [US3] Expor `TOKEN_EXPIRING`, `REFRESHING` e `REAUTHORIZATION_REQUIRED` sem dados sensiveis em `apps/api/src/management/sales-integrations/sales-integration.service.ts`
- [x] T056 [US3] Exibir substituir token ou reconectar conforme modo e estado em `apps/web/app/admin/orders/import/mercado-pago-connection-panel.tsx`
- [x] T057 [US3] Executar testes concorrentes US3 e verificar que token fixo nunca entra no scheduler conforme `specs/014-mercado-pago-oauth/quickstart.md`

**Checkpoint**: OAuth permanece ativo automaticamente e falhas terminam em recuperacao finita e visivel.

---

## Phase 6: User Story 4 - Receber atualizacoes e reconciliar vendas (Priority: P2)

**Goal**: Validar webhooks multiempresa, buscar payment/order canonico e recuperar eventos perdidos por reconciliacao.

**Independent Test**: Enviar eventos validos, invalidos e duplicados para duas contas, verificar isolamento e recuperar uma mudanca omitida pela reconciliacao.

### Tests for User Story 4

- [x] T058 [P] [US4] Criar testes de assinatura, timestamp, event key e payload minimo em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook-signature.service.spec.ts`
- [x] T059 [P] [US4] Criar testes de processamento idempotente, fora de ordem e resolucao por provider user ID em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook.service.spec.ts`
- [x] T060 [P] [US4] Criar testes de reconciliacao curta/diaria e claims concorrentes em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-reconciliation.service.spec.ts`
- [x] T061 [P] [US4] Criar teste E2E publico para assinatura invalida, duplicacao, isolamento e aceite de pelo menos 99 de 100 webhooks validos em ate dois segundos em `apps/api/test/mercado-pago-webhook.e2e-spec.ts`

### Implementation for User Story 4

- [x] T062 [P] [US4] Implementar verificacao HMAC allowlisted conforme headers oficiais em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook-signature.service.ts`
- [x] T063 [US4] Implementar receiver publico em `/api/webhooks/mercadopago` com persistencia idempotente e resposta rapida em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook.controller.ts`
- [x] T064 [US4] Implementar processor que resolve conexao e busca payment/order canonico em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook.service.ts`
- [x] T065 [US4] Criar somente o contrato tipado e fixtures ficticias de order Point com capability desabilitada, adiando o mapper definitivo ate a POC em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-order.mapper.ts`
- [x] T066 [US4] Implementar atualizacao monotona do estado canonico e alerta sem mutar pedidos em `apps/api/src/management/sales-integrations/provider-transaction-state.service.ts`
- [x] T067 [US4] Implementar reconciliacao por `date_last_updated` para 24 horas e sete dias em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-reconciliation.service.ts`
- [x] T068 [US4] Agendar reconciliacao curta e diaria com claim por conexao em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-reconciliation.scheduler.ts`
- [x] T069 [US4] Registrar controller, schedulers e processors no modulo em `apps/api/src/management/sales-integrations/sales-integrations.module.ts`
- [x] T070 [US4] Executar testes US4 e simular evento perdido conforme `specs/014-mercado-pago-oauth/quickstart.md`

**Checkpoint**: Atualizacoes chegam em tempo proximo do real e sao recuperadas sem depender exclusivamente do webhook.

---

## Phase 7: User Story 5 - Acompanhar a saude da integracao (Priority: P2)

**Goal**: Exibir metadados seguros, acoes permitidas, historico de sincronizacao e auditoria operacional.

**Independent Test**: Simular todos os estados e confirmar que a tela mostra somente acoes validas, erros seguros e nenhum segredo.

### Tests for User Story 5

- [x] T071 [P] [US5] Criar testes de serializacao segura para todos os estados e modos em `apps/api/src/management/sales-integrations/sales-integration.service.spec.ts`
- [x] T072 [P] [US5] Criar testes de auditoria allowlisted para conexao, refresh, sync, webhook e desconexao em `apps/api/src/management/sales-integrations/integration-audit.service.spec.ts`
- [x] T073 [P] [US5] Criar testes de UI de status, acoes, validade, ultima sync e erro seguro em `apps/web/app/admin/orders/import/mercado-pago-connection-panel.spec.tsx`

### Implementation for User Story 5

- [x] T074 [US5] Completar emissao de auditoria em todos os servicos Mercado Pago em `apps/api/src/management/sales-integrations/integration-audit.service.ts`
- [x] T075 [US5] Ampliar resposta administrativa e historico de runs com modo, ambiente, conta e saude em `apps/api/src/management/sales-integrations/sales-integration.controller.ts`
- [x] T076 [US5] Implementar matriz de estado para acoes sincronizar, reconectar, substituir e desconectar em `apps/web/app/admin/orders/import/mercado-pago-connection-panel.tsx`
- [x] T077 [US5] Exibir ultima sincronizacao, validade, conta e ultimo erro redigido no painel em `apps/web/app/admin/orders/import/sales-integration-panel.tsx`
- [x] T078 [US5] Executar testes US5 e inspecao de respostas/logs para ausencia de segredo conforme `specs/014-mercado-pago-oauth/quickstart.md`

**Checkpoint**: Administradores diagnosticam e recuperam a integracao sem suporte ou acesso a credenciais.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, retencao, documentacao operacional e gate comercial Point.

- [x] T079 [P] Implementar limpeza de OAuth attempts, webhooks e runs conforme retencao em `apps/api/src/management/sales-integrations/sales-import-retention.service.ts`
- [x] T080 [P] Adicionar teste automatizado que falha ao detectar tokens/codigos/verifiers em logs e DTOs em `apps/api/test/mercado-pago-secret-leak.e2e-spec.ts`
- [x] T081 [P] Validar e consolidar os contratos administrativos e publicos Mercado Pago no artefato atual em `specs/014-mercado-pago-oauth/contracts/mercado-pago.openapi.yaml`
- [x] T082 Atualizar documentacao de operacao, variaveis, callbacks, webhooks e alertas em `README.md`
- [ ] T083 Executar formatacao, lint, typecheck, Prisma validate e todas as suites API/web conforme `specs/014-mercado-pago-oauth/quickstart.md`
- [ ] T084 Executar POC com segunda conta, venda Point, webhook, estorno e refresh e registrar evidencias em `specs/014-mercado-pago-oauth/point-poc-results.md`
- [ ] T085 Implementar o mapper definitivo e habilitar somente os topicos e recursos Point confirmados pela POC em `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-order.mapper.ts` e `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-sales-provider.adapter.ts`
- [ ] T086 Revisar checklist e registrar criterios de rollout satisfeitos em `specs/014-mercado-pago-oauth/checklists/requirements.md`

## Phase 9: Configuracao OAuth gerenciada pela plataforma

- [x] T087 [P] Documentar configuracao global persistida, precedencia e contrato seguro em `spec.md`, `data-model.md` e `contracts/mercado-pago.openapi.yaml`
- [x] T088 Criar persistencia e migracao para configuracao global cifrada em `packages/database/prisma/schema.prisma` e `packages/database/prisma/migrations/20260719000000_platform_integration_configuration/migration.sql`
- [x] T089 Criar testes de leitura segura, atualizacao parcial e fallback de ambiente para configuracao Mercado Pago
- [x] T090 Implementar service e endpoints `SUPER_ADMIN` write-only para configuracao Mercado Pago
- [x] T091 Refatorar OAuth, token, callback e webhook para consumir configuracao persistida com fallback de ambiente
- [x] T092 Criar tela de plataforma para configurar e testar o estado da integracao sem revelar segredos
- [x] T093 Executar testes direcionados, typecheck, lint e atualizar documentacao operacional

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Inicio imediato.
- **Foundational (Phase 2)**: Depende de Setup e bloqueia todas as historias.
- **US1 (Phase 3)**: Depende de Foundational; entrega conexao utilizavel.
- **US2 (Phase 4)**: Depende de US1 para credencial valida e entrega valor financeiro principal.
- **US3 (Phase 5)**: Depende de US1; pode ser executada em paralelo com US2 apos a conexao.
- **US4 (Phase 6)**: Depende de US1, US2 e US3 para busca canonica e lifecycle seguro.
- **US5 (Phase 7)**: Depende dos estados/eventos das US1-US4 para painel completo; partes visuais podem iniciar apos US1.
- **Polish (Phase 8)**: Depende das historias selecionadas; T084 bloqueia T085 e o rollout comercial Point.

### User Story Dependencies

```text
Foundation -> US1 Connection -> US2 Import ---------> US4 Webhook/Reconciliation -> US5 Health
                         `----> US3 Token Lifecycle -'
All desired stories -> Hardening -> Point POC -> Point enablement
```

### Within Each User Story

- Escrever os testes da historia e confirmar falha antes da implementacao.
- Implementar clientes/mappers antes de services e controllers.
- Persistir e validar no backend antes de integrar UI.
- Executar o checkpoint completo antes de avancar.

## Parallel Opportunities

- T002, T003 e T004 podem rodar em paralelo apos T001.
- T008/T009, T013/T014 e T016 podem rodar em paralelo apos o schema estar definido.
- Testes de cada historia marcados `[P]` podem ser escritos simultaneamente.
- Depois de US1, US2 e US3 podem ser implementadas em paralelo por trabalharem majoritariamente em arquivos distintos.
- Na US4, assinatura e testes de reconciliacao podem avancar em paralelo antes da integracao do processor.
- Na US5, testes API, auditoria e UI podem avancar em paralelo.

## Parallel Example: User Story 1

```text
T019 OAuth/PKCE unit tests
T020 Fixed-token unit tests
T021 Connection contract/E2E tests
T022 Connection UI tests
```

## Parallel Example: User Story 2 and User Story 3

```text
Track A: T033-T047 Payment search, mapping, preview and import
Track B: T048-T057 Refresh, 401 recovery and reconnect states
```

## Implementation Strategy

### MVP First

1. Completar Setup e Foundational.
2. Completar US1 para conectar lojas por token fixo e OAuth.
3. Completar US2 para entregar consulta e importacao manual.
4. Validar com token fixo enquanto OAuth produtivo ou segunda conta nao estiverem disponiveis.
5. Nao declarar Point comercialmente suportado antes de T084 e T085.

### Incremental Delivery

1. **Connection MVP**: US1, credencial segura e isolamento.
2. **Sales MVP**: US2, preview/importacao idempotente.
3. **SaaS readiness**: US3, renovacao e reconexao controlada.
4. **Near-real-time**: US4, webhook e reconciliacao.
5. **Operations**: US5, saude e auditoria.
6. **Commercial Point rollout**: hardening, POC e capability confirmada.

## Notes

- `[P]` indica arquivos e dependencias independentes no inicio da fase.
- Nenhuma tarefa deve registrar ou retornar access token, refresh token, code, verifier, client secret ou assinatura completa.
- Fixtures devem usar valores ficticios inequivocos; nenhum segredo real entra no repositorio.
- Manter os tres arquivos locais nao relacionados fora de commits desta feature.
- Fazer commits por tarefa ou grupo logico e executar o checkpoint antes da proxima fase.
