# Tasks: Filtros de Pesquisa em Contas a Pagar

**Input**: Design documents from `/specs/009-payables-search-filters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included because the feature specification requires independently testable user stories and the implementation plan calls for Vitest/integration/web interaction coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing financial-payables surface and prepare shared contracts for filters.

- [x] T001 Review existing accounts-payable API, UI, and shared type paths in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`, `apps/api/src/management/financial/dto/payable.dto.ts`, `apps/web/app/admin/finance/payables/payables-client.tsx`, `apps/web/lib/api.ts`, and `packages/types/src/index.ts`
- [x] T002 [P] Add shared `PayablesFilters` type with `start`, `end`, `status`, `categoryId`, `supplierId`, and `competenceMonth` in `packages/types/src/index.ts`
- [x] T003 [P] Align the accounts-payable API helper filter signature with `PayablesFilters` in `apps/web/lib/api.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared validation and query support required by all filter stories.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Add `competenceMonth` validation to `PayablesQueryDto` in `apps/api/src/management/financial/dto/payable.dto.ts`
- [x] T005 Add month parsing helpers for `YYYY-MM` competence filters in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`
- [x] T006 Extend `AccountsPayableService.buildWhere` to apply `competenceMonth` as a monthly range over `Payable.competenceDate` in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`
- [x] T007 [P] Update accounts-payable contract notes for `competenceMonth`, `categoryId`, and `supplierId` in `specs/009-payables-search-filters/contracts/openapi.yaml`
- [x] T008 [P] Verify whether a `tenantId, competenceDate` index is needed for pilot data volume and document the decision in `specs/009-payables-search-filters/quickstart.md`

**Checkpoint**: Backend and shared filter contract can support all user-story filters.

---

## Phase 3: User Story 1 - Filtrar contas por categoria (Priority: P1) MVP

**Goal**: Let the financial user filter accounts payable by Categoria.

**Independent Test**: Select one category in the accounts-payable search and verify every returned row belongs to that category; select a category with no results and verify the empty state keeps the selected filter.

### Tests for User Story 1

- [x] T009 [P] [US1] Add service test for filtering payables by `categoryId` and recalculating summary in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts`
- [x] T010 [P] [US1] Add web interaction test for selecting Categoria and preserving empty-state filters in `apps/web/app/admin/finance/payables/payables-client.spec.tsx`

### Implementation for User Story 1

- [x] T011 [US1] Add `categoryId` to payables filter state and clear-filter defaults in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T012 [US1] Render a Categoria select using `options.categories` in the payables filter area in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T013 [US1] Pass `categoryId` through `applyFilters`, `clearFilters`, and `refresh` in `apps/web/app/admin/finance/payables/payables-client.tsx`

**Checkpoint**: Categoria filtering works independently from other new filters.

---

## Phase 4: User Story 2 - Filtrar contas por fornecedor (Priority: P1)

**Goal**: Let the financial user filter accounts payable by Fornecedor.

**Independent Test**: Select one supplier in the accounts-payable search and verify every returned row belongs to that supplier; remove the supplier filter and verify results are no longer restricted by supplier.

### Tests for User Story 2

- [x] T014 [P] [US2] Add service test for filtering payables by `supplierId` and excluding other suppliers in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts`
- [x] T015 [P] [US2] Add web interaction test for selecting and clearing Fornecedor in `apps/web/app/admin/finance/payables/payables-client.spec.tsx`

### Implementation for User Story 2

- [x] T016 [US2] Add `supplierId` to payables filter state and clear-filter defaults in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T017 [US2] Render a Fornecedor select using `options.suppliers` in the payables filter area in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T018 [US2] Pass `supplierId` through `applyFilters`, `clearFilters`, and `refresh` in `apps/web/app/admin/finance/payables/payables-client.tsx`

**Checkpoint**: Fornecedor filtering works independently from other new filters.

---

## Phase 5: User Story 3 - Filtrar contas por mes de referencia (Priority: P1)

**Goal**: Let the financial user filter accounts payable by Mes de referencia.

**Independent Test**: Select a reference month and verify every returned row belongs to that competence month, independent of due date; select a month without payables and verify the empty state keeps the selected month.

### Tests for User Story 3

- [x] T019 [P] [US3] Add service test for `competenceMonth=YYYY-MM` filtering by `competenceDate` monthly range in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts`
- [x] T020 [P] [US3] Add query validation test for invalid `competenceMonth` values in `apps/api/test/accounts-payable.integration.spec.ts`
- [x] T021 [P] [US3] Add web interaction test for selecting Mes de referencia and preserving empty-state filters in `apps/web/app/admin/finance/payables/payables-client.spec.tsx`

### Implementation for User Story 3

