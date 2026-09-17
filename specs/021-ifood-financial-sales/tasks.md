# Tasks: Sincronização de Vendas Financeiras iFood

**Input**: Design documents from `/specs/021-ifood-financial-sales/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required because the feature changes financial totals, tenant isolation, external authentication, idempotency and order creation.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel in a different file after its phase prerequisites
- **[Story]**: User story from spec.md
- Every task includes an exact target path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish provider-specific file structure, fixtures and configuration surface.

- [x] T001 Create the iFood financial provider folder and module barrels in `apps/api/src/management/sales-integrations/ifood/`
- [x] T002 [P] Add sanitized Sales, Financial Events and Settlements fixtures in `apps/api/src/management/sales-integrations/ifood/__fixtures__/ifood-financial.fixtures.ts`
- [x] T003 [P] Add iFood Financial base URL, timeout and homologation-header configuration validation in `apps/api/src/config/env.validation.ts`
- [x] T004 [P] Document non-secret iFood Financial environment variables in `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, persistence, credential reuse and provider-neutral contracts required by all stories.

**CRITICAL**: No user story work begins until this phase is complete.

- [x] T005 Extend `SalesProvider`, `PaymentInstitution`, normalized payment methods, run counts and readiness/reconciliation contracts in `packages/types/src/sales-integrations.ts`
- [x] T006 [P] Export iFood financial view contracts and payment institution additions in `packages/types/src/index.ts`
- [x] T007 Add IFOOD enums, DeliveryIntegration environment, cross-module relation, financial sale/payment/installment/event/settlement/reconciliation-file/run entities and tenant-scoped indexes in `packages/database/prisma/schema.prisma`
- [x] T008 Create the forward-only migration with PRODUCTION backfill before replacing DeliveryIntegration uniqueness in `packages/database/prisma/migrations/20260904000000_ifood_financial_sales/migration.sql`
- [x] T009 [P] Add Prisma schema assertions for new uniqueness, tenant relations and nullable rollout fields in `packages/database/prisma/schema.spec.ts`
- [x] T010 Extend sales integration DTO validation for IFOOD and linked delivery integration in `apps/api/src/management/sales-integrations/dto/sales-integration.dto.ts`
- [x] T011 [P] Add contract tests for creating an IFOOD sales integration without accepting a duplicate credential in `apps/api/test/sales-integration.e2e-spec.ts`
- [x] T012 Implement tenant/merchant validation for linking an IFOOD sales integration to the operational connection in `apps/api/src/management/sales-integrations/sales-integration.service.ts`
- [x] T013 Implement a credential bridge that obtains and refreshes the operational iFood token without copying it in `apps/api/src/management/sales-integrations/ifood/ifood-financial-credential.service.ts`
- [x] T014 [P] Add credential bridge tests for tenant mismatch, merchant mismatch, expiry, refresh and redaction in `apps/api/src/management/sales-integrations/ifood/ifood-financial-credential.service.spec.ts`
- [x] T015 Register only the shared iFood credential bridge and financial persistence dependencies in `apps/api/src/management/sales-integrations/sales-integrations.module.ts`
- [x] T016 Generate the Prisma client and validate the schema using `packages/database/prisma/schema.prisma`

**Checkpoint**: Shared schema and safe iFood authorization are ready.

---

## Phase 3: User Story 1 - Consultar vendas iFood por período (Priority: P1) MVP

**Goal**: Query every sale page for a valid period and show a classified preview without changing orders.

**Independent Test**: Query a known merchant/period and compare IDs, totals, statuses, payment details and page coverage with the provider response; do not confirm import.

### Tests for User Story 1

- [x] T017 [P] [US1] Add client tests for page zero, pageCount completion, 90-day validation, timeout, 401, 403, 429/retry-after and 5xx in `apps/api/src/management/sales-integrations/ifood/ifood-financial.client.spec.ts`
- [x] T018 [P] [US1] Add mapper tests for concluded, cancelled, unknown status, timezone, multiple methods and unknown method in `apps/api/src/management/sales-integrations/ifood/ifood-sales.mapper.spec.ts`
- [x] T019 [P] [US1] Add adapter tests for date grouping, overlapping pages, empty intermediate pages and complete daily evidence in `apps/api/src/management/sales-integrations/ifood/ifood-sales-provider.adapter.spec.ts`
- [x] T020 [P] [US1] Add preview service tests for new, existing, cancelled, inconsistent and partially failed counts in `apps/api/src/management/sales-integrations/sales-import-preview.service.spec.ts`
- [x] T021 [P] [US1] Add UI tests for selecting iFood, period validation, progress and classified preview in `apps/web/app/admin/orders/import/ifood-financial-preview.spec.tsx`

