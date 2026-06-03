# Tasks: Relatorios de Vendas e Pedidos

**Input**: Design documents from `/specs/004-relatorios-vendas-pedidos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included because the specification and plan require validation for totals, local date grouping, filters, tenant isolation and analytical consistency.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel because it touches different files or does not depend on incomplete tasks
- **[Story]**: User story label from `spec.md`
- Every task includes exact target file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the report module surface and shared contracts.

- [ ] T001 Add shared sales report request/response types in `packages/types/src/index.ts`
- [ ] T002 Create API report files `apps/api/src/management/reports/sales-report.types.ts`, `apps/api/src/management/reports/sales-report.service.ts` and `apps/api/src/management/reports/sales-report.controller.ts`
- [ ] T003 Register the sales report controller and service in `apps/api/src/management/management.module.ts`
- [ ] T004 Create the web route files `apps/web/app/admin/reports/sales/page.tsx` and `apps/web/app/admin/reports/sales/sales-report-client.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation and API client code required before user stories.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T005 Implement sales report query parsing, defaults and validation in `apps/api/src/management/reports/sales-report.types.ts`
- [ ] T006 Implement local business-day helper functions for report periods in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T007 Add the `getSalesReport` admin API client function and query builder in `apps/web/lib/api.ts`
- [ ] T008 Add a Reports/Sales navigation entry on the admin landing page in `apps/web/app/admin/page.tsx`

**Checkpoint**: Foundation ready - user story implementation can begin.

---

## Phase 3: User Story 1 - Acompanhar evolucao diaria de vendas (Priority: P1) MVP

**Goal**: Show period totals and daily sales evolution with order count, gross revenue, acquired net revenue, fees, average ticket and day-over-day variation.

**Independent Test**: Select a period with delivered/imported orders and confirm every local date appears with correct totals, including zero-sale days.

### Tests for User Story 1

- [ ] T009 [P] [US1] Add unit tests for money aggregation, net fallback and zero-sale days in `apps/api/test/sales-report.spec.ts`
- [ ] T010 [P] [US1] Add integration tests for daily grouping by original sale date and local period boundaries in `apps/api/test/sales-report.integration.spec.ts`

### Implementation for User Story 1

- [ ] T011 [US1] Implement base order query scoped by tenant and realized sale status in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T012 [US1] Implement period summary aggregation in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T013 [US1] Implement daily evolution rows, zero-sale day filling and delta calculations in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T014 [US1] Implement `GET /api/admin/reports/sales` summary and daily response in `apps/api/src/management/reports/sales-report.controller.ts`
- [ ] T015 [US1] Render the sales report page with period controls, summary indicators and daily evolution table in `apps/web/app/admin/reports/sales/page.tsx` and `apps/web/app/admin/reports/sales/sales-report-client.tsx`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Filtrar vendas por periodo e dimensoes principais (Priority: P1)

**Goal**: Allow admins to filter the report by period, payment institution, payment method, channel/platform and status.

**Independent Test**: Apply each filter and combined filters, then confirm all summary and daily values reflect only matching orders.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add integration tests for payment institution, payment method, channel and status filters in `apps/api/test/sales-report.integration.spec.ts`
- [ ] T017 [P] [US2] Add integration tests proving tenant-scoped filters cannot return another tenant's orders in `apps/api/test/sales-report.integration.spec.ts`

### Implementation for User Story 2

- [ ] T018 [US2] Extend the sales report service query builder with institution, method, platform and status filters in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T019 [US2] Return selected filter metadata and validation errors consistently from `apps/api/src/management/reports/sales-report.controller.ts`
- [ ] T020 [US2] Add filter controls and URL query synchronization in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [ ] T021 [US2] Load tenant-visible order platforms for the channel filter in `apps/web/lib/api.ts` and `apps/web/app/admin/reports/sales/page.tsx`

**Checkpoint**: User Stories 1 and 2 work independently with consistent filters.

---

## Phase 5: User Story 3 - Consultar analitico de pedidos (Priority: P2)

**Goal**: Provide a paginated analytical order list with payment reconciliation and assigned product details.

**Independent Test**: Select a period/day and confirm analytical rows show date/time, status, channel, payment fields, gross/fee/net values, products and import traceability.

### Tests for User Story 3

- [ ] T022 [P] [US3] Add integration tests for analytical pagination, row fields and external payment ID lookup in `apps/api/test/sales-report.integration.spec.ts`
- [ ] T023 [P] [US3] Add unit tests for analytical product summary and imported-order flag mapping in `apps/api/test/sales-report.spec.ts`

### Implementation for User Story 3

- [ ] T024 [US3] Implement analytical order pagination and sorting in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T025 [US3] Map assigned products, item counts, external payment ID, payment brand and imported flag in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T026 [US3] Include analytical page metadata in the API response in `apps/api/src/management/reports/sales-report.controller.ts`
- [ ] T027 [US3] Add daily drill-down behavior and analytical order table in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [ ] T028 [US3] Add pagination controls and empty state for analytical results in `apps/web/app/admin/reports/sales/sales-report-client.tsx`

