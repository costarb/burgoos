# Tasks: Operacoes Financeiras e Experiencia Administrativa

**Input**: Design documents from `/specs/006-financial-operations-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Financial rules, tenant isolation, operation feedback, responsive navigation and chart behavior require automated coverage.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: User story mapped from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared contracts, source structure and UX audit baseline.

- [x] T001 Create feature source directories under `apps/api/src/management/financial/accounts-payable/`, `apps/api/src/management/financial/cash-flow/`, `apps/web/components/admin/`, and `apps/web/app/admin/finance/`
- [x] T002 [P] Define shared financial operation and UI feedback contracts in `packages/types/src/index.ts`
- [x] T003 [P] Create the administrative UX audit matrix covering every current admin route in `specs/006-financial-operations-ux/ux-audit.md`
- [x] T004 [P] Add financial seed-data plan for accounts and categories in `specs/006-financial-operations-ux/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add persistence, financial audit and shared web primitives required by later stories.

**CRITICAL**: Complete this phase before implementing financial user stories.

- [x] T005 Add financial enums, tenant/user relationships, FinancialAccount, FinancialCategory, PayableRecurrence, Payable, PayablePayment, CashMovement, and FinancialAudit models in `packages/database/prisma/schema.prisma`
- [x] T006 Generate the financial operations database migration in `packages/database/prisma/migrations/`
- [x] T007 [P] Add validated DTOs for financial accounts, categories, payables, payments, movements, filters, and reversals in `apps/api/src/management/financial/dto/`
- [x] T008 [P] Implement tenant-scoped immutable financial audit recording in `apps/api/src/management/financial/financial-audit.service.ts`
- [x] T009 Register financial controllers and services in `apps/api/src/management/management.module.ts`
- [x] T010 [P] Add shared admin operation-state helpers in `apps/web/lib/operation-state.ts`
- [x] T011 [P] Add reusable pending/success/error/result feedback component in `apps/web/components/admin/operation-feedback.tsx`
- [x] T012 [P] Add reusable submit button with duplicate-submission prevention in `apps/web/components/admin/submit-button.tsx`
- [x] T013 [P] Add confirmation dialog primitive for destructive and financial actions in `apps/web/components/admin/confirmation-dialog.tsx`
- [x] T014 [P] Add focused tests for shared feedback and confirmation components in `apps/web/components/admin/operation-feedback.spec.tsx`

**Checkpoint**: Database foundation, audit service and shared UI operation primitives are ready.

---

## Phase 3: User Story 1 - Navegar e executar operacoes com clareza (Priority: P1) MVP

**Goal**: Provide consistent responsive navigation and clear operation lifecycle communication across the admin application.

**Independent Test**: Navigate from any admin route to all main areas on desktop and mobile, then run successful and failing mutations and confirm pending/result states and duplicate prevention.

### Tests for User Story 1

- [x] T015 [P] [US1] Add responsive admin-shell navigation tests in `apps/web/components/admin/admin-shell.spec.tsx`
- [ ] T016 [P] [US1] Add operation-state tests for representative server-action and client-mutation screens in `apps/web/app/admin/admin-operation-feedback.spec.tsx`

### Implementation for User Story 1

- [x] T017 [US1] Define grouped admin navigation information architecture in `apps/web/components/admin/admin-navigation.ts`
- [x] T018 [US1] Implement responsive sidebar/mobile drawer, active route, header, and breadcrumbs in `apps/web/components/admin/admin-shell.tsx`
- [x] T019 [US1] Apply the shared shell to every admin route in `apps/web/app/admin/layout.tsx`
- [x] T020 [US1] Redesign the admin home as a compact operational overview with grouped shortcuts in `apps/web/app/admin/page.tsx`
- [x] T021 [P] [US1] Apply shared operation feedback to catalog and branding screens in `apps/web/app/admin/catalog/catalog-client.tsx` and `apps/web/app/admin/branding/page.tsx`
- [x] T022 [P] [US1] Apply shared operation feedback to settings, suppliers, purchase-units, and order-platforms screens in `apps/web/app/admin/settings/page.tsx`, `apps/web/app/admin/suppliers/page.tsx`, `apps/web/app/admin/purchase-units/page.tsx`, and `apps/web/app/admin/order-platforms/page.tsx`
- [x] T023 [P] [US1] Apply shared operation feedback to ingredients, technical-sheets, pricing, and inventory screens in `apps/web/app/admin/ingredients/page.tsx`, `apps/web/app/admin/technical-sheets/`, `apps/web/app/admin/pricing/pricing-client.tsx`, and `apps/web/app/admin/inventory/inventory-client.tsx`
- [x] T024 [P] [US1] Align order import, queue, and maintenance feedback with the shared operation-state contract in `apps/web/app/admin/orders/`
- [x] T068 [P] [US1] Add editable payment release date to order maintenance and document the financial correction rule in `apps/web/app/admin/orders/order-maintenance-dialog.tsx` and `specs/006-financial-operations-ux/spec.md`
- [ ] T025 [P] [US1] Apply loading, empty, success, and error states to report and menu-engineering filters in `apps/web/app/admin/reports/` and `apps/web/app/admin/menu-engineering/`
- [x] T026 [US1] Complete the navigation, responsiveness, and processing-feedback columns for all routes in `specs/006-financial-operations-ux/ux-audit.md`