- [x] T022 [US3] Add `competenceMonth` to payables filter state and clear-filter defaults in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T023 [US3] Render a Mes de referencia month input in the payables filter area in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T024 [US3] Pass `competenceMonth` through `applyFilters`, `clearFilters`, and `refresh` in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T025 [US3] Ensure payables without `competenceDate` are excluded only when `competenceMonth` is selected in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`

**Checkpoint**: Mes de referencia filtering works independently from category and supplier filters.

---

## Phase 6: User Story 4 - Combinar filtros de pesquisa (Priority: P2)

**Goal**: Let the financial user combine Categoria, Fornecedor, Mes de referencia and existing filters, then clear all filters in one action.

**Independent Test**: Select category, supplier, reference month, due-date period and status together, then verify every result satisfies all criteria; click Limpar and verify all filter controls return to the initial empty state.

### Tests for User Story 4

- [x] T026 [P] [US4] Add integration test for combined `categoryId`, `supplierId`, `competenceMonth`, `start`, `end`, and `status` filters in `apps/api/test/accounts-payable.integration.spec.ts`
- [x] T027 [P] [US4] Add web interaction test for combined filters and clearing all filters in `apps/web/app/admin/finance/payables/payables-client.spec.tsx`

### Implementation for User Story 4

- [x] T028 [US4] Refactor payables filter defaults into a single typed constant in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T029 [US4] Adjust the filters grid layout to fit six filter controls plus Filtrar and Limpar responsively in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T030 [US4] Ensure summary totals use only filtered items for every combined filter path in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`
- [x] T031 [US4] Verify options returned by `/api/admin/financial/payables/options` remain active and tenant-scoped in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`

**Checkpoint**: All new filters combine correctly with each other and with existing search filters.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, docs, and cleanup across all stories.

- [x] T032 [P] Update quickstart validation results for category, supplier, reference month, combined filters, and clear action in `specs/009-payables-search-filters/quickstart.md`
- [x] T033 [P] Run formatting for changed TypeScript files in `apps/api/src/management/financial/dto/payable.dto.ts`, `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`, `apps/web/app/admin/finance/payables/payables-client.tsx`, `apps/web/lib/api.ts`, and `packages/types/src/index.ts`
- [x] T034 Run backend and frontend tests covering accounts-payable filters and document any residual gaps in `specs/009-payables-search-filters/quickstart.md`
- [x] T035 Run `git diff --check` and resolve whitespace or formatting issues across changed files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phase 3-6)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; no dependency on other stories.
- **User Story 2 (P1)**: Can start after Foundational; no dependency on US1.
- **User Story 3 (P1)**: Can start after Foundational; no dependency on US1 or US2.
- **User Story 4 (P2)**: Depends on US1, US2 and US3 for the complete combined-filter experience.

### Within Each User Story

- Write tests first and confirm they fail before implementation.
- API/service behavior must be complete before relying on UI validation.
- UI filter controls must preserve selected values after search.
- Each story checkpoint should pass before moving to the next story in sequential delivery.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T007 and T008 can run in parallel with foundational backend work after T004 starts.
- US1, US2 and US3 can be implemented in parallel after Phase 2 if contributors coordinate edits to `payables-client.tsx`.
- Test tasks within each story can run in parallel with other story test tasks when using separate working copies or careful file coordination.
- Polish tasks T032 and T033 can run in parallel before final test execution.

---

## Parallel Example: User Story 1

```bash
Task: "Add service test for filtering payables by categoryId and recalculating summary in apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts"
Task: "Add web interaction test for selecting Categoria and preserving empty-state filters in apps/web/app/admin/finance/payables/payables-client.spec.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add service test for filtering payables by supplierId and excluding other suppliers in apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts"
Task: "Add web interaction test for selecting and clearing Fornecedor in apps/web/app/admin/finance/payables/payables-client.spec.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Add service test for competenceMonth=YYYY-MM filtering by competenceDate monthly range in apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts"
Task: "Add web interaction test for selecting Mes de referencia and preserving empty-state filters in apps/web/app/admin/finance/payables/payables-client.spec.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for Categoria filtering.
3. Validate User Story 1 independently through service and web tests.
4. Demo category filtering before adding the remaining filters.

### Incremental Delivery

1. Add Categoria filter and validate independently.
2. Add Fornecedor filter and validate independently.
3. Add Mes de referencia filter and validate independently.
4. Add combined-filter validation and clear-all polish.

### Notes

- `[P]` tasks touch different files or can be performed independently with coordination.
- `[US1]`, `[US2]`, `[US3]`, and `[US4]` map directly to the prioritized user stories in `spec.md`.
- Avoid changing payable creation, payment, reversal, cancellation, or audit behavior while implementing this feature.
