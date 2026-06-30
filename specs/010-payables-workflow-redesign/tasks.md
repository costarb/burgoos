# Tasks: Repaginacao do Fluxo de Contas a Pagar

**Input**: Design documents from `/specs/010-payables-workflow-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included because the implementation plan and constitution require coverage for operational flow, permissions and tenant isolation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when it touches different files and has no dependency on incomplete tasks.
- **[Story]**: User story label from spec.md.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared contracts and project structure needed by the feature.

- [x] T001 Update shared generic export and notification type exports in packages/types/src/index.ts
- [x] T001a [P] Create reusable export shared contract types in packages/types/src/exports.ts
- [x] T002 [P] Create notification shared contract types in packages/types/src/notifications.ts
- [x] T003 [P] Create generic export job DTO file in apps/api/src/management/exports/dto/export-job.dto.ts
- [x] T004 [P] Create notification API DTO file in apps/api/src/management/notifications/dto/notification.dto.ts
- [x] T005 [P] Create reusable modal shell component in apps/web/components/admin/modal-shell.tsx
- [ ] T006 [P] Create notification center button placeholder in apps/web/components/admin/notification-center-button.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add persistent reusable export job and notification infrastructure that later stories can use.

**Critical**: No export or notification user story can be completed until this phase is done.

- [x] T007 Add generic ExportJob and OperationalNotification models/enums to packages/database/prisma/schema.prisma
- [x] T008 Create Prisma migration for export jobs and operational notifications in packages/database/prisma/migrations/
- [ ] T009 [P] Add notification service tests for tenant/user scoping and read state in apps/api/src/management/notifications/notifications.service.spec.ts
- [x] T010 Implement notification persistence and read operations in apps/api/src/management/notifications/notifications.service.ts
- [x] T011 Implement notification controller endpoints in apps/api/src/management/notifications/notifications.controller.ts
- [x] T012 Register notification module/providers in apps/api/src/management/management.module.ts
- [x] T013 [P] Add API client helpers for notifications and generic export jobs in apps/web/lib/api.ts
- [x] T013a [P] Add reusable async export menu tests in apps/web/components/admin/async-export-menu.spec.tsx
- [x] T013b [P] Implement reusable async export menu component in apps/web/components/admin/async-export-menu.tsx
- [ ] T014 [P] Add shared notification UI tests in apps/web/components/admin/notification-center-button.spec.tsx
- [ ] T015 Implement notification center button unread/read behavior in apps/web/components/admin/notification-center-button.tsx
- [ ] T016 Add notification center route shell in apps/web/app/admin/notifications/page.tsx
- [ ] T017 Add notification center client list and mark-read behavior in apps/web/app/admin/notifications/notifications-client.tsx

**Checkpoint**: Foundational notification and export data structures are ready.

---

## Phase 3: User Story 1 - Cadastrar conta em modal (Priority: P1) MVP

**Goal**: Users can create a new payable from a modal without leaving the payables page.

**Independent Test**: Open the payables page, trigger new payable, submit a valid payable in the modal, and verify the modal closes while the list/cards refresh.

### Tests for User Story 1

- [x] T018 [P] [US1] Add web interaction tests for opening and closing new payable modal in apps/web/app/admin/finance/payables/payables-client.spec.tsx
- [x] T019 [P] [US1] Add web interaction test for submitting a valid new payable and refreshing summary in apps/web/app/admin/finance/payables/payables-client.spec.tsx
- [ ] T020 [P] [US1] Add form validation test for required fields inside modal in apps/web/app/admin/finance/payables/payable-form.spec.tsx

### Implementation for User Story 1

- [x] T021 [US1] Refactor PayableForm to support modal submit/cancel layout in apps/web/app/admin/finance/payables/payable-form.tsx
- [x] T022 [US1] Add new payable modal state and trigger button in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T023 [US1] Move inline new payable section into modal shell in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T024 [US1] Refresh payables and close new payable modal after successful create in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T025 [US1] Preserve validation feedback and pending state inside the new payable modal in apps/web/app/admin/finance/payables/payables-client.tsx

**Checkpoint**: User Story 1 is complete and testable independently.

---

## Phase 4: User Story 2 - Acompanhar indicadores sempre visiveis (Priority: P1)

**Goal**: Cards Previsto, Pago, Em aberto and Vencido remain visible and match the current query summary.

**Independent Test**: Load payables with mixed statuses, apply filters, and verify the four cards remain visible and reflect returned summary values.

### Tests for User Story 2

- [ ] T026 [P] [US2] Add API summary regression tests for expected, paid, remaining and overdue totals in apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts
- [x] T027 [P] [US2] Add web tests for visible cards before and after filtering in apps/web/app/admin/finance/payables/payables-client.spec.tsx
- [x] T028 [P] [US2] Add web empty-state card test for zero summary values in apps/web/app/admin/finance/payables/payables-client.spec.tsx

### Implementation for User Story 2

- [x] T029 [US2] Extract payables metric cards into stable component in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T030 [US2] Keep metric cards above query and list sections across loading and empty states in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T031 [US2] Ensure filter refresh updates payables summary without stale card values in apps/web/app/admin/finance/payables/payables-client.tsx
- [ ] T032 [US2] Align open/overdue count labels with summary values in apps/web/app/admin/finance/payables/payables-client.tsx

**Checkpoint**: User Story 2 is complete and testable independently.

---

## Phase 5: User Story 3 - Consultar e editar conta em modal (Priority: P1)

**Goal**: Consultation controls are visible and editing uses a modal consistent with creation and detail.

**Independent Test**: Apply a visible consultation, open a listed payable for edit, save a valid change, and verify list/detail/cards update without navigation.

### Tests for User Story 3

- [x] T033 [P] [US3] Add web tests for visible consultation controls in apps/web/app/admin/finance/payables/payables-client.spec.tsx
- [x] T034 [P] [US3] Add web tests for opening edit modal from list and detail in apps/web/app/admin/finance/payables/payables-client.spec.tsx
- [x] T035 [P] [US3] Add web test for saving edit and refreshing list/detail/cards in apps/web/app/admin/finance/payables/payables-client.spec.tsx

### Implementation for User Story 3

- [x] T036 [US3] Create payable editor dialog wrapper in apps/web/app/admin/finance/payables/payable-editor-dialog.tsx
- [x] T037 [US3] Replace inline edit section with editor dialog state in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T038 [US3] Make consultation/filter actions visually persistent and accessible in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T039 [US3] Add edit action from payable details dialog in apps/web/app/admin/finance/payables/payable-detail-dialog.tsx
- [x] T040 [US3] Refresh selected payable snapshot after edit completion in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T041 [US3] Add unsaved-change protection for create/edit modal close attempts in apps/web/app/admin/finance/payables/payable-editor-dialog.tsx

**Checkpoint**: User Story 3 is complete and testable independently.

---

## Phase 6: User Story 4 - Exportar contas em segundo plano (Priority: P2)

**Goal**: Users can request CSV, PDF or XLSX exports without blocking the payables page.

**Independent Test**: Apply filters, request each export format, verify immediate accepted status, continue using the page, and later download the generated file.

### Tests for User Story 4

- [ ] T042 [P] [US4] Add generic export job service tests for accepted job, filter snapshot, context dispatch and tenant isolation in apps/api/src/management/exports/export-job.service.spec.ts
- [ ] T043 [P] [US4] Add generic export worker tests for CSV, PDF and XLSX generation outcomes in apps/api/src/management/exports/export-job.worker.spec.ts
- [ ] T044 [P] [US4] Add export controller integration tests for request, status and download permissions in apps/api/src/test/export-job.integration.spec.ts
- [x] T045 [P] [US4] Add web tests for reusable async export menu request and nonblocking UI in apps/web/app/admin/finance/payables/payables-client.spec.tsx

### Implementation for User Story 4

- [x] T046 [US4] Implement generic export request DTO validation in apps/api/src/management/exports/dto/export-job.dto.ts
- [x] T047 [US4] Implement generic export job creation and status lookup in apps/api/src/management/exports/export-job.service.ts
- [ ] T048 [US4] Implement reusable CSV/PDF/XLSX file generation worker in apps/api/src/management/exports/export-job.worker.ts
- [x] T049 [US4] Add generic export endpoints in apps/api/src/management/exports/export-job.controller.ts
- [ ] T050 [US4] Add local export file storage and download handling in apps/api/src/management/exports/export-job.service.ts
- [ ] T051 [US4] Emit success and failure notifications from generic export processing in apps/api/src/management/exports/export-job.worker.ts
- [ ] T052 [US4] Implement payables export provider in apps/api/src/management/exports/providers/payables-export.provider.ts
- [ ] T053 [US4] Register payables export provider in apps/api/src/management/exports/export-provider.registry.ts
- [x] T054 [US4] Add generic export API client helpers in apps/web/lib/api.ts
- [x] T054a [US4] Add reusable CSV/PDF/XLSX export controls to payables page in apps/web/app/admin/finance/payables/payables-client.tsx
- [x] T054b [US4] Show immediate accepted/pending feedback after export request in apps/web/app/admin/finance/payables/payables-client.tsx

**Checkpoint**: User Story 4 is complete and testable independently.

---

## Phase 7: User Story 5 - Gerenciar notificacoes operacionais (Priority: P2)

**Goal**: Users can open a notification center, inspect export success/failure notifications, download completed exports and mark notifications as read.

**Independent Test**: Complete and fail export jobs, open notification center, verify unread count, read state, messages and actions.

### Tests for User Story 5

- [ ] T055 [P] [US5] Add notification controller integration tests for list and mark-read in apps/api/src/test/notifications.integration.spec.ts
- [ ] T056 [P] [US5] Add web notification center tests for unread count, read state and action links in apps/web/app/admin/notifications/notifications-client.spec.tsx
- [ ] T057 [P] [US5] Add admin shell notification button tests in apps/web/components/admin/notification-center-button.spec.tsx

### Implementation for User Story 5

- [ ] T058 [US5] Add notification API helpers to apps/web/lib/api.ts
- [ ] T059 [US5] Implement notification center page data loading in apps/web/app/admin/notifications/page.tsx
- [ ] T060 [US5] Implement notification list, empty state and mark-read action in apps/web/app/admin/notifications/notifications-client.tsx
- [ ] T061 [US5] Add notification center button to admin shell in apps/web/components/admin/admin-shell.tsx
- [ ] T062 [US5] Display export completion and failure actions consistently in apps/web/app/admin/notifications/notifications-client.tsx
- [ ] T063 [US5] Ensure notification action URLs only expose authenticated same-tenant resources in apps/api/src/management/notifications/notifications.service.ts

**Checkpoint**: User Story 5 is complete and testable independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, documentation and validation across all stories.

- [ ] T064 [P] Update OpenAPI documentation for implemented generic export and notification endpoints in apps/api/src/management/exports/export-job.controller.ts
- [ ] T065 [P] Update shared contracts for reusable export and notification responses in packages/types/src/index.ts
- [ ] T066 [P] Add permission catalog entries if export/notification permissions need explicit keys in apps/api/src/management/access/permissions/permission-catalog.ts
- [ ] T067 Run Prisma format/generate after schema changes using packages/database/prisma/schema.prisma
- [ ] T068 Run API tests for financial and notification flows using apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts
- [ ] T069 Run web tests for payables and notifications using apps/web/app/admin/finance/payables/payables-client.spec.tsx
- [ ] T070 Run typecheck and lint across workspaces using package.json
- [ ] T071 Execute quickstart validation and record any deviations in specs/010-payables-workflow-redesign/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks export/notification work.
- **US1, US2, US3 (P1)**: Can start after Setup; US1/US3 share payables-client and should be sequenced carefully.
- **US4 (P2)**: Depends on Foundational.
- **US5 (P2)**: Depends on Foundational and integrates with US4 notifications.
- **Polish (Phase 8)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 - Cadastrar conta em modal**: No dependency on other stories after setup.
- **US2 - Acompanhar indicadores sempre visiveis**: No dependency on other stories after setup.
- **US3 - Consultar e editar conta em modal**: Reuses modal shell and PayableForm setup; should follow US1 when one developer is working because both touch payables-client.tsx.
- **US4 - Exportar contas em segundo plano**: Depends on Foundational notification/export schema and services.
- **US5 - Gerenciar notificacoes operacionais**: Depends on Foundational notification service and benefits from US4 generated notifications.

### Parallel Opportunities

- T002-T006 can run in parallel.
- T009, T013 and T014 can run in parallel after T007/T008 are planned.
- Tests within each user story marked [P] can be written in parallel.
- Generic API export tasks T046-T051, payables provider tasks T052-T053 and web export tasks T054-T054b can split after DTO/contracts are ready.
- Notification center frontend T059-T062 can proceed in parallel with API hardening T063 once controller/service contracts exist.

---

## Parallel Example: User Story 4

```text
Task: "T042 [P] [US4] Add generic export job service tests for accepted job, filter snapshot, context dispatch and tenant isolation in apps/api/src/management/exports/export-job.service.spec.ts"
Task: "T043 [P] [US4] Add generic export worker tests for CSV, PDF and XLSX generation outcomes in apps/api/src/management/exports/export-job.worker.spec.ts"
Task: "T045 [P] [US4] Add web tests for reusable async export menu request and nonblocking UI in apps/web/app/admin/finance/payables/payables-client.spec.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup.
2. Deliver US1 modal create flow.
3. Deliver US2 always-visible cards.
4. Deliver US3 modal edit/consultation flow.
5. Stop and validate the P1 payables workflow before export work.

### Incremental Delivery

1. P1 UX flow: US1 -> US2 -> US3.
2. Reusable async export backend/component plus payables provider: US4.
3. Notification center management: US5.
4. Polish, permissions, OpenAPI and quickstart validation.

### Validation Rule

Each user story must pass its own tests and quickstart slice before moving to the next story, especially where multiple stories touch `apps/web/app/admin/finance/payables/payables-client.tsx`.
