# Tasks: Relatorio Gerencial Consolidado

**Input**: Design documents from `/specs/011-management-report/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included because the feature consolidates financial indicators and must protect consistency with source screens.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when it touches different files and has no dependency on incomplete tasks.
- **[Story]**: User story label from spec.md.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared contracts and route structure for the management report.

- [ ] T001 Create management report shared contract types in packages/types/src/index.ts
- [ ] T002 [P] Create API management report query/types helper in apps/api/src/management/reports/management-report.types.ts
- [ ] T003 [P] Add web API helper for management report in apps/web/lib/api.ts
- [ ] T004 [P] Add management report route shell in apps/web/app/admin/reports/management/page.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the backend aggregator and endpoint that all UI/export stories depend on.

**Critical**: No user story can be completed until the report service and endpoint exist.

- [ ] T005 [P] Add management report service tests for period validation, tenant scope and source total mapping in apps/api/src/management/reports/management-report.service.spec.ts
- [ ] T006 [P] Add management report integration contract tests in apps/api/test/management-report.integration.spec.ts
- [ ] T007 Implement management report aggregator in apps/api/src/management/reports/management-report.service.ts
- [ ] T008 Implement management report controller endpoint in apps/api/src/management/reports/management-report.controller.ts
- [ ] T009 Register management report service/controller in apps/api/src/management/management.module.ts
- [ ] T010 Add OpenAPI decorators for management report endpoint in apps/api/src/management/reports/management-report.controller.ts

**Checkpoint**: Backend can return consolidated report JSON for a period.

---

## Phase 3: User Story 1 - Visualizar desempenho consolidado do periodo (Priority: P1) MVP

**Goal**: Users can select a period and see a consolidated executive view with cash, sales and payables cards.

**Independent Test**: Open management report, apply a period, and verify executive/cash/sales/payables sections update with expected cards.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add web test for default current-month period and visible report sections in apps/web/app/admin/reports/management/management-report-client.spec.tsx
- [ ] T012 [P] [US1] Add web test for applying date filter and refreshing all sections in apps/web/app/admin/reports/management/management-report-client.spec.tsx
- [ ] T013 [P] [US1] Add API test for zero-data period response in apps/api/src/management/reports/management-report.service.spec.ts

### Implementation for User Story 1

- [ ] T014 [US1] Implement management report client layout with period filters and shortcut buttons in apps/web/app/admin/reports/management/management-report-client.tsx
- [ ] T015 [US1] Render executive summary cards in apps/web/app/admin/reports/management/management-report-client.tsx
- [ ] T016 [US1] Render cash, sales and payables summary cards in apps/web/app/admin/reports/management/management-report-client.tsx
- [ ] T017 [US1] Add empty-state handling for zero-data sections in apps/web/app/admin/reports/management/management-report-client.tsx
- [ ] T018 [US1] Wire server page data loading to management report client in apps/web/app/admin/reports/management/page.tsx

**Checkpoint**: User Story 1 is complete and testable independently.

---

## Phase 4: User Story 2 - Analisar vendas e recebimentos por origem (Priority: P1)

**Goal**: Users can inspect sales cards, evolution and dimensions by institution, method and channel in the consolidated report.

**Independent Test**: Use a period with multi-channel sales and verify cards, trend and dimension blocks.

### Tests for User Story 2

- [ ] T019 [P] [US2] Add API test mapping sales report summary/daily/dimensions into management report in apps/api/src/management/reports/management-report.service.spec.ts
- [ ] T020 [P] [US2] Add web test for sales evolution chart and dimension blocks in apps/web/app/admin/reports/management/management-report-client.spec.tsx

### Implementation for User Story 2

- [ ] T021 [US2] Map sales daily trend and grouped dimensions in apps/api/src/management/reports/management-report.service.ts
- [ ] T022 [US2] Render sales evolution chart in apps/web/app/admin/reports/management/management-report-client.tsx
- [ ] T023 [US2] Render sales grouped blocks by institution, payment method and channel in apps/web/app/admin/reports/management/management-report-client.tsx

**Checkpoint**: User Story 2 is complete and testable independently.

---

## Phase 5: User Story 3 - Avaliar saidas e compromissos financeiros (Priority: P1)

**Goal**: Users can inspect cash balances and payable commitments, including expenses grouped by category/type.

**Independent Test**: Use a period with cash movements and payable categories and verify account balances and expense grouping.

### Tests for User Story 3

- [ ] T024 [P] [US3] Add API test for cash statement/account balance mapping in apps/api/src/management/reports/management-report.service.spec.ts
- [ ] T025 [P] [US3] Add API test for payables category grouping totals in apps/api/src/management/reports/management-report.service.spec.ts
- [ ] T026 [P] [US3] Add web test for account balances and expense bar chart in apps/web/app/admin/reports/management/management-report-client.spec.tsx

### Implementation for User Story 3

- [ ] T027 [US3] Map cash statement totals and balances by account in apps/api/src/management/reports/management-report.service.ts
- [ ] T028 [US3] Add payable expenses grouped by category in apps/api/src/management/reports/management-report.service.ts
- [ ] T029 [US3] Render balances by account in apps/web/app/admin/reports/management/management-report-client.tsx
- [ ] T030 [US3] Render expenses by category bar chart in apps/web/app/admin/reports/management/management-report-client.tsx

**Checkpoint**: User Story 3 is complete and testable independently.

---

## Phase 6: User Story 4 - Exportar relatorio gerencial em PDF (Priority: P2)

**Goal**: Users can request an asynchronous PDF export of the management report and receive a notification when ready.

**Independent Test**: Request PDF for a period, continue using the screen, then download a readable report from notification center.

### Tests for User Story 4

- [ ] T031 [P] [US4] Add export provider test for management report PDF content in apps/api/src/management/exports/providers/management-report-export.provider.spec.ts
- [ ] T032 [P] [US4] Add web test for management report PDF export request feedback in apps/web/app/admin/reports/management/management-report-client.spec.tsx

### Implementation for User Story 4

- [ ] T033 [US4] Extend shared export context with MANAGEMENT_REPORT in packages/types/src/exports.ts
- [ ] T034 [US4] Extend database ExportContext enum and migration for MANAGEMENT_REPORT in packages/database/prisma/schema.prisma
- [ ] T035 [US4] Implement management report export provider in apps/api/src/management/exports/providers/management-report-export.provider.ts
- [ ] T036 [US4] Register management report export provider in apps/api/src/management/exports/export-provider.registry.ts
- [ ] T037 [US4] Add PDF export control to management report page in apps/web/app/admin/reports/management/management-report-client.tsx

**Checkpoint**: User Story 4 is complete and testable independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation and final hardening.

- [ ] T038 [P] Update OpenAPI contract if implementation differs in specs/011-management-report/contracts/openapi.yaml
- [ ] T039 [P] Add management report navigation link in apps/web/components/admin/admin-navigation.ts
- [ ] T040 Run Prisma format/generate after enum migration using packages/database/prisma/schema.prisma
- [ ] T041 Run API tests for management report and export provider using apps/api/src/management/reports/management-report.service.spec.ts
- [ ] T042 Run web tests for management report using apps/web/app/admin/reports/management/management-report-client.spec.tsx
- [ ] T043 Run typecheck and lint across affected workspaces using package.json
- [ ] T044 Execute quickstart validation and record deviations in specs/011-management-report/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all report UI/export stories.
- **US1, US2, US3 (P1)**: Depend on Foundational. They share the same client file and should be sequenced carefully by one developer.
- **US4 (P2)**: Depends on Foundational and benefits from US1 UI.
- **Polish (Phase 7)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 - Visualizar desempenho consolidado do periodo**: First MVP after backend foundation.
- **US2 - Analisar vendas e recebimentos por origem**: Can start after backend sales mapping exists; integrates into the same page.
- **US3 - Avaliar saidas e compromissos financeiros**: Can start after backend cash/payables mapping exists; integrates into the same page.
- **US4 - Exportar relatorio gerencial em PDF**: Depends on report aggregator and export infrastructure.

### Parallel Opportunities

- T002-T004 can run in parallel.
- T005-T006 can run in parallel before service/controller implementation.
- API tests for US2/US3 can run in parallel with web test authoring.
- Export provider work can proceed after management report service contract stabilizes.

---

## Parallel Example: User Story 3

```text
Task: "T024 [P] [US3] Add API test for cash statement/account balance mapping in apps/api/src/management/reports/management-report.service.spec.ts"
Task: "T025 [P] [US3] Add API test for payables category grouping totals in apps/api/src/management/reports/management-report.service.spec.ts"
Task: "T026 [P] [US3] Add web test for account balances and expense bar chart in apps/web/app/admin/reports/management/management-report-client.spec.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete setup and foundational backend aggregator.
2. Deliver US1 consolidated screen with period filters and cards.
3. Validate totals against source screens before adding richer charts/export.

### Incremental Delivery

1. Backend aggregator and shared contract.
2. Consolidated page shell and cards.
3. Sales trend/dimension analysis.
4. Cash/payables grouping analysis.
5. Async PDF export and notification flow.
6. Final validation and GitFlow promotion.
