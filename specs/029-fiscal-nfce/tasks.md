# Tasks: Módulo Fiscal — Emissão de NFC-e por Provedor Configurável

**Input**: `/specs/029-fiscal-nfce/` (plan.md, spec.md, research.md, data-model.md, contracts/fiscal-api.md, quickstart.md)

**Tests**: incluídos (SC-003, SC-005 e o isolamento por tenant exigem teste automatizado).

## Phase 0: Validação do provedor (bloqueante para o adapter Bling)

- [X] T001 Em homologação, com a conta Bling real (SP), validar por script descartável em `tmp/`: OAuth, `POST /nfce` com payload mínimo (itens inline com NCM/CFOP/CSOSN vs. `produto.id`), envio à SEFAZ, `GET /nfce/{id}` (conteúdo de `xml`, `linkDanfe`, `linkPDF`), `GET /nfce` por filtro (para `findByReference`), `GET /formas-pagamentos`, naturezas de operação e limites de requisição. Salvar respostas anonimizadas em `apps/api/src/management/fiscal/providers/bling/__fixtures__/` e atualizar `research.md` (R1) com o que mudou

## Phase 1: Foundational

- [X] T002 Schema e migração `20261031100000_fiscal_nfce` conforme `data-model.md`: enums, tabelas fiscais, `PlatformFiscalProviderConfiguration`, campos em `orders`, `service_tabs`, `sales_integrations`, `categories`, `products`, `product_complements`, `BackgroundJobType`/`SalesRunTrigger` novos, CHECK `order_id XOR service_tab_id`; `npm run db:generate`
- [X] T003 [P] Permissões `fiscal.view|configure|issue|cancel` em `permission-catalog.ts` e no `seed.ts` (dono/admin todas; operador view+issue); testes do catálogo
- [X] T004 [P] `IntegrationSecretService`: envelopes `BLING_OAUTH` e `FISCAL_A1_CERTIFICATE` com validação; testes
- [X] T005 [P] `fiscal/configuration/br-documents.ts`: DV de CNPJ/CPF, IE de SP (algoritmo completo) e formato das demais UFs, máscara de CPF para logs; testes
- [X] T006 [P] Tipos compartilhados em `packages/types` (configuração, prontidão, documento, status fiscal do pedido, auto import health)
- [X] T007 `fiscal.module.ts` + `providers/fiscal-provider.adapter.ts` (contrato, `FiscalProviderError`), `fiscal-provider.registry.ts`, `testing/fake-fiscal-provider.adapter.ts` (cenários: autoriza, processing, rejeita, timeout, cancela/sem cancelamento) e `fiscal-audit.service.ts` (eventos + logs estruturados `fiscal.*`); testes

## Phase 2: User Story 1 - Configuração e conexão (P1)

- [X] T008 [US1] `fiscal-issuer.service.ts` + `ibge-municipality.client.ts`: emitente com endereço de `Tenant.config.address`, campos faltantes, resolução do IBGE com fallback manual; testes
- [X] T009 [US1] `fiscal-configuration.service.ts|controller.ts` + `fiscal-readiness.service.ts`: GET/PUT da configuração, `enabled` só com prontidão, troca de provedor bloqueada com documentos pendentes, auditoria; testes
- [X] T010 [US1] Plataforma: `bling-platform-configuration.service.ts|controller.ts` (client id/secret cifrados, padrão Mercado Pago); testes
- [X] T011 [US1] Bling OAuth: `bling-oauth.service.ts`, callback, `fiscal-provider-context.service.ts` (refresh sob demanda em 401, uma vez), `bling-token-refresh.scheduler.ts`, desconectar; testes
- [X] T012 [US1] `bling.client.ts` (HTTP, zod, backoff em 429, concorrência 1 por empresa) e `bling-connection` (options: formas de pagamento e naturezas; settings: mapeamento obrigatório); testes com fixtures
- [X] T013 [P] [US1] Teste de isolamento por tenant (configuração, conexão, documentos) em `apps/api/test/fiscal-tenant-isolation.integration.spec.ts`
- [X] T014 [US1] Web: card Bling em `app/platform/integrations`; `app/admin/fiscal` aba Configuração (emitente, endereço com atalho, conexão, mapeamento de pagamentos/natureza, prontidão); item "Fiscal" em `admin-navigation.ts`; `lib/api.ts`; testes