**Checkpoint**: The existing admin application is navigable and communicates all operation states consistently.

---

## Phase 4: User Story 2 - Gerenciar contas a pagar (Priority: P1)

**Goal**: Let authorized users manage payable obligations, recurrence, partial payments, cancellations and reversals.

**Independent Test**: Create standalone and recurring payables, filter totals, make partial/full payments, reverse a payment and verify status and audit history.

### Tests for User Story 2

- [ ] T027 [P] [US2] Add unit tests for payable status, remaining amount, recurrence generation, cancellation, and reversal rules in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.spec.ts`
- [ ] T028 [P] [US2] Add integration tests for payable endpoints, role authorization, audit, and tenant isolation in `apps/api/test/accounts-payable.integration.spec.ts`
- [ ] T029 [P] [US2] Add web interaction tests for payable create, filter, payment, cancellation, and error feedback flows in `apps/web/app/admin/finance/payables/payables-client.spec.tsx`

### Implementation for User Story 2

- [x] T030 [P] [US2] Implement derived payable status and money rule helpers in `apps/api/src/management/financial/accounts-payable/payable-rules.ts`
- [x] T031 [P] [US2] Implement recurrence occurrence generation without rewriting realized history in `apps/api/src/management/financial/accounts-payable/payable-recurrence.ts`
- [x] T032 [US2] Implement tenant-scoped payable CRUD, filters, summaries, partial payments, cancellations, and reversals in `apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts`
- [x] T033 [US2] Implement accounts-payable admin endpoints and role guards in `apps/api/src/management/financial/accounts-payable/accounts-payable.controller.ts`
- [x] T034 [US2] Add accounts-payable API and view contracts in `packages/types/src/index.ts`
- [x] T035 [P] [US2] Implement payable list, status summaries, filters, responsive table, and empty states in `apps/web/app/admin/finance/payables/payables-client.tsx`
- [x] T036 [P] [US2] Implement payable create/edit and recurrence form in `apps/web/app/admin/finance/payables/payable-form.tsx`
- [x] T069 [P] [US2] Capture accounts-payable competence as month/year in `apps/web/app/admin/finance/payables/payable-form.tsx` and document the rule in `specs/006-financial-operations-ux/spec.md`
- [x] T037 [P] [US2] Implement payable detail, payment registration, cancellation, reversal, and audit history in `apps/web/app/admin/finance/payables/payable-detail-dialog.tsx`
- [x] T038 [US2] Compose the accounts-payable route and server-side data loading in `apps/web/app/admin/finance/payables/page.tsx`

**Checkpoint**: Accounts payable works independently and provides trustworthy obligation totals.

---

## Phase 5: User Story 3 - Visualizar saldo atual e projecao de caixa (Priority: P1)

**Goal**: Show current and projected cash by composing order receipts, payable payments and manual movements without double counting.

**Independent Test**: Configure accounts, inspect current balance, add future receivables/payables, pay an obligation, transfer funds, adjust/reverse a movement and verify consolidated/current/projected totals.

### Tests for User Story 3

- [ ] T039 [P] [US3] Add unit tests for order receipt realization, projection, unallocated accounts, transfer neutrality, adjustment, reversal, and no-double-counting in `apps/api/src/management/financial/cash-flow/cash-flow.service.spec.ts`
- [ ] T040 [P] [US3] Add integration tests for account/movement endpoints, roles, audit, and tenant isolation in `apps/api/test/cash-flow.integration.spec.ts`
- [ ] T041 [P] [US3] Add end-to-end payable-to-cash projection flow in `apps/api/test/financial-flow.e2e.spec.ts`
- [ ] T042 [P] [US3] Add web tests for account setup, cash summary, projection timeline, movement, transfer, adjustment, and reversal in `apps/web/app/admin/finance/cash-flow/cash-flow-client.spec.tsx`

### Implementation for User Story 3

- [x] T043 [P] [US3] Implement tenant-scoped financial account and category maintenance in `apps/api/src/management/financial/cash-flow/financial-account.service.ts`
- [x] T044 [P] [US3] Implement order receipt effective-release and financial-account mapping helpers in `apps/api/src/management/financial/cash-flow/order-receipt-source.ts`
- [x] T045 [P] [US3] Implement manual movement, transfer, adjustment, and reversal rules in `apps/api/src/management/financial/cash-flow/cash-movement.service.ts`
- [x] T046 [US3] Implement unified realized ledger, current balance, projection, daily timeline, and negative-balance detection in `apps/api/src/management/financial/cash-flow/cash-flow.service.ts`
- [x] T047 [US3] Implement financial account, category, cash position, ledger, movement, and audit endpoints in `apps/api/src/management/financial/cash-flow/cash-flow.controller.ts`
- [x] T048 [US3] Add cash position, account, movement, ledger, projection, and audit contracts in `packages/types/src/index.ts`
- [x] T049 [P] [US3] Implement financial account and category configuration dialog in `apps/web/app/admin/finance/cash-flow/financial-account-dialog.tsx`
- [x] T050 [P] [US3] Implement cash summary, account balances, receivable/payable cards, and projection timeline in `apps/web/app/admin/finance/cash-flow/cash-flow-client.tsx`
- [x] T051 [P] [US3] Implement movement, transfer, adjustment, reversal, and ledger-detail dialogs in `apps/web/app/admin/finance/cash-flow/cash-movement-dialog.tsx`
- [x] T052 [US3] Compose the cash-flow route and server-side data loading in `apps/web/app/admin/finance/cash-flow/page.tsx`
- [x] T070 [US3] Cover payable-payment debit in cash account balances and refresh cash position on page focus in `apps/api/src/management/financial/cash-flow/cash-flow.service.spec.ts` and `apps/web/app/admin/finance/cash-flow/cash-flow-client.tsx`
- [x] T071 [P] [US3] Add cash statement contracts for daily credit/debit summaries and analytical entries in `packages/types/src/index.ts`
- [x] T072 [P] [US3] Add cash-statement query tests for consolidated and account-filtered debit/credit grouping in `apps/api/src/management/financial/cash-flow/cash-flow.service.spec.ts`
- [x] T073 [US3] Implement tenant-scoped cash statement aggregation by period and optional financial account in `apps/api/src/management/financial/cash-flow/cash-flow.service.ts`
- [x] T074 [US3] Expose the cash statement endpoint with period and optional financial-account filters in `apps/api/src/management/financial/cash-flow/cash-flow.controller.ts`
- [x] T075 [P] [US3] Implement the cash statement view with daily summaries, analytical expansion, empty/error states and account filter in `apps/web/app/admin/finance/cash-flow/`
- [x] T076 [US3] Validate cash statement totals against ledger and document evidence in `specs/006-financial-operations-ux/quickstart.md`
- [x] T077 [US3] Keep open payables due today or overdue in the cash projection until payment/cancellation in `apps/api/src/management/financial/cash-flow/cash-flow.service.ts`

**Checkpoint**: Current and projected cash totals are explainable from their detailed source events.

---

## Phase 6: User Story 4 - Interpretar evolucao diaria de vendas (Priority: P2)

**Goal**: Make daily sales chart values directly readable without overlap at supported screen sizes.

**Independent Test**: View short, long, zero-value and high-value periods on desktop/mobile and confirm labels and exact values remain readable and consistent.

### Tests for User Story 4

- [ ] T053 [P] [US4] Add chart-label density, formatting, zero-day, and responsive behavior tests in `apps/web/app/admin/reports/sales/sales-report-client.spec.tsx`

### Implementation for User Story 4

- [ ] T054 [US4] Add collision-aware formatted value labels and exact-value interaction to the daily sales chart in `apps/web/app/admin/reports/sales/sales-report-client.tsx`
- [ ] T055 [US4] Validate chart labels against report totals and record desktop/mobile evidence in `specs/006-financial-operations-ux/ux-audit.md`

**Checkpoint**: Daily sales values are readable and accurate across supported periods and viewports.

---

## Phase 7: User Story 5 - Usar uma experiencia administrativa consistente (Priority: P2)

**Goal**: Complete the UX/UI review so equivalent administrative workflows share consistent layouts, states and actions.

**Independent Test**: Audit every administrative route for filters, forms, lists, empty/error states, destructive actions and responsive behavior.

### Tests for User Story 5

- [ ] T056 [P] [US5] Add Playwright navigation and responsive smoke coverage for all admin route groups in `apps/web/tests/admin-ux.e2e.spec.ts`
- [ ] T057 [P] [US5] Add accessibility-focused component checks for shared admin primitives in `apps/web/components/admin/admin-accessibility.spec.tsx`

### Implementation for User Story 5

- [ ] T058 [P] [US5] Standardize admin page headers, filter bars, empty states, status badges, and action placement in `apps/web/components/admin/`
- [ ] T059 [P] [US5] Standardize responsive list/table overflow and mobile action patterns across `apps/web/app/admin/`
- [ ] T060 [P] [US5] Add explicit confirmations and impact descriptions to remaining destructive actions across `apps/web/app/admin/`
- [ ] T061 [US5] Resolve every open item and record final evidence in `specs/006-financial-operations-ux/ux-audit.md`

**Checkpoint**: All administrative routes satisfy the documented UX consistency baseline.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature and prepare it for operational use.

- [x] T062 [P] Add default pilot financial accounts and categories without overwriting existing tenant data in `packages/database/prisma/seed.ts`
- [ ] T063 [P] Update the implemented API contract and examples in `specs/006-financial-operations-ux/contracts/openapi.yaml`
- [ ] T064 Run Prisma validation/generation, lint, typecheck, and automated test scripts defined in `package.json` and fix feature-related failures
- [ ] T065 Validate the complete workflow in `specs/006-financial-operations-ux/quickstart.md`
- [ ] T066 Verify monthly payable and cash-flow queries meet the pilot performance target and document results in `specs/006-financial-operations-ux/quickstart.md`
- [ ] T067 Complete security review for OWNER/ADMIN mutations, tenant isolation, audit immutability, and financial reversal flows in `specs/006-financial-operations-ux/ux-audit.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks financial stories.
- **US1 (Phase 3)**: Depends on shared web primitives from Foundational; it is the recommended first visible increment.
- **US2 (Phase 4)**: Depends on database/audit foundation.
- **US3 (Phase 5)**: Depends on database/audit foundation and uses US2 payments when available; order-only cash views remain testable independently.
- **US4 (Phase 6)**: Depends only on existing sales report and can run after Setup.
- **US5 (Phase 7)**: Depends on US1 shell/primitives and should finish after all desired screens exist.
- **Polish (Phase 8)**: Depends on all selected user stories.

