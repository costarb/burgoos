# Tasks: Manutencao Auditavel de Pedidos

**Input**: Design documents from `/specs/005-order-maintenance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required because the feature changes critical order, inventory, financial and tenant-isolation behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no incomplete dependency
- **[Story]**: User story mapped from the specification
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish explicit contracts and shared implementation surfaces.

- [x] T001 Add order maintenance actions, snapshots, request and response types in `packages/types/src/index.ts`
- [x] T002 [P] Add shared order maintenance validation helpers and tests in `apps/api/src/ordering/order-maintenance-validation.ts` and `apps/api/test/order-maintenance.spec.ts`
- [x] T003 [P] Add reusable OWNER/ADMIN authorization guard in `apps/api/src/platform/auth/roles.guard.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persist logical deletion/audit and make existing order-derived queries deletion-aware.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add `OrderMaintenanceAction`, order deletion fields, user/order relations and `OrderMaintenance` model in `packages/database/prisma/schema.prisma`
- [x] T005 Create the order maintenance Prisma migration in `packages/database/prisma/migrations/20260603190000_order_maintenance/migration.sql`
- [x] T006 Regenerate and validate the Prisma client from `packages/database/prisma/schema.prisma`
- [ ] T007 [P] Add integration tests proving standard queue/history and status transitions ignore or reject logically deleted orders in `apps/api/test/order-maintenance.integration.spec.ts`
- [ ] T008 [P] Add integration tests proving sales report, DRE, financial dashboard and menu engineering exclude logically deleted orders in `apps/api/test/order-maintenance-reports.integration.spec.ts`
- [x] T009 Filter logically deleted orders from operational listing and reject their status transitions in `apps/api/src/ordering/ordering.service.ts`
- [x] T010 [P] Filter logically deleted orders from sales reports in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T011 [P] Filter logically deleted orders from DRE in `apps/api/src/management/reports/dre.service.ts`
- [x] T012 [P] Filter logically deleted orders from basic summaries, financial dashboard and menu engineering in `apps/api/src/management/reports.service.ts`, `apps/api/src/management/reports/financial-dashboard.service.ts` and `apps/api/src/management/reports/menu-engineering.service.ts`
- [x] T013 Preserve deleted external payment identifiers in duplicate import checks in `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T014 Register the maintenance service and authorization dependencies in `apps/api/src/ordering/ordering.module.ts`

**Checkpoint**: Logical deletion and audit persistence are available, and existing behavior is deletion-aware.

---

## Phase 3: User Story 1 - Corrigir pedido na fila (Priority: P1) MVP

**Goal**: Allow OWNER/ADMIN users to edit active orders while keeping totals, reservations and audit history consistent.

**Independent Test**: Edit an active order's item quantity, customer and payment data; confirm its total and reservation reflect only the corrected version and an audit record is created.

### Tests for User Story 1

- [x] T015 [P] [US1] Add unit tests for total/payment validation, required reasons and optimistic concurrency in `apps/api/test/order-maintenance.spec.ts`
- [ ] T016 [P] [US1] Add integration tests for tenant-scoped active-order editing, reservation reconciliation, rollback and authorization in `apps/api/test/order-maintenance.integration.spec.ts`
- [ ] T017 [P] [US1] Add focused web tests for active-order edit success, validation error, conflict and progress feedback in `apps/web/app/admin/orders/order-maintenance-dialog.spec.tsx`

### Implementation for User Story 1

- [x] T018 [US1] Implement tenant-scoped order loading, snapshot creation, optimistic concurrency and maintainable field validation in `apps/api/src/ordering/order-maintenance.service.ts`
- [x] T019 [US1] Add transaction-aware inventory helpers to neutralize and reapply active reservations in `apps/api/src/operations/inventory/inventory.service.ts`
- [x] T020 [US1] Implement transactional active-order item/data replacement and immutable `EDIT` audit creation in `apps/api/src/ordering/order-maintenance.service.ts`
- [x] T021 [US1] Add edit DTO validation in `apps/api/src/ordering/dto/edit-order.dto.ts`
- [x] T022 [US1] Expose `PATCH /api/admin/orders/:id/maintenance` with OWNER/ADMIN authorization in `apps/api/src/ordering/admin-order.controller.ts`
- [x] T023 [P] [US1] Add edit-order API client contracts in `apps/web/lib/api.ts`
- [x] T024 [US1] Build the active-order edit dialog with item, customer, fulfillment, payment, reason and conflict states in `apps/web/app/admin/orders/order-maintenance-dialog.tsx`
- [x] T025 [US1] Add edit actions and refresh corrected active orders in `apps/web/app/admin/orders/orders-client.tsx`

**Checkpoint**: Active-order editing is independently usable and validated.

---

## Phase 4: User Story 2 - Corrigir pedido finalizado (Priority: P2)

**Goal**: Correct delivered or cancelled orders and reconcile all inventory and financial effects without duplication.

**Independent Test**: Edit a delivered order's date, payment and item quantity; confirm inventory, sales report, receivables, DRE and profitability reflect only the corrected version.

### Tests for User Story 2

- [ ] T026 [P] [US2] Add integration tests for delivered/cancelled edits, inventory compensation, snapshot replacement and full rollback in `apps/api/test/order-maintenance-finalized.integration.spec.ts`
- [ ] T027 [P] [US2] Add report regression tests for corrected delivered-order dates, gross/net values and receivables in `apps/api/test/order-maintenance-reports.integration.spec.ts`
- [x] T028 [P] [US2] Add focused web tests for finalized-order warning, mandatory reason and corrected history row in `apps/web/app/admin/orders/order-maintenance-dialog.spec.tsx`

### Implementation for User Story 2

- [x] T029 [US2] Add transaction-aware inventory compensation and corrected delivered-consumption helpers in `apps/api/src/operations/inventory/inventory.service.ts`
- [x] T030 [US2] Add transaction-aware profitability snapshot removal/recreation helpers in `apps/api/src/management/reports/order-profitability.service.ts`
- [x] T031 [US2] Extend transactional edit orchestration for delivered and cancelled orders in `apps/api/src/ordering/order-maintenance.service.ts`
- [x] T032 [US2] Add finalized-order financial impact warning and mandatory reason behavior in `apps/web/app/admin/orders/order-maintenance-dialog.tsx`
- [x] T033 [US2] Add edit actions for delivered and cancelled rows in `apps/web/app/admin/orders/orders-client.tsx`

**Checkpoint**: Finalized-order corrections update all realized results without duplication.

---

## Phase 5: User Story 3 - Excluir pedido com seguranca (Priority: P2)

**Goal**: Logically delete active or finalized orders, compensate their effects and preserve an auditable record.

**Independent Test**: Delete one active and one delivered order with reasons; confirm they leave standard views/results, effects are compensated and records remain searchable for maintenance.

### Tests for User Story 3

- [ ] T034 [P] [US3] Add integration tests for active/delivered/cancelled logical deletion, compensation, repeated deletion and tenant isolation in `apps/api/test/order-maintenance-delete.integration.spec.ts`
- [x] T035 [P] [US3] Add focused web tests for delete confirmation, required reason, success and error feedback in `apps/web/app/admin/orders/order-maintenance-dialog.spec.tsx`
- [ ] T036 [P] [US3] Add report regression tests proving deleted orders leave all standard totals in `apps/api/test/order-maintenance-reports.integration.spec.ts`

### Implementation for User Story 3

- [x] T037 [US3] Implement transactional logical deletion, effect compensation and immutable `DELETE` audit creation in `apps/api/src/ordering/order-maintenance.service.ts`
- [x] T038 [US3] Add logical deletion DTO validation in `apps/api/src/ordering/dto/delete-order.dto.ts`
- [x] T039 [US3] Expose `DELETE /api/admin/orders/:id/maintenance` with OWNER/ADMIN authorization in `apps/api/src/ordering/admin-order.controller.ts`
- [x] T040 [P] [US3] Add logical deletion API client contract in `apps/web/lib/api.ts`
- [x] T041 [US3] Build deletion confirmation with impact warning, mandatory reason and progress feedback in `apps/web/app/admin/orders/order-maintenance-dialog.tsx`
- [x] T042 [US3] Add delete actions and remove deleted orders from standard queue/history state in `apps/web/app/admin/orders/orders-client.tsx`

**Checkpoint**: Active and finalized orders can be safely removed without losing evidence.

---

## Phase 6: User Story 4 - Consultar historico de alteracoes (Priority: P3)

**Goal**: Search maintainable/deleted orders and inspect their immutable maintenance timeline.

**Independent Test**: Perform two edits and one deletion, search including deleted orders, and confirm the timeline shows actor, reason, time, changed data and impact summary.

### Tests for User Story 4

- [ ] T043 [P] [US4] Add integration tests for maintenance search, audit history ordering, deleted-order visibility and tenant isolation in `apps/api/test/order-maintenance-history.integration.spec.ts`
- [ ] T044 [P] [US4] Add focused web tests for maintenance filters, deleted results and audit timeline in `apps/web/app/admin/orders/maintenance/order-maintenance-page.spec.tsx`

### Implementation for User Story 4

- [x] T045 [US4] Implement tenant-scoped maintenance search and audit-history queries in `apps/api/src/ordering/order-maintenance.service.ts`
- [x] T046 [US4] Add maintenance search query validation in `apps/api/src/ordering/dto/order-maintenance-query.dto.ts`
- [x] T047 [US4] Expose maintenance search and history endpoints in `apps/api/src/ordering/admin-order.controller.ts`
- [x] T048 [P] [US4] Add maintenance search/history API client contracts in `apps/web/lib/api.ts`
- [x] T049 [US4] Build the maintenance search page with period, status, identifier and deleted-order filters in `apps/web/app/admin/orders/maintenance/page.tsx`
- [x] T050 [US4] Build the immutable audit timeline and before/after change summary in `apps/web/app/admin/orders/maintenance/page.tsx`
- [x] T051 [US4] Add navigation from the orders page to maintenance search/history in `apps/web/app/admin/orders/orders-client.tsx`

**Checkpoint**: Administrators can locate and explain every correction or deletion.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete maintenance lifecycle and production readiness.

- [ ] T052 [P] Add E2E coverage for active edit, delivered edit, logical deletion and audit inspection in `apps/api/test/order-maintenance-flow.e2e.spec.ts`
- [x] T053 [P] Update API contract examples and implementation notes in `specs/005-order-maintenance/contracts/openapi.yaml` and `specs/005-order-maintenance/quickstart.md`
- [x] T054 Add structured maintenance logs without duplicating sensitive snapshot data in `apps/api/src/ordering/order-maintenance.service.ts`
- [ ] T055 Run the manual validation workflow in `specs/005-order-maintenance/quickstart.md`
- [x] T056 Run workspace typecheck, lint and test scripts defined in `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **US1 (Phase 3)**: Starts after Foundational and is the recommended MVP.
- **US2 (Phase 4)**: Depends on US1 transaction/edit orchestration.
- **US3 (Phase 5)**: Depends on Foundational inventory/profitability helpers; can begin alongside US2 after shared helpers stabilize.
- **US4 (Phase 6)**: Depends on audit records from US1/US3 but its query/UI work can start after Foundational.
- **Polish (Phase 7)**: Depends on all selected stories.