### Implementation for User Story 1

- [x] T022 [P] [US1] Define and validate external Sales response types without leaking unknown payloads beyond the mapper in `apps/api/src/management/sales-integrations/ifood/ifood-financial.types.ts`
- [x] T023 [US1] Implement authenticated Sales range fetching, metadata pagination and safe error mapping in `apps/api/src/management/sales-integrations/ifood/ifood-financial.client.ts`
- [x] T024 [US1] Normalize sale identity, commercial date, status, basket totals and payment preview details in `apps/api/src/management/sales-integrations/ifood/ifood-sales.mapper.ts`
- [x] T025 [US1] Implement the IFOOD provider adapter with 90-day capability and per-business-day evidence in `apps/api/src/management/sales-integrations/ifood/ifood-sales-provider.adapter.ts`
- [x] T026 [US1] Register the IFOOD adapter in the provider registry initialization in `apps/api/src/management/sales-integrations/sales-integrations.module.ts`
- [x] T027 [US1] Generalize range prefetch and preview classifications for IFOOD without changing PagBank/Mercado Pago behavior in `apps/api/src/management/sales-integrations/sales-import-preview.service.ts`
- [x] T028 [US1] Extend sales import API views with existing/candidate/unknown classifications in `apps/api/src/management/sales-integrations/sales-import-history.service.ts`
- [x] T029 [P] [US1] Add web API types and calls for iFood preview metadata in `apps/web/lib/api.ts`
- [x] T030 [US1] Add iFood to the provider selector and render period/strategy controls in `apps/web/app/admin/orders/import/sales-integration-panel.tsx`
- [x] T031 [US1] Implement the classified iFood preview and accessible progress state in `apps/web/app/admin/orders/import/ifood-financial-panel.tsx`

**Checkpoint**: US1 can query and review complete periods without writing orders.

---

## Phase 4: User Story 2 - Importar vendas sem duplicar pedidos (Priority: P1)

**Goal**: Enrich matching operational orders and create consolidated historical orders only when absent.

**Independent Test**: Confirm a preview with one existing order and one absent sale, then repeat and race the import; exactly one historical order is created and the existing order is only enriched.

### Tests for User Story 2

- [x] T032 [P] [US2] Add identity tests that claim or attach an existing PlatformOrderLink by tenant, merchant, environment and external ID in `apps/api/src/management/sales-integrations/external-sale-identity.service.spec.ts`
- [x] T033 [P] [US2] Add confirmation tests for enrich, consolidated create, cancelled reject, repeat, resume and race outcomes in `apps/api/src/management/sales-integrations/sales-import-confirmation.service.spec.ts`
- [x] T034 [P] [US2] Add integration tests for operational-order versus financial-import concurrency and cross-tenant isolation in `apps/api/test/ifood-financial-sales-import.e2e-spec.ts`
- [x] T035 [P] [US2] Add historical item tests for fixed-product and explicit consolidated-origin notes in `apps/api/test/historical-order-import.spec.ts`
- [x] T036 [P] [US2] Add UI confirmation tests for product requirement, enrich/create counts and repeat result in `apps/web/app/admin/orders/import/ifood-financial-import.spec.tsx`

### Implementation for User Story 2