**Checkpoint**: User Story 3 can audit orders independently for the selected filters.

---

## Phase 6: User Story 4 - Comparar mix de pagamento e canais (Priority: P3)

**Goal**: Summarize sales by payment institution, payment method and channel to compare concentration, fees and net received values.

**Independent Test**: Select a period with multiple institutions/methods/channels and verify each dimension shows count, gross, fees, net and share or average values.

### Tests for User Story 4

- [ ] T029 [P] [US4] Add unit tests for dimension grouping, labels and share calculations in `apps/api/test/sales-report.spec.ts`
- [ ] T030 [P] [US4] Add integration tests for payment and channel dimension summaries respecting all filters in `apps/api/test/sales-report.integration.spec.ts`

### Implementation for User Story 4

- [ ] T031 [US4] Implement payment institution and payment method summaries in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T032 [US4] Implement channel/platform summaries with fallback labels in `apps/api/src/management/reports/sales-report.service.ts`
- [ ] T033 [US4] Render payment and channel summary sections in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [ ] T034 [US4] Ensure dimension sections use the same active filters and empty states as the daily and analytical views in `apps/web/app/admin/reports/sales/sales-report-client.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate contract, performance, docs and operational readiness.

- [ ] T035 [P] Update `specs/004-relatorios-vendas-pedidos/contracts/openapi.yaml` if implementation response fields differ from the planned contract
- [ ] T036 [P] Update `specs/004-relatorios-vendas-pedidos/quickstart.md` with any final manual validation route or parameter changes
- [ ] T037 Run `npm.cmd run typecheck --workspaces --if-present` and fix issues in affected API/web/type files
- [ ] T038 Run `npm.cmd run lint --workspaces --if-present` and fix issues in affected API/web/type files
- [ ] T039 Run `npm.cmd run test --workspaces --if-present` and fix sales report regressions in `apps/api/test/sales-report.spec.ts` and `apps/api/test/sales-report.integration.spec.ts`
- [ ] T040 Validate `/admin/reports/sales` manually against imported PagBank/Mercado Pago data using `specs/004-relatorios-vendas-pedidos/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and delivers the MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 2; should be validated after US1 because it filters the same report sections.
- **User Story 3 (Phase 5)**: Depends on Phase 2; can be implemented after the base endpoint exists.
- **User Story 4 (Phase 6)**: Depends on Phase 2; can be implemented after core aggregation helpers exist.
- **Polish (Phase 7)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundational tasks.
- **US2 (P1)**: Uses US1 report sections, but filter logic is independently testable through the same endpoint.
- **US3 (P2)**: Uses the same filter set and adds analytical pagination.
- **US4 (P3)**: Uses the same filter set and adds grouped dimension summaries.

### Within Each User Story

- Tests should be added before implementation and should fail before the feature code is complete.
- Shared types and query validation must exist before endpoint/web integration.
- Service aggregation should be completed before controller response mapping.
- API response should be completed before web rendering for the same story.

---

## Parallel Opportunities

- T001, T002 and T004 can run in parallel after repository context is known.
- T009 and T010 can run in parallel because they cover different test scopes.
- T016 and T017 can run in parallel with T020 once query contract names are stable.
- T022 and T023 can run in parallel because one is integration-level and the other is unit-level.
- T029 and T030 can run in parallel for the same reason.
- T035 and T036 can run in parallel during polish.

---

## Parallel Example: User Story 1

```text
Task: "T009 [P] [US1] Add unit tests for money aggregation, net fallback and zero-sale days in apps/api/test/sales-report.spec.ts"
Task: "T010 [P] [US1] Add integration tests for daily grouping by original sale date and local period boundaries in apps/api/test/sales-report.integration.spec.ts"
```

---

## Parallel Example: User Story 3

```text
Task: "T022 [P] [US3] Add integration tests for analytical pagination, row fields and external payment ID lookup in apps/api/test/sales-report.integration.spec.ts"
Task: "T023 [P] [US3] Add unit tests for analytical product summary and imported-order flag mapping in apps/api/test/sales-report.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate daily report totals and local date grouping against imported orders.

### Incremental Delivery

1. Deliver US1 for the daily sales view.
2. Add US2 filters for operational reconciliation.
3. Add US3 analytical orders for audit and drill-down.
4. Add US4 dimension summaries for payment/channel mix.
5. Run Phase 7 validation before committing and pushing.

### Notes

- The first release does not add database tables or migrations.
- Reports must remain tenant-scoped through authenticated admin context.
- Imported historical orders must be grouped by original sale date, not import date.
- Missing acquired net values must fall back to gross order value.