### User Story Dependencies

- **US1**: Establishes the core edit transaction and audit creation.
- **US2**: Extends US1 for finalized-order reconciliation.
- **US3**: Reuses audit and compensation foundations but delivers an independent deletion flow.
- **US4**: Reads audit/deletion data produced by prior stories.

### Parallel Opportunities

- T002 and T003 can run in parallel.
- T007 and T008 can run in parallel; T010-T012 can run in parallel afterward.
- Tests marked `[P]` within each story can be authored in parallel.
- Web API client work can run in parallel with backend service implementation after contracts are fixed.
- US2 finalized-order reconciliation and US4 read-only search UI can proceed in parallel after US1 audit contracts exist.

---

## Parallel Example: User Story 1

```text
Task: T015 Add unit tests for validation and optimistic concurrency
Task: T016 Add integration tests for active-order editing
Task: T017 Add focused web tests for the edit dialog
Task: T023 Add edit-order API client contracts
```

## Parallel Example: User Story 3

```text
Task: T034 Add logical deletion integration tests
Task: T035 Add delete-dialog web tests
Task: T036 Add deleted-order report regression tests
Task: T040 Add logical deletion API client contract
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 active-order editing.
3. Validate totals, inventory reservation, authorization, concurrency and audit.
4. Demo/deploy the MVP before adding finalized-order correction.

### Incremental Delivery

1. Foundation: logical deletion schema, audit entity and deletion-aware queries.
2. US1: active-order editing.
3. US2: finalized-order correction and recalculation.
4. US3: safe logical deletion.
5. US4: maintenance search and audit timeline.
6. Complete E2E/manual validation and quality gates.

## Notes

- Preserve existing stock movements; corrections use compensating movements.
- Never expose maintenance mutations to `OPERATOR`.
- Keep each edit/delete and all related effects inside one transaction.
- Standard reports and order views must consistently exclude logically deleted orders.
- Commit after each task or cohesive task group.
