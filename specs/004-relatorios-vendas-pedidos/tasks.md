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

- [x] T001 Add shared sales report request/response types in `packages/types/src/index.ts`
- [x] T002 Create API report files `apps/api/src/management/reports/sales-report.types.ts`, `apps/api/src/management/reports/sales-report.service.ts` and `apps/api/src/management/reports/sales-report.controller.ts`
- [x] T003 Register the sales report controller and service in `apps/api/src/management/management.module.ts`
- [x] T004 Create the web route files `apps/web/app/admin/reports/sales/page.tsx` and `apps/web/app/admin/reports/sales/sales-report-client.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation and API client code required before user stories.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T005 Implement sales report query parsing, defaults and validation in `apps/api/src/management/reports/sales-report.types.ts`
- [x] T006 Implement local business-day helper functions for report periods in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T007 Add the `getSalesReport` admin API client function and query builder in `apps/web/lib/api.ts`
- [x] T008 Add a Reports/Sales navigation entry on the admin landing page in `apps/web/app/admin/page.tsx`

**Checkpoint**: Foundation ready - user story implementation can begin.

---

## Phase 3: User Story 1 - Acompanhar evolucao diaria de vendas (Priority: P1) MVP

**Goal**: Show period totals and daily sales evolution with order count, gross revenue, acquired net revenue, fees, average ticket and day-over-day variation.

**Independent Test**: Select a period with delivered/imported orders and confirm every local date appears with correct totals, including zero-sale days.

### Tests for User Story 1

- [x] T009 [P] [US1] Add unit tests for money aggregation, net fallback and zero-sale days in `apps/api/test/sales-report.spec.ts`
- [x] T010 [P] [US1] Add integration tests for daily grouping by original sale date and local period boundaries in `apps/api/test/sales-report.integration.spec.ts`

### Implementation for User Story 1

- [x] T011 [US1] Implement base order query scoped by tenant and realized sale status in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T012 [US1] Implement period summary aggregation in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T013 [US1] Implement daily evolution rows, zero-sale day filling and delta calculations in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T014 [US1] Implement `GET /api/admin/reports/sales` summary and daily response in `apps/api/src/management/reports/sales-report.controller.ts`
- [x] T015 [US1] Render the sales report page with period controls, summary indicators and daily evolution table in `apps/web/app/admin/reports/sales/page.tsx` and `apps/web/app/admin/reports/sales/sales-report-client.tsx`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Filtrar vendas por periodo e dimensoes principais (Priority: P1)

**Goal**: Allow admins to filter the report by period, payment institution, payment method, channel/platform and status.

**Independent Test**: Apply each filter and combined filters, then confirm all summary and daily values reflect only matching orders.

### Tests for User Story 2

- [x] T016 [P] [US2] Add integration tests for payment institution, payment method, channel and status filters in `apps/api/test/sales-report.integration.spec.ts`
- [x] T017 [P] [US2] Add integration tests proving tenant-scoped filters cannot return another tenant's orders in `apps/api/test/sales-report.integration.spec.ts`

### Implementation for User Story 2

- [x] T018 [US2] Extend the sales report service query builder with institution, method, platform and status filters in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T019 [US2] Return selected filter metadata and validation errors consistently from `apps/api/src/management/reports/sales-report.controller.ts`
- [x] T020 [US2] Add filter controls and URL query synchronization in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T021 [US2] Load tenant-visible order platforms for the channel filter in `apps/web/lib/api.ts` and `apps/web/app/admin/reports/sales/page.tsx`

**Checkpoint**: User Stories 1 and 2 work independently with consistent filters.

---

## Phase 5: User Story 3 - Consultar analitico de pedidos (Priority: P2)

**Goal**: Provide a paginated analytical order list with payment reconciliation and assigned product details.

**Independent Test**: Select a period/day and confirm analytical rows show date/time, status, channel, payment fields, gross/fee/net values, products and import traceability.

### Tests for User Story 3

- [x] T022 [P] [US3] Add integration tests for analytical pagination, row fields and external payment ID lookup in `apps/api/test/sales-report.integration.spec.ts`
- [x] T023 [P] [US3] Add unit tests for analytical product summary and imported-order flag mapping in `apps/api/test/sales-report.spec.ts`

### Implementation for User Story 3

- [x] T024 [US3] Implement analytical order pagination and sorting in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T025 [US3] Map assigned products, item counts, external payment ID, payment brand and imported flag in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T026 [US3] Include analytical page metadata in the API response in `apps/api/src/management/reports/sales-report.controller.ts`
- [x] T027 [US3] Add daily drill-down behavior and analytical order table in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T028 [US3] Add pagination controls and empty state for analytical results in `apps/web/app/admin/reports/sales/sales-report-client.tsx`

**Checkpoint**: User Story 3 can audit orders independently for the selected filters.

---

## Phase 6: User Story 4 - Comparar mix de pagamento e canais (Priority: P3)

**Goal**: Summarize sales by payment institution, payment method and channel to compare concentration, fees and net received values.

**Independent Test**: Select a period with multiple institutions/methods/channels and verify each dimension shows count, gross, fees, net and share or average values.

### Tests for User Story 4

- [x] T029 [P] [US4] Add unit tests for dimension grouping, labels and share calculations in `apps/api/test/sales-report.spec.ts`
- [x] T030 [P] [US4] Add integration tests for payment and channel dimension summaries respecting all filters in `apps/api/test/sales-report.integration.spec.ts`

### Implementation for User Story 4

- [x] T031 [US4] Implement payment institution and payment method summaries in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T032 [US4] Implement channel/platform summaries with fallback labels in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T033 [US4] Render payment and channel summary sections in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T034 [US4] Ensure dimension sections use the same active filters and empty states as the daily and analytical views in `apps/web/app/admin/reports/sales/sales-report-client.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate contract, performance, docs and operational readiness.