## Phase 3: User Story 2 - Perfis fiscais (P1)

- [X] T015 [US2] `fiscal-profile.service.ts|controller.ts`: CRUD com validações (NCM, CFOP 5xxx, CSOSN do Simples, CEST para 500), exclusão bloqueada em uso, atribuição em lote, faltantes; testes
- [X] T016 [US2] `fiscal-profile-resolver.ts` (produto→categoria; complemento→complemento→produto pai); testes
- [X] T017 [US2] Web: aba Perfis fiscais (CRUD, atribuição por categoria/produto/complemento, lista de faltantes); testes

## Phase 4: User Story 3 - Emissão (P1)

- [X] T018 [US3] `nfce-composer.ts`: itens + complementos pagos, ajuste negativo como desconto, rateios (frete e gorjeta inativos), soma = total ao centavo, comanda agregando pedidos, pagamentos com tPag (R4) a partir de alocações ou do método do pedido, troco; testes
- [X] T019 [US3] `fiscal-eligibility.service.ts`: origem, pago, total > 0, regra do dia (`BUSINESS_TIME_ZONE`), prontidão, documento ativo; testes (incluindo virada de dia)
- [X] T020 [US3] `fiscal-emission.service.ts` + `fiscal-emission.processor.ts`: documento PENDING com `activeKey`, `create` → grava `externalId` → `submit`, AUTHORIZED/PROCESSING/REJECTED, timeout → `findByReference`, retry pela política do job, ERROR, `MISSING_FISCAL_DATA` local; `fiscal-document-storage.service.ts` (XML/DANFE no AssetStorage); testes com o fake (SC-005: concorrência e timeout)
- [X] T021 [US3] `bling-nfce.mapper.ts` + `bling-fiscal-provider.adapter.ts` + `bling-document-decoder.ts` (GZIP+Base64), conforme a T001; testes com fixtures
- [X] T022 [US3] `fiscal-trigger.service.ts` + hooks pós-commit em `manual-payment.service.ts`, `payment-settlement.service.ts`, `counter-order.service.ts`, `service-tab` (comanda paga), `sales-import-confirmation.service.ts`, `historical-order-import.service.ts`; falha do hook só loga; testes
- [X] T023 [US3] `fiscal-sweep.scheduler.ts` (a cada minuto, só papel consumer): vendas do dia sem nota em modo automático → emissão + log `fiscal.trigger.recovered`; testes
- [X] T024 [US3] `consumerDocument` nos DTOs de balcão e checkout de comanda (CPF/CNPJ com DV); `fiscal-documents.controller.ts`: emitir (com `confirmRetroactive`), reprocessar, lista/detalhe, DANFE/XML; status fiscal derivado em lista/detalhe de pedidos + filtro `fiscalStatus`; testes
- [X] T025 [US3] Web: badge e filtro fiscal em `admin/orders`, ações no detalhe (emitir, confirmação retroativa, reprocessar, DANFE), CPF/CNPJ no balcão e no checkout da comanda; testes

## Phase 5: User Story 4 - Cancelamento (P1)

- [X] T026 [US4] `fiscal-cancellation.service.ts` + `cancel-deadlines.ts`: CANCEL_PENDING com justificativa e prazo; via API (job `FISCAL_CANCELLATION`) ou assistido (notificação ERROR para `fiscal.cancel` + lembrete aos 10 min); cancelamento durante PROCESSING; cancelamento direto da nota; testes
- [X] T027 [US4] Hooks de cancelamento: `ordering.service.ts` (CANCELLED), `order-maintenance.service.ts` (exclusão), `service-tab.service.ts` (cancelar comanda; pedido cancelado dentro de comanda paga); `fiscal-order-guard.service.ts` na manutenção de itens e no update de balcão (409 `FISCAL_DOCUMENT_ACTIVE`); testes
- [X] T028 [US4] `fiscal-sync.scheduler.ts` + `fiscal-sync.processor.ts`: PROCESSING/CANCEL_PENDING/CANCEL_FAILED com `nextSyncAt` por idade, CANCELLED detectado no provedor (`via: PROVIDER_PANEL`), CANCEL_FAILED pós-prazo com consulta por 7 dias, XML do cancelamento; testes
- [X] T029 [P] [US4] Testes de ponta a ponta do cancelamento (SC-003) em `apps/api/test/fiscal-cancellation.integration.spec.ts`: com e sem `cancelViaApi`, prazo vencido, exclusão, comanda, guard
- [X] T030 [US4] Web: aba Pendências com contador de prazo, justificativa copiável e "Abrir no Bling"; ação "Cancelar NFC-e" no detalhe; testes

