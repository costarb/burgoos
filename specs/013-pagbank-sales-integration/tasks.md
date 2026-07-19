# Tasks: Integracao de Vendas PagBank

**Input**: Design documents from `/specs/013-pagbank-sales-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the specification and constitution for provider mapping, credential security, pagination, data integrity, idempotency, concurrency and tenant isolation. Test tasks must be implemented first and observed failing before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and does not depend on an incomplete task in the same phase.
- **[Story]**: Maps the task to a user story from spec.md.
- Every task includes an exact target file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature skeleton, shared contracts and deterministic test data.

- [X] T001 Create the sales integrations module and folder skeleton in apps/api/src/management/sales-integrations/sales-integrations.module.ts
- [X] T002 [P] Define shared provider, channel, capability, integration, run, day, movement and normalized sale types in packages/types/src/sales-integrations.ts
- [X] T003 Export sales integration contracts from packages/types/src/index.ts
- [X] T004 [P] Add sanitized PagBank transactional fixture responses for credit, installment, PIX, debit, boleto, split, cancellation and chargeback in apps/api/test/fixtures/pagbank-edi/
- [X] T005 [P] Add PagBank paginated, VALIDADO false, VALIDADO absent and provider-error fixtures in apps/api/test/fixtures/pagbank-edi/pagination-and-errors.ts
- [X] T006 Register SalesIntegrationsModule in apps/api/src/app.module.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add persistence, security and provider abstractions used by every story.

**CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T007 Add SalesProvider, SalesInputChannel, integration, credential, run, day and movement enums and models with tenant relations and durable ExternalSaleIdentity uniqueness in packages/database/prisma/schema.prisma
- [X] T008 Create the sales integration database migration with foreign keys, indexes and unique idempotency constraints in packages/database/prisma/migrations/20260717000000_pagbank_sales_integration/migration.sql
- [X] T009 [P] Add integrations.sales.view and integrations.sales.manage definitions to apps/api/src/management/access/permissions/permission-catalog.ts
- [X] T010 Update permission and sales integration seed data in packages/database/prisma/seed.ts
- [X] T011 [P] Write credential encryption, decryption, fingerprint, invalid production key and redaction tests in apps/api/src/security/integration-secret.service.spec.ts
- [X] T012 Extract reusable AES-256-GCM encryption, fingerprinting and environment-key validation into apps/api/src/security/integration-secret.service.ts
- [X] T013 Migrate delivery credential encryption calls to IntegrationSecretService without changing ciphertext compatibility in apps/api/src/management/integrations/delivery-integrations.service.ts
- [X] T014 [P] Define the SalesProviderAdapter interface, normalized day result and safe provider error taxonomy in apps/api/src/management/sales-integrations/sales-provider.adapter.ts
- [X] T015 Implement provider registration and capability lookup in apps/api/src/management/sales-integrations/sales-provider.registry.ts
- [X] T016 [P] Create validated DTOs for integration configuration, credential rotation, status, preview range, strategy, pagination and movement filters in apps/api/src/management/sales-integrations/dto/
- [X] T017 [P] Add shared API client methods and response typing for the OpenAPI contract in apps/web/lib/api.ts
- [X] T018 Validate and generate the Prisma client for packages/database/prisma/schema.prisma

**Checkpoint**: Database, security, permissions and provider registry are ready for story work.

---

## Phase 3: User Story 1 - Configurar a integracao PagBank (Priority: P1) MVP

**Goal**: Allow a tenant administrator to create, update and activate a PagBank EDI integration with a write-only encrypted token.

**Independent Test**: Create a PagBank integration, rotate its token, read it back without exposing the token, activate it and prove another tenant receives not found for the same UUID.

### Tests for User Story 1

- [X] T019 [P] [US1] Write service tests for tenant-scoped CRUD, credential rotation, activation prerequisites and redacted responses in apps/api/src/management/sales-integrations/sales-integration.service.spec.ts
- [X] T020 [P] [US1] Write HTTP contract and cross-tenant tests for provider catalog, integration CRUD, credential and status endpoints in apps/api/test/sales-integration-config.e2e.spec.ts
- [X] T021 [P] [US1] Write UI tests for PagBank USER/TOKEN entry, masked credential state and activation errors in apps/web/app/admin/orders/import/sales-integration-settings.spec.tsx

### Implementation for User Story 1

- [X] T022 [US1] Implement tenant-scoped configuration, safe serialization, credential rotation and status transitions in apps/api/src/management/sales-integrations/sales-integration.service.ts
- [X] T023 [US1] Implement provider catalog, integration CRUD, write-only credential and status REST endpoints with sales integration permissions in apps/api/src/management/sales-integrations/sales-integration.controller.ts
- [X] T024 [US1] Register controller, services, IntegrationSecretService and permission guards in apps/api/src/management/sales-integrations/sales-integrations.module.ts
- [X] T025 [US1] Build the PagBank integration settings form with USER, write-only TOKEN, credential fingerprint and activation controls in apps/web/app/admin/orders/import/sales-integration-settings.tsx
- [X] T026 [US1] Integrate the settings form and EDI coverage warning into the existing order import screen in apps/web/app/admin/orders/import/order-import-client.tsx

**Checkpoint**: PagBank credentials can be managed securely and independently of external querying.

---

## Phase 4: User Story 2 - Consultar vendas por periodo (Priority: P1)

**Goal**: Query each eligible date and all PagBank pages, persist a trustworthy preview and clearly block incomplete dates.

**Independent Test**: Preview a fixture-backed multi-day range containing paginated sales, an empty valid day and a non-validated day, then verify the consolidated counts and that only validated days contain importable movements.

### Tests for User Story 2

- [X] T027 [P] [US2] Write PagBank response-schema, event classification, payment mapping and normalized sale mapper tests using official fixtures in apps/api/src/management/sales-integrations/pagbank/pagbank-edi.mapper.spec.ts
- [X] T028 [P] [US2] Write PagBank client tests for URL dates, authentication headers, sequential pagination, VALIDADO parsing, timeout, 401, 429 and 5xx categorization in apps/api/src/management/sales-integrations/pagbank/pagbank-edi.client.spec.ts
- [X] T029 [P] [US2] Write preview orchestration tests for 31-day validation, current/future blocking, empty days, partial readiness, overlapping runs and persisted snapshots in apps/api/src/management/sales-integrations/sales-import-preview.service.spec.ts
- [X] T030 [P] [US2] Write HTTP tests for starting and polling a preview with cross-tenant run isolation in apps/api/test/sales-import-preview.e2e.spec.ts
- [X] T031 [P] [US2] Write UI tests for period selection, strategy fields, polling states, daily integrity and preview counts in apps/web/app/admin/orders/import/sales-import-preview.spec.tsx

### Implementation for User Story 2

- [X] T032 [P] [US2] Define and validate PagBank EDI v3.00 transactional response types in apps/api/src/management/sales-integrations/pagbank/pagbank-edi.types.ts
- [X] T033 [US2] Implement conservative sale/non-sale/unknown classification and normalized payment mapping in apps/api/src/management/sales-integrations/pagbank/pagbank-edi.mapper.ts
- [X] T034 [US2] Implement the daily PagBank EDI client with native fetch, safe auth headers, timeout, page traversal and VALIDADO extraction in apps/api/src/management/sales-integrations/pagbank/pagbank-edi.client.ts
- [X] T035 [US2] Implement PagBank provider capabilities and fetchDay adapter behavior in apps/api/src/management/sales-integrations/pagbank/pagbank-sales-provider.adapter.ts
- [X] T036 [US2] Register the PagBank adapter in apps/api/src/management/sales-integrations/sales-provider.registry.ts
- [X] T037 [US2] Implement preview run creation, inclusive date expansion, overlap protection, per-day persistence, movement deduplication and aggregate counts in apps/api/src/management/sales-integrations/sales-import-preview.service.ts
- [X] T038 [US2] Implement asynchronous in-process preview execution and restart-safe claiming of pending runs in apps/api/src/management/sales-integrations/sales-import-run.processor.ts
- [X] T039 [US2] Add create-run and get-run polling endpoints to apps/api/src/management/sales-integrations/sales-import.controller.ts
- [X] T040 [US2] Build the external sales period, strategy, progress, daily-integrity and summary interface in apps/web/app/admin/orders/import/sales-import-preview.tsx
- [X] T041 [US2] Connect the preview flow to the integration settings and existing import page in apps/web/app/admin/orders/import/order-import-client.tsx

**Checkpoint**: A PagBank period can be safely previewed without creating orders.

---

## Phase 5: User Story 3 - Importar vendas consultadas (Priority: P1)

**Goal**: Confirm a persisted preview and create historical orders transactionally with provider/channel idempotency, including duplicates previously imported by CSV.

**Independent Test**: Confirm a preview with valid, duplicate and malformed sales; verify only valid new orders are created, repeat and concurrently confirm the run, and observe zero duplicate orders or financial effects.

### Tests for User Story 3

- [X] T042 [P] [US3] Write normalized historical sale pipeline tests that preserve existing SIMPLE, Mercado Pago and PagBank CSV behavior in apps/api/test/historical-order-import.spec.ts
- [X] T043 [P] [US3] Write import service tests for per-sale transactions, durable identity conflict, retry after failure, non-sale rejection and partial success in apps/api/src/management/sales-integrations/sales-import-confirmation.service.spec.ts
- [X] T044 [P] [US3] Write HTTP tests for confirm idempotency, simultaneous confirmations, CSV/API duplicate identity and cross-tenant denial in apps/api/test/sales-import-confirmation.e2e.spec.ts
- [X] T045 [P] [US3] Write UI tests for confirmation warning, import progress and imported/duplicate/rejected/failed result groups in apps/web/app/admin/orders/import/sales-import-confirmation.spec.tsx

### Implementation for User Story 3

- [X] T046 [US3] Extract NormalizedHistoricalSale validation and transactional order creation from the CSV parser in apps/api/src/ordering/historical-order-import.service.ts
- [X] T047 [US3] Route SIMPLE, Mercado Pago and PagBank CSV parsing through NormalizedHistoricalSale while preserving current API results in apps/api/src/ordering/historical-order-import.service.ts
- [X] T048 [US3] Claim or resolve ExternalSaleIdentity atomically and map existing CSV external IDs to provider/channel identities in apps/api/src/management/sales-integrations/external-sale-identity.service.ts
- [X] T049 [US3] Implement confirmation state transitions, per-sale transactions, retries, identity conflicts, movement/order linking and final counts in apps/api/src/management/sales-integrations/sales-import-confirmation.service.ts
- [X] T050 [US3] Extend the run processor to claim and execute confirmed imports without duplicate processing in apps/api/src/management/sales-integrations/sales-import-run.processor.ts
- [X] T051 [US3] Add idempotent confirm-run endpoint and movement result serialization to apps/api/src/management/sales-integrations/sales-import.controller.ts
- [X] T052 [US3] Build confirmation, import progress and grouped outcome components in apps/web/app/admin/orders/import/sales-import-confirmation.tsx
- [X] T053 [US3] Integrate confirmation and resulting order links into apps/web/app/admin/orders/import/order-import-client.tsx

**Checkpoint**: Valid preview sales become historical orders exactly once, regardless of retries or input channel.

---

## Phase 6: User Story 4 - Acompanhar execucoes e falhas (Priority: P2)

**Goal**: Provide a tenant-scoped audit history with safe diagnostics for queries and imports.

**Independent Test**: Run one successful, one partially ready and one failed preview, list their histories, inspect day/movement results and confirm no credential or other-tenant data is exposed.

### Tests for User Story 4

- [X] T054 [P] [US4] Write history pagination, filter, retention and safe-error serialization tests in apps/api/src/management/sales-integrations/sales-import-history.service.spec.ts
- [X] T055 [P] [US4] Write history endpoint and cross-tenant movement access tests in apps/api/test/sales-import-history.e2e.spec.ts
- [X] T056 [P] [US4] Write history list, status, count, blocked-day and safe-error UI tests in apps/web/app/admin/orders/import/sales-import-history.spec.tsx

### Implementation for User Story 4

- [X] T057 [US4] Implement paginated run history, run detail and movement filtering with redacted errors in apps/api/src/management/sales-integrations/sales-import-history.service.ts
- [X] T058 [US4] Add list-runs and list-movements endpoints with tenant ownership checks to apps/api/src/management/sales-integrations/sales-import.controller.ts
- [X] T059 [US4] Add structured lifecycle logs with tenant, run, provider, dates, counts and safe error codes in apps/api/src/management/sales-integrations/sales-import-run.processor.ts
- [X] T060 [US4] Implement 180-day raw run/movement cleanup that preserves ExternalSaleIdentity in apps/api/src/management/sales-integrations/sales-import-retention.service.ts
- [X] T061 [US4] Build paginated history, execution detail, day status and movement result views in apps/web/app/admin/orders/import/sales-import-history.tsx
- [X] T062 [US4] Add history navigation and refresh behavior to apps/web/app/admin/orders/import/order-import-client.tsx

**Checkpoint**: Every execution is auditable without exposing secrets or cross-tenant records.

---

## Phase 7: User Story 5 - Adicionar novos providers sem alterar o fluxo comum (Priority: P3)

**Goal**: Prove that another provider/channel can use the common preview, normalization, idempotency and audit pipeline without PagBank conditionals.

**Independent Test**: Register a simulated provider with different capabilities, run its fixture data through preview and import, and verify common outputs while PagBank tests remain unchanged.

### Tests for User Story 5

- [X] T063 [P] [US5] Write registry contract tests that reject duplicate providers and validate declared settings and capabilities in apps/api/src/management/sales-integrations/sales-provider.registry.spec.ts
- [X] T064 [P] [US5] Write simulated provider end-to-end tests for alternate capabilities, normalized preview and common import results in apps/api/test/sales-provider-extensibility.e2e.spec.ts
- [X] T065 [P] [US5] Write capability-driven UI tests that hide unsupported settings and actions in apps/web/app/admin/orders/import/sales-provider-selector.spec.tsx

### Implementation for User Story 5

- [X] T066 [P] [US5] Implement a deterministic simulated sales provider adapter for automated tests in apps/api/src/management/sales-integrations/testing/simulated-sales-provider.adapter.ts
- [X] T067 [US5] Remove PagBank-specific branching from orchestration by consuming only SalesProviderAdapter capabilities in apps/api/src/management/sales-integrations/sales-import-preview.service.ts
- [X] T068 [US5] Expose capability-driven configuration metadata from the provider catalog in apps/api/src/management/sales-integrations/sales-integration.controller.ts
- [X] T069 [US5] Build provider and channel selection from declared capabilities in apps/web/app/admin/orders/import/sales-provider-selector.tsx
- [X] T070 [US5] Integrate capability-driven fields and actions into apps/web/app/admin/orders/import/order-import-client.tsx

**Checkpoint**: Provider-specific collection is replaceable while the business import flow stays common.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate security, performance, documentation and the complete operational flow.

- [X] T071 [P] Add OpenAPI decorators and examples matching specs/013-pagbank-sales-integration/contracts/sales-integrations.openapi.yaml to apps/api/src/management/sales-integrations/sales-integration.controller.ts
- [X] T072 [P] Add keyboard, mobile layout, loading, empty and error-state accessibility coverage to apps/web/app/admin/orders/import/order-import-client.spec.tsx
- [X] T073 Add run-count reconciliation and a 31,000-movement performance test in apps/api/src/management/sales-integrations/sales-import-preview.service.spec.ts
- [X] T074 Audit secret redaction across request errors, structured logs, persisted error messages and raw payloads in apps/api/src/management/sales-integrations/sales-import-run.processor.spec.ts
- [X] T075 Run Prisma validate/generate, API and web typecheck, lint and all feature tests and record results in specs/013-pagbank-sales-integration/quickstart.md
- [X] T076 Perform the fixture-driven manual flow and document evidence, limitations and token-pending production smoke steps in specs/013-pagbank-sales-integration/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **US1 Configuration (Phase 3)**: Starts after Foundational; provides the active integration required by real provider queries.
- **US2 Preview (Phase 4)**: Depends on Foundational and uses US1 for the real PagBank path; adapter tests can begin in parallel with late US1 UI work.
- **US3 Import (Phase 5)**: Depends on US2 persisted previews and the foundational identity model.
- **US4 History (Phase 6)**: Depends on run/day/movement persistence from US2; UI is most valuable after US3 outcomes exist.
- **US5 Extensibility (Phase 7)**: Depends on the common flow proven by US2 and US3.
- **Polish (Phase 8)**: Depends on all stories selected for the release.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3
                              |      |
                              +----> US4
                                     |
                              US3 --> US5
```

