# Tasks: Eficiência de armazenamento e da tela de importação de vendas

**Input**: `specs/030-import-storage-efficiency/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: obrigatórios nos fluxos operacionais (constituição V). Vitest com `@Inject` explícito e módulos focados.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1–US4 da spec. **[X]**: transversal

---

## Phase A1: User Story 1 - Importação automática sem inflar o banco (P1) 🎯

**Goal**: o ciclo automático grava só vendas novas, concilia as conhecidas em memória e a retenção limpa o acúmulo.
**Independent Test**: dia simulado com vendas repetidas em vários ciclos. Os movimentos gravados são só as vendas novas, os pedidos e as NFC-e continuam iguais, e a conciliação atualiza o pedido quando a taxa ou a liberação mudam.

- [X] T001 [US1] `sales-import-preview.service.ts`: opção `persistKnownSales` (padrão `true`); checagem de identidade em lote (`findMany ... externalSaleId IN`); vendas conhecidas no modo `false` não viram movimento, passam por `upsertFromMovement` e voltam em `knownSales`; devolve `latestOccurredAt`; `counts.duplicate` preservado. Testes nos dois modos
- [X] T002 [US1] `sales-import-confirmation.service.ts`: `reconcileKnownSales(tenantId, run, knownSales)` carrega identidades e pedidos em lote e atualiza o pedido só quando bruto, taxa, líquido ou liberação diferem. Devolve a quantidade de pedidos atualizados. Testes (sem mudança → 0 updates; taxa nova → 1 update)
- [X] T003 [US1] `auto-import/sales-auto-import.service.ts`: chama `process(..., { persistKnownSales: false })`, depois `confirm` e `reconcileKnownSales`; atraso calculado a partir de `latestOccurredAt` (sem consultar movimentos); log `sales.auto_import.cycle` com `known` e `reconciledOrders`. Testes: 3 ciclos com as mesmas vendas geram um movimento por venda e nenhum pedido duplicado; a saúde da integração continua igual
- [X] T004 [US1] `sales-import-retention.service.ts`: compactação (`DUPLICATE` de execuções `AUTOMATIC` terminais), execuções `AUTOMATIC` com `counts.new = 0` com mais de 2 dias, redação do `raw_payload` com mais de 30 dias; lotes de 2.000 em SQL bruto, `hasMore`, log `sales.retention.completed`. Testes: preserva movimentos `NEW`/`IMPORTED`, identidades, pedidos e estados de transação; idempotente
- [X] T005 [US1] Regressão: a pré-visualização manual continua mostrando novas, duplicadas e rejeitadas, e a confirmação manual de duplicadas continua conciliando (testes existentes + 1 caso novo)

**Checkpoint**: a US1 pode ir para produção sozinha.

---

## Phase A2: User Story 2 - Tela de importação rápida (P1)

**Goal**: a tela abre sem carregar o catálogo e com o histórico útil.
**Independent Test**: a página carrega só as opções de produtos e as instituições, e o histórico mostra as execuções manuais por padrão.

- [ ] T006 [P] [US2] `packages/types`: `ProductOption` e `trigger` na consulta do histórico
- [ ] T007 [US2] API `GET /api/admin/products/options` (`admin-product.controller.ts` + `catalog.service.ts#listProductOptions`): `select` enxuto, filtro `active`, permissões `catalog.manage | integrations.sales.view | integrations.sales.manage` (permissão no método, não na classe). Testes: sem imagem/descrição, isolamento por loja
- [ ] T008 [US2] API histórico: `SalesPaginationDto.trigger`, filtro em `sales-import-history.service.ts#list`, sem o `include` da integração. Testes
- [ ] T009 [US2] Web `apps/web/lib/api.ts`: `listProductOptions()` e `listSalesImportRuns(token, { trigger, page })`
- [ ] T010 [US2] Web `admin/orders/import/page.tsx`: token + `listProductOptions({active:true})` + instituições em paralelo, sem `getAdminCatalog`. Trocar `AdminProduct` por `ProductOption` em `order-import-client.tsx`, `sales-integration-panel.tsx`, `sales-auto-import-card.tsx` e `ifood-financial-panel.tsx`
- [ ] T011 [US2] Web `sales-integration-panel.tsx`: provedores e integrações carregados uma vez; histórico carregado ao abrir o `<details>`, com filtro Manual/Automática (padrão Manual) e paginação "carregar mais". Testes da página e do painel atualizados

**Checkpoint**: fase A completa → merge em `develop` → `main` (quickstart §2–3).

---

## Phase B: User Story 3 - Storage persistente e XMLs fiscais (P1)

**Goal**: layout padronizado no bucket, recuperação dos XMLs perdidos e aviso de storage temporário.
**Independent Test**: com o storage fake sem os arquivos, a recuperação regrava a partir do provedor fake, e o que falhar vira pendência `FILES_MISSING`.