- [x] T037 [US2] Extend external identity resolution to attach an existing IFOOD PlatformOrderLink before claiming creation in `apps/api/src/management/sales-integrations/external-sale-identity.service.ts`
- [x] T038 [US2] Persist the canonical financial sale and link it atomically to an existing or claimed order identity in `apps/api/src/management/sales-integrations/ifood/ifood-financial-sale.service.ts`
- [x] T039 [US2] Add consolidated iFood historical-sale metadata and fixed-product validation in `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T040 [US2] Implement enrich-versus-create confirmation and recoverable race handling in `apps/api/src/management/sales-integrations/sales-import-confirmation.service.ts`
- [x] T041 [US2] Preserve operational order items, customer, status and total during financial enrichment in `apps/api/src/management/sales-integrations/ifood/ifood-financial-sale.service.ts`
- [x] T042 [US2] Add provider-neutral counters for enriched, created, reconciled and review-required outcomes in `apps/api/src/management/sales-integrations/sales-import-run.processor.ts`
- [x] T043 [US2] Display enrich/create/reject confirmation results and consolidated-data warning in `apps/web/app/admin/orders/import/ifood-financial-panel.tsx`

**Checkpoint**: US2 safely completes order history with no duplicate order.

---

## Phase 5: User Story 3 - Refletir corretamente valores e recebimentos (Priority: P1)

**Goal**: Preserve gross components, payments, liabilities, installments and receivable amounts without misleading aggregation.

**Independent Test**: Synchronize online, store-received, benefit, commission and installment fixtures; only iFood liabilities form iFood receivables and all totals match within R$ 0.01.

### Tests for User Story 3

- [x] T044 [P] [US3] Add value mapping tests for bag, delivery, service, benefit, customer paid and saleBalance separation in `apps/api/src/management/sales-integrations/ifood/ifood-sales.mapper.spec.ts`
- [x] T045 [P] [US3] Add persistence tests for multiple payments, raw unknown methods, liability and installment dates in `apps/api/src/management/sales-integrations/ifood/ifood-financial-sale.service.spec.ts`
- [x] T046 [P] [US3] Add report tests proving store-received payments do not inflate iFood receivables in `apps/api/src/management/reports/sales-report.service.spec.ts`
- [x] T047 [P] [US3] Add UI tests for gross/net labels, receiver, multiple methods, installments and unknown review state in `apps/web/app/admin/reports/sales/ifood-financial-details.spec.tsx`

### Implementation for User Story 3

- [x] T048 [US3] Extend the normalized sale contract with financial components, payment collection and raw mapping state in `packages/types/src/sales-integrations.ts`
- [x] T049 [US3] Map every payment, liability, card metadata and installment without scalar collapse in `apps/api/src/management/sales-integrations/ifood/ifood-sales.mapper.ts`
- [x] T050 [US3] Upsert financial sale, payments and installments transactionally with deterministic child keys in `apps/api/src/management/sales-integrations/ifood/ifood-financial-sale.service.ts`
- [x] T051 [US3] Calculate iFood receivable only from iFood liability and preserve store-received adjustments in `apps/api/src/management/sales-integrations/ifood/ifood-financial-sale.service.ts`
- [x] T052 [US3] Read iFood financial entities for provider-aware gross, net and receivable report totals in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T053 [US3] Add IFOOD to payment institution filters and labels in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T054 [US3] Render iFood financial composition, receiver and installment details in `apps/web/app/admin/reports/sales/ifood-financial-details.tsx`

**Checkpoint**: US3 presents accurate values and receivables for all payment responsibilities.

---

## Phase 6: User Story 4 - Reconciliar alterações e repasses (Priority: P2)

**Goal**: Import later financial events and settlements, calculate transfer-impact totals and show divergences without mutating orders destructively.

**Independent Test**: Reconcile a sale with later cancellation, informational event and divergent settlement; events remain idempotent, one order remains and the divergence is visible.

### Tests for User Story 4

- [x] T055 [P] [US4] Add Financial Events client/mapper tests for 33-day windows, one-based pagination, signs, impact and expected dates in `apps/api/src/management/sales-integrations/ifood/ifood-financial-events.spec.ts`
- [x] T056 [P] [US4] Add Settlements and Reconciliation On Demand tests for title types, status, dates, async polling, six-hour reuse and temporary download in `apps/api/src/management/sales-integrations/ifood/ifood-settlements.spec.ts`
- [x] T057 [P] [US4] Add reconciliation tests for idempotent events, R$ 0.01 tolerance, partial resume and no destructive order mutation in `apps/api/src/management/sales-integrations/ifood/ifood-financial-reconciliation.service.spec.ts`
- [x] T058 [P] [US4] Add endpoint contract tests for create/list/get tenant-owned reconciliation runs in `apps/api/test/ifood-financial-reconciliation.e2e-spec.ts`
- [x] T059 [P] [US4] Add UI tests for reconciliation progress, impact filtering, divergences and on-demand file download in `apps/web/app/admin/orders/import/ifood-financial-reconciliation.spec.tsx`

### Implementation for User Story 4

- [x] T060 [US4] Add paginated Financial Events, Settlements and asynchronous Reconciliation On Demand requests to `apps/api/src/management/sales-integrations/ifood/ifood-financial.client.ts`
- [x] T061 [US4] Normalize events, signs, impact, dates, titles and settlements in `apps/api/src/management/sales-integrations/ifood/ifood-financial-reconciliation.mapper.ts`
- [x] T062 [US4] Implement resumable event/settlement upserts, fixed R$ 0.01 divergence and six-hour reconciliation-file request reuse in `apps/api/src/management/sales-integrations/ifood/ifood-financial-reconciliation.service.ts`
- [x] T063 [US4] Register durable manual/daily reconciliation jobs in `apps/api/src/management/sales-integrations/ifood/ifood-financial-reconciliation.processor.ts`
- [x] T064 [US4] Implement create/list/get reconciliation plus request/status/download file endpoints from the OpenAPI contract in `apps/api/src/management/sales-integrations/ifood/ifood-financial.controller.ts`
- [x] T065 [US4] Register reconciliation controller, service and processor in `apps/api/src/management/sales-integrations/sales-integrations.module.ts`
- [x] T066 [P] [US4] Add web API calls and view types for reconciliation runs and on-demand files in `apps/web/lib/api.ts`
- [x] T067 [US4] Render reconciliation history, impact totals, dates, divergences and on-demand file status/download in `apps/web/app/admin/orders/import/ifood-financial-panel.tsx`

**Checkpoint**: US4 reconciles later changes and settlements without duplicate/destructive orders.

---

## Phase 7: User Story 5 - Administrar saúde e homologação (Priority: P2)

**Goal**: Expose financial access health and block production until required evidence is complete.

**Independent Test**: Exercise ready, propagation-pending, expired, forbidden, rate-limited, partial and non-homologated states; each shows a safe action and production remains blocked without evidence.

### Tests for User Story 5

- [x] T068 [P] [US5] Add readiness tests for permission propagation, merchant mismatch, expiry and homologation gates in `apps/api/src/management/sales-integrations/ifood/ifood-financial-readiness.service.spec.ts`
- [x] T069 [P] [US5] Add endpoint security tests for permissions, tenant isolation and secret redaction in `apps/api/test/ifood-financial-readiness.e2e-spec.ts`
- [x] T070 [P] [US5] Add UI tests for readiness checks, recovery actions, coverage and production blocking in `apps/web/app/admin/orders/import/ifood-financial-readiness.spec.tsx`
- [x] T071 [P] [US5] Add audit redaction tests for token, document, bank metadata and NSU fields in `apps/api/src/management/sales-integrations/integration-audit.service.spec.ts`

### Implementation for User Story 5

- [x] T072 [US5] Implement financial merchant permission validation and ten-minute propagation state in `apps/api/src/management/sales-integrations/ifood/ifood-financial-readiness.service.ts`
- [x] T073 [US5] Implement homologation evidence checks and READY_PRODUCTION gate in `apps/api/src/management/sales-integrations/ifood/ifood-financial-readiness.service.ts`
- [x] T074 [US5] Implement GET/POST readiness endpoints from the OpenAPI contract in `apps/api/src/management/sales-integrations/ifood/ifood-financial.controller.ts`
- [x] T075 [US5] Emit safe audit events for linkage, validation, preview, confirmation, reconciliation and gate changes in `apps/api/src/management/sales-integrations/integration-audit.service.ts`
- [x] T076 [US5] Enforce token/document/bank/NSU redaction for iFood financial payloads in `apps/api/src/security/integration-secret.service.ts`
- [x] T077 [P] [US5] Add readiness and evidence calls to the web client in `apps/web/lib/api.ts`
- [x] T078 [US5] Render connection, permission, coverage, errors, recovery and production gate in `apps/web/app/admin/orders/import/ifood-financial-panel.tsx`

**Checkpoint**: US5 makes health actionable and prevents premature production use.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate compatibility, operations, documentation and release safety across all stories.

- [x] T079 [P] Add OpenAPI implementation parity tests for `specs/021-ifood-financial-sales/contracts/ifood-financial-admin.openapi.yaml` in `apps/api/test/ifood-financial-contract.spec.ts`
- [x] T080 [P] Add structured logging and metrics for page coverage, retry, dedupe, latency and reconciliation in `apps/api/src/management/sales-integrations/ifood/ifood-financial-observability.service.ts`
- [x] T081 Add retention cleanup for redacted iFood financial raw payloads without deleting canonical totals in `apps/api/src/management/sales-integrations/sales-import-retention.service.ts`
- [x] T082 Run Prisma format/generate/validate and inspect the migration at `packages/database/prisma/schema.prisma`
- [x] T083 Run API and web typecheck, lint and full test suites from `package.json`
- [x] T084 Run PagBank, Mercado Pago and operational iFood regression suites listed in `specs/021-ifood-financial-sales/quickstart.md`
- [x] T085 Validate responsive administrative flows and accessibility in `apps/web/app/admin/orders/import/ifood-financial-panel.tsx`
- [x] T086 Execute the local smoke, retry, race, isolation and monetary checks in `specs/021-ifood-financial-sales/quickstart.md`
- [x] T087 Record sanitized test-environment evidence and unresolved provider observations in `specs/021-ifood-financial-sales/homologation-results.md`
- [x] T088 Reconcile implementation changes back into `specs/021-ifood-financial-sales/spec.md`, `specs/021-ifood-financial-sales/plan.md` and `specs/021-ifood-financial-sales/contracts/ifood-financial-admin.openapi.yaml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: starts immediately.
- **Foundational**: depends on Setup and blocks every story.
- **US1**: starts after Foundational; no other story dependency.
- **US2**: depends on US1 normalized previews and identities.
- **US3**: depends on US1 canonical sales; can overlap late US2 work after the canonical sale service exists.
- **US4**: depends on US3 financial components and can proceed independently of the historical-order UI.
- **US5**: depends on the credential bridge; readiness basics can run after Foundational, while production evidence depends on US1-US4.
- **Polish**: depends on all stories included in the release.