### Within Each User Story

- Write the listed tests first and confirm they fail for the missing behavior.
- Complete types/models before services, services before controllers, and API before UI integration.
- Keep tenant checks at every persistence boundary, not only in controllers.
- A story is complete only when its independent test passes without relying on a later story.

## Parallel Opportunities

- T002, T004 and T005 can run in parallel after T001 starts.
- T009, T011, T014, T016 and T017 can run in parallel after the schema direction in T007 is stable.
- Within US1, T019-T021 can be authored in parallel.
- Within US2, T027-T031 can be authored in parallel; T032 can proceed alongside preview orchestration test work.
- Within US3, T042-T045 can be authored in parallel; frontend T052 can begin once response types stabilize.
- US4 service/UI tests and US5 registry/UI tests can proceed in parallel after US3 contracts stabilize.
- T071 and T072 can run in parallel during polish.

## Parallel Examples

### User Story 1

```text
Task T019: Service tests for tenant-scoped config and credential rotation.
Task T020: HTTP and cross-tenant configuration tests.
Task T021: PagBank settings UI tests.
```

### User Story 2

```text
Task T027: PagBank mapper fixture tests.
Task T028: PagBank client pagination and error tests.
Task T029: Preview orchestration tests.
Task T031: Preview UI tests.
```