## Phase 6: User Story 5 - Importação automática (P2)

- [X] T031 [US5] `autoImport` no DTO/serviço da integração (enabled, estratégia, produto fixo, auditoria) e `health` no GET; testes
- [X] T032 [US5] `sales-auto-import.scheduler.ts` (`0 */2 * * * *`, papel consumer, dedupe por integração) + `sales-auto-import.processor.ts` (lock, run AUTOMATIC do dia e do dia anterior nos 10 min após a meia-noite, preview + confirm, erros por `SalesProviderError.code`, backoff); testes
- [X] T033 [US5] `sales-auto-import-health.service.ts`: contadores, `lagSeconds`, logs `sales.auto_import.cycle`/`degraded` com os campos da FR-027b, notificação limitada a 1/h; testes (isolamento entre integrações, 3 falhas, lag > 15 min)
- [X] T034 [US5] Web: chave "Importação automática" e painel de saúde no `sales-integration-panel.tsx`; histórico mostra gatilho "Automático"; testes

## Phase 7: User Story 6 - Certificado A1 (P2)

- [ ] T035 [US6] Dependência `node-forge`; `pkcs12-reader.ts` (titular, CNPJ ICP-Brasil, validade, fingerprint); `fiscal-certificate.service.ts|controller.ts` (multipart ≤ 20 KB, erros 422, rotação, nada de segredo na resposta); testes com PFX gerado no teste
- [ ] T036 [US6] `certificate-expiry.scheduler.ts` (diário, 30/15/7/1, `lastExpiryAlertDays`); prontidão com CNPJ divergente; testes
- [ ] T037 [US6] Web: bloco Certificado na aba Configuração (upload, metadados, dias para vencer); testes

## Phase 8: User Story 7 - Controle e pendências (P2)

- [X] T038 [US7] Lista de documentos com `pendingOnly` e `pendingReason` (incluindo `SAME_DAY_NOT_ISSUED` e `PROVIDER_DISCONNECTED`), eventos no detalhe, auditoria de reprocessamentos; testes
- [X] T039 [US7] Web: aba Notas (filtros por status e período) e Pendências com reprocessar; testes

## Phase 9: User Story 8 - DANFE, WhatsApp e XML ao contador (P3)

- [X] T040 [US8] Impressão do DANFE (rota que abre o PDF para impressão) e `consultationUrl` no `whatsapp-link.ts`; testes
- [X] T041 [US8] `fiscal-xml-export.handler.ts`: contexto `FISCAL_XML` no worker de exportação (ZIP `autorizadas/`, `canceladas/`, `resumo.csv`, sem homologação) + botão na aba Notas; testes

## Phase 10: Polish

- [ ] T042 [P] Docs: `docs/USER_GUIDE.md` (seção Fiscal: configuração, Bling, cancelamento assistido, importação automática), `docs/DATA_DICTIONARY.md` regenerado, guia de monitoria com os eventos de log; emenda da constituição ("Fiscal/NF-e" promovido pela spec 029)
- [ ] T043 Typecheck, lint e suítes de API e web (comparar com o baseline do `develop`)
- [ ] T044 Roteiro do `quickstart.md` em homologação; depois produção em modo manual → automático

## Dependencies

T001 → T012, T021 (o adapter Bling depende da validação). Phase 1 → US1 → US2 → US3 → US4. US5 (importação automática) pode andar em paralelo à US3 depois da Phase 1; o hook fiscal da confirmação (T022) liga as duas. US6 é independente depois da Phase 1. US7 e US8 dependem da US3. O fake provider (T007) permite desenvolver US3/US4 antes de concluir a T001.