- [x] T035 [P] Update `specs/004-relatorios-vendas-pedidos/contracts/openapi.yaml` if implementation response fields differ from the planned contract
- [x] T036 [P] Update `specs/004-relatorios-vendas-pedidos/quickstart.md` with any final manual validation route or parameter changes
- [x] T037 Run `npm.cmd run typecheck --workspaces --if-present` and fix issues in affected API/web/type files
- [x] T038 Run `npm.cmd run lint --workspaces --if-present` and fix issues in affected API/web/type files
- [x] T039 Run `npm.cmd run test --workspaces --if-present` and fix sales report regressions in `apps/api/test/sales-report.spec.ts` and `apps/api/test/sales-report.integration.spec.ts`
- [ ] T040 Validate `/admin/reports/sales` manually against imported PagBank/Mercado Pago data using `specs/004-relatorios-vendas-pedidos/quickstart.md`

---

## Phase 8: Enhancement - Grafico de Evolucao Diaria (Priority: P1)

**Purpose**: Add a visual daily trend chart using the same daily report data already shown in the table.

- [x] T041 [P] [US1] Add a focused web test for rendering daily chart labels, zero-sale days and gross/net values in `apps/web/app/admin/reports/sales/sales-report-client.spec.tsx`
- [x] T042 [US1] Add a responsive daily trend chart component in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T043 [US1] Ensure the chart displays gross revenue and acquired net revenue from `report.daily` without introducing a new API contract in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T044 [US1] Add readable empty and single-day chart states in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T045 [P] Update the manual validation steps in `specs/004-relatorios-vendas-pedidos/quickstart.md` after implementation details are finalized
- [x] T046 Run `npm.cmd run typecheck --workspaces --if-present`, `npm.cmd run lint --workspaces --if-present` and `npm.cmd run test --workspaces --if-present`

---

## Phase 9: Enhancement - Valores a Receber e Liberacao de Pagamento (Priority: P1)

**Purpose**: Persist payment release expected date from bank extracts and separate released/available values from pending receivables.

- [x] T047 [P] Add payment release fields to shared order/report types in `packages/types/src/index.ts`
- [x] T048 Add Prisma fields `paymentReleaseExpectedAt` and `paymentReleaseSource` to `packages/database/prisma/schema.prisma`
- [x] T049 Add a Prisma migration for order payment release fields in `packages/database/prisma/migrations/`
- [x] T050 [P] Add import parser tests for Mercado Pago `RELEASE_DATETIME`, PagBank `Data prevista de liberação`, and empty-release D+30 fallback in `apps/api/test/historical-order-import.spec.ts`
- [x] T051 Update parsed import row mapping to capture payment release expected date and release source in `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T052 Persist payment release expected date/source on imported orders in `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T053 [P] Add sales report unit tests for released net revenue, receivable net amount and D+30 pending voucher logic in `apps/api/test/sales-report.spec.ts`
- [x] T054 Add released/receivable aggregation to `apps/api/src/management/reports/sales-report.service.ts`
- [x] T055 Add release expected date/status fields to analytical report rows in `apps/api/src/management/reports/sales-report.service.ts`
- [x] T056 Update the OpenAPI response schema with released/receivable totals and payment release fields in `specs/004-relatorios-vendas-pedidos/contracts/openapi.yaml`
- [x] T057 Add "Valores a receber" and "Liberado/disponível" summary cards in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T058 Show release expected date and release status in analytical rows in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [x] T059 [P] Add focused web tests for receivable summary and analytical release status in `apps/web/app/admin/reports/sales/sales-report-client.spec.tsx`
- [x] T060 Run `npm.cmd run typecheck --workspaces --if-present`, `npm.cmd run lint --workspaces --if-present` and `npm.cmd run test --workspaces --if-present`

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
- **Chart Enhancement (Phase 8)**: Depends on US1 daily data and can be implemented without API/database changes.
- **Receivables Enhancement (Phase 9)**: Depends on existing import/payment reconciliation fields and requires a Prisma migration before API/web changes.

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
- T041 and T045 can run in parallel with chart component implementation once the intended chart behavior is confirmed.
- T047, T050 and T053 can run in parallel after the settlement field names are confirmed.
- T057 and T058 depend on API response fields from T054 and T055.

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