### User Story 3

```text
Task T042: Historical CSV regression tests.
Task T043: Transactional confirmation service tests.
Task T044: Concurrency and idempotency HTTP tests.
Task T045: Confirmation UI tests.
```

### User Story 4

```text
Task T054: History service tests.
Task T055: Tenant-isolated history endpoint tests.
Task T056: History UI tests.
```

### User Story 5

```text
Task T063: Provider registry contract tests.
Task T064: Simulated provider end-to-end tests.
Task T065: Capability-driven UI tests.
```

## Implementation Strategy

### MVP First

The smallest demonstrable slice is Setup + Foundation + US1: an administrator can securely configure and activate PagBank without exposing the token. The first business-value MVP is Setup + Foundation + US1 + US2 + US3, because it completes configuration, preview and actual historical order import.

1. Complete T001-T018.
2. Complete and independently validate US1 (T019-T026).
3. Complete and independently validate US2 (T027-T041) with fixtures and no real token.
4. Complete and independently validate US3 (T042-T053), then demonstrate end-to-end import and replay.
5. Add US4 operational history and US5 extensibility proof.
6. Finish security, performance and quickstart validation.

### Incremental Delivery

- **Increment 1**: Secure tenant-scoped provider configuration.
- **Increment 2**: Read-only PagBank preview with integrity evidence.
- **Increment 3**: Idempotent confirmation into historical orders.
- **Increment 4**: Auditable history and safe diagnostics.
- **Increment 5**: Capability-driven second-provider proof.

## Notes

- No automated test may call real PagBank endpoints.
- USER/TOKEN must never be written into fixtures, committed environment files, response snapshots or logs.
- Use the official examples as behavioral fixtures while keeping copied data sanitized and minimal.
- Preserve unrelated untracked workspace files throughout implementation.