### User Story Dependencies

- **US1**: No dependency on other stories.
- **US2**: No dependency on other stories after Foundational.
- **US3**: Integrates with US2 for payable outflows, but current balance and order projections are independently testable.
- **US4**: Independent of US1-US3.
- **US5**: Depends on US1 and audits the completed routes from US2-US4.

### Parallel Opportunities

- T002-T004 can run in parallel.
- T007-T008 and T010-T014 can run in parallel after schema design is understood.
- US1 page migrations T021-T025 can run in parallel after T017-T019.
- US2 rule/test/form tasks marked `[P]` can run in parallel before service integration.
- US3 source services and UI components marked `[P]` can run in parallel before composition.
- US4 can run alongside US2 or US3.

---

## Parallel Example: User Story 2

```text
Task: T027 payable rule tests
Task: T028 payable endpoint integration tests
Task: T029 payable web interaction tests
Task: T030 payable rule helpers
Task: T031 recurrence generation
```

## Parallel Example: User Story 3

```text
Task: T043 financial account/category service
Task: T044 order receipt source
Task: T045 cash movement service
Task: T049 account configuration UI
Task: T050 cash position UI
Task: T051 movement dialogs
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Implement US1 to improve every existing workflow immediately.
3. Validate responsive navigation and operation feedback independently.
4. Implement US2 for operational obligations.
5. Implement US3 for trustworthy current/projected cash.

### Incremental Delivery

1. Shared UX foundation and shell.
2. Accounts payable with audit and payments.
3. Cash position and projection.
4. Sales chart labels.
5. Full UX/UI consistency audit and polish.

### Verification Discipline

- Write the listed financial and UX tests before the corresponding implementation.
- Validate tenant isolation for every new query and mutation.
- Validate that each realized/projected source appears exactly once.
- Update this task list as each task is completed.