- [ ] T012 [US3] `common/storage/asset-keys.ts`: `fiscalKey` (mês no horário de Brasília), `imageKey`, `exportKey`, `isStoredAssetKey` (layout novo + legado `tenants/`). Testes (nota às 22h de 31/10 em Brasília → `2026/10`)
- [ ] T013 [US3] `AssetStorage`: `exists(key)` e `createReadUrl(key, ttl)` em S3 (HeadObject, presigned GET) e local (fs.stat, URL HMAC), além de `local-asset-read.controller.ts` (`GET /api/assets/local/:key`, só com storage local). Testes
- [ ] T014 [US3] Usar o montador: `fiscal-document-storage.service.ts`, `asset-upload.service.ts` e `export-job.worker.ts`; `catalog.service.ts` passa a usar o `isStoredAssetKey` compartilhado. Testes ajustados
- [ ] T015 [US3] Prisma: `fiscal_documents.files_missing_at` e `files_missing_reason`, migração `20261116120000_fiscal_files_missing`, `npm run db:generate`; `FiscalPendingReason += FILES_MISSING` e `FiscalReadinessKey += STORAGE` em `packages/types`
- [ ] T016 [US3] `fiscal-file-recovery.service.ts`: job durável `FISCAL_FILE_RECOVERY` (uma nota por vez, `exists` → `storeFiles`; marca e limpa `files_missing_*`), agendamento semanal, endpoints `POST/GET /api/admin/fiscal/documents/recover-files`, log `fiscal.files.recovery_completed` / `fiscal.files.missing`. Testes com o storage fake e o adapter fake
- [ ] T017 [US3] `fiscal-documents.service.ts#pendingReason` com `FILES_MISSING`; prontidão com o item `STORAGE` (não bloqueia); log `storage.local_in_production` na subida. Testes
- [ ] T018 [US3] Web: rótulo `FILES_MISSING` em `fiscal-labels.ts`, botão **Recuperar arquivos** com a situação na tela Fiscal e o aviso `STORAGE` na prontidão
- [ ] T019 [P] [US3] Docs: layout do bucket e regras do R2 em `docs/ARCHITECTURE.md`; recuperação em `docs/USER_GUIDE.md`

**Checkpoint**: fase B → produção → recuperação → trava do R2 (quickstart §4, §1.2).

---

## Phase C: User Story 4 - Imagens fora do banco (P2)

**Goal**: nenhuma imagem em base64 no banco; o admin recebe URLs assinadas.
**Independent Test**: migrar produtos fake com base64. O banco fica só com chaves, o admin mostra a URL assinada e o cardápio público continua servindo a foto.

- [ ] T020 [US4] `catalog.service.ts`: a resposta de produto traz `imageUrl` resolvido (`createReadUrl` para chave, http mantida) e `imageAssetKey`; a gravação recusa `data:` (FR-019) e apaga a chave anterior ao trocar ou excluir (FR-020). Testes
- [ ] T021 [US4] `store-branding.service.ts`: mesma regra para logo/cabeçalho/corpo/rodapé (`*AssetKey`, URL resolvida, recusa de `data:`, remoção da anterior). Testes
- [ ] T022 [US4] `legacy-image-migration.service.ts`: job durável `LEGACY_IMAGE_MIGRATION` (um registro por vez, valida MIME e tamanho, grava em `imageKey`, update condicional, desfaz em caso de corrida) para produtos e identidade visual; endpoints `POST/GET /api/admin/assets/legacy-images/migrate`; logs `catalog.legacy_image.*`. Testes (idempotência, corrida, falha mantém o base64)
- [ ] T023 [US4] Web: o catálogo e a identidade visual usam `imageUrl` para exibir e `imageAssetKey` para salvar; botão **Migrar imagens antigas** com a situação. Testes do formulário

**Checkpoint**: fase C → produção → migração → `VACUUM` (quickstart §5).

---

## Phase D: Runtime Node 22 [X]

- [ ] T024 [X] `engines.node ">=22 <23"` na raiz e nos apps, `.node-version` com `22`; validar `npm ci`, typecheck, testes e build (web em worktree fora do OneDrive); documentar `NODE_VERSION` no quickstart §6

---

## Phase E: Polish

- [ ] T025 [X] Verificação final contra a spec: SC-001 a SC-007 com as consultas do quickstart depois de cada fase em produção; registrar os resultados no fim deste arquivo
- [ ] T026 [X] Marcar a spec como `Implemented` e atualizar o `AGENTS.md` se a próxima feature mudar

## Dependencies & Execution Order

- **US1 (T001→T002→T003→T004→T005)** é sequencial (os mesmos serviços).
- **US2** é independente da US1. T006 e T007/T008 podem rodar em paralelo com a US1. T009→T010→T011 na web.
- **US3** depende de T012/T013 para T014 e T016. T015 antes de T016 e T017.
- **US4** depende de T012/T013 (montador de chaves e `createReadUrl`).
- **Node 22** é independente; entra por último para isolar o risco.

## Implementation Strategy

Primeiro a fase A, que é o MVP: contém o disco e resolve a queixa da tela. Ela vai para produção sozinha. Em seguida vem a B (obrigação legal), depois a C e por fim a D, cada uma com o seu checkpoint de produção.