### User Story Graph

```text
Setup -> Foundation -> US1 -> US2
                         \-> US3 -> US4
                  \-> US5 readiness
US1 + US2 + US3 + US4 -> US5 production gate -> Polish
```

### Parallel Opportunities

- T002-T004 run in parallel.
- T006, T009, T011 and T014 can run alongside sequential schema/service foundation work.
- US1 tests T017-T021 run in parallel before implementation.
- US2 tests T032-T036 run in parallel; historical import and identity work use separate files.
- US3 tests T044-T047 run in parallel.
- US4 tests T055-T059 run in parallel; web client T066 can overlap API service work.
- US5 tests T068-T071 run in parallel; web call T077 can overlap readiness implementation.
- T079 and T080 can run in parallel before final sequential validation.

## Parallel Examples

### User Story 1

```text
T017 Client pagination/error tests
T018 Sales mapper tests
T019 Adapter coverage tests
T020 Preview classification tests
T021 Preview UI tests
```

### User Story 2

```text
T032 Identity/link tests
T033 Confirmation tests
T034 Concurrency E2E
T035 Historical item tests
T036 Confirmation UI tests
```

### User Story 3

```text
T044 Value mapper tests
T045 Persistence tests
T046 Report tests
T047 Financial details UI tests
```

### User Story 4

```text
T055 Financial Events tests
T056 Settlements tests
T057 Reconciliation service tests
T058 Endpoint E2E
T059 Reconciliation UI tests
```

### User Story 5

```text
T068 Readiness service tests
T069 Security E2E
T070 Readiness UI tests
T071 Audit redaction tests
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational.
2. Complete US1 through T031.
3. Stop and validate query coverage/preview without modifying orders.
4. Demonstrate provider access and resolve payload observations before enabling confirmation.

### Incremental Delivery

1. US1: safe read-only preview.
2. US2: deduplicated enrich/create.
3. US3: correct financial representation and reporting.
4. US4: events and settlements reconciliation.
5. US5: operational health and production gate.
6. Polish and formal homologation evidence.

### Release Gates

- Do not enable order confirmation until US2 race/idempotency tests pass.
- Do not expose iFood receivable totals until US3 monetary acceptance passes.
- Do not enable automated reconciliation until US4 resume tests pass.
- Do not enable production until US5 evidence is complete and the provider approves homologation.

## Notes

- Write story tests first and confirm they fail for the intended reason.
- Preserve unknown external codes rather than guessing mappings.
- Never copy iFood credentials into the sales integration.
- Never log provider payloads before redaction.
- Commit after each task or coherent task group.
- Stop at each checkpoint for independent validation.
