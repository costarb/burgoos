# Tasks: PDV, Comandas e KDS Omnicanal

**Input**: Design documents from `/specs/016-pos-kds-commands/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because checkout totals, payment idempotency, KDS transitions, webhook processing and tenant isolation are critical operational flows required by the specification and constitution.

**Organization**: Tasks are grouped by user story so each operational increment can be implemented, tested and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no incomplete dependency.
- **[Story]**: Maps the task to a user story from spec.md.
- Every task includes an exact target file or directory.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reserve module boundaries, shared contracts and migration structure before domain work.

- [x] T001 Create ordering submodule directories for counter sales, tabs and KDS under `apps/api/src/ordering/counter-sales/`, `apps/api/src/ordering/tabs/` and `apps/api/src/ordering/kds/`
- [x] T002 [P] Create the payments module directory structure under `apps/api/src/payments/application/`, `apps/api/src/payments/manual/`, `apps/api/src/payments/mercado-pago-point/` and `apps/api/src/payments/webhooks/`
- [x] T003 [P] Create frontend route directories and route shells under `apps/web/app/admin/pos/`, `apps/web/app/admin/tabs/`, `apps/web/app/admin/payment-exceptions/` and `apps/web/app/(public-menu)/fila/`
- [x] T004 [P] Add shared POS, tab, KDS and payment contract modules in `packages/types/src/pos.ts`, `packages/types/src/payments.ts` and export them from `packages/types/src/index.ts`
- [x] T005 Create the additive migration directory `packages/database/prisma/migrations/20260723090000_add_pos_kds_payments/` and document forward-only migration sequencing in its `README.md`
- [x] T006 Add POS/KDS/Point environment examples without secrets to `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish states, persistence, authorization, tenant-safe idempotency and operational audit used by every story.

**CRITICAL**: No user story implementation starts until this phase is complete.

### Tests for Foundation

- [x] T007 [P] Add state transition unit tests for orders, tabs and charges in `apps/api/src/ordering/order-status.spec.ts`, `apps/api/src/ordering/tabs/tab-status.spec.ts` and `apps/api/src/payments/application/charge-status.spec.ts`
- [x] T008 [P] Add cross-tenant relation and idempotency integration tests in `apps/api/test/pos-payments-foundation.integration.spec.ts`
- [x] T009 [P] Add permission catalog and default profile tests in `apps/api/src/management/access/permissions/pos-permissions.spec.ts`

### Implementation for Foundation

- [x] T010 Add `READY`, order source, tab, charge, payment, modification and operational event enums to `packages/database/prisma/schema.prisma`
- [x] T011 Add Order compatibility fields, item price snapshots, ServiceTab, ProductComplement, PaymentTerminal, PaymentCharge, Payment, PaymentAllocation, PaymentProviderEvent, PaymentException and OrderOperationalEvent models to `packages/database/prisma/schema.prisma`
- [x] T012 Write additive tables, indexes, constraints and historical order defaults in `packages/database/prisma/migrations/20260723090000_add_pos_kds_payments/migration.sql`
- [x] T013 Regenerate and validate the Prisma client from `packages/database/prisma/schema.prisma`
- [x] T014 Implement production, tab and charge transition guards in `apps/api/src/ordering/order-status.ts`, `apps/api/src/ordering/tabs/tab-status.ts` and `apps/api/src/payments/application/charge-status.ts`
- [x] T015 Implement tenant-scoped idempotency claim/replay handling in `apps/api/src/common/idempotency/idempotency.service.ts` and `apps/api/src/common/idempotency/idempotency.interceptor.ts`
- [x] T016 Implement append-only operational audit recording in `apps/api/src/ordering/operational-events/operational-event.service.ts`
- [x] T017 Add POS, tabs, KDS, payment and terminal permission definitions to `apps/api/src/management/access/permissions/permission-catalog.ts`
- [x] T018 Add server DTO validation primitives for money, expected version and idempotency in `apps/api/src/common/dto/money.dto.ts` and `apps/api/src/common/dto/expected-version.dto.ts`
- [x] T019 Register ordering submodules and the new PaymentsModule in `apps/api/src/ordering/ordering.module.ts` and `apps/api/src/app.module.ts`
- [x] T020 Add shared API client types and error mapping for version/idempotency conflicts in `apps/web/lib/api.ts`

**Checkpoint**: Schema, transitions, permissions, audit and idempotency are ready for independently testable stories.

---

## Phase 3: User Story 1 - Registrar pedido no balcão (Priority: P1) MVP

**Goal**: Let an attendant create an idempotent counter order with removals, complements and an authorized price override.

**Independent Test**: Create a pickup order, remove one technical-sheet ingredient, add one complement, override a price with authorization and verify the resulting order snapshots and Counter origin.

### Tests for User Story 1

- [x] T021 [P] [US1] Add catalog rules tests for removable ingredients and sellable complements in `apps/api/src/ordering/counter-sales/counter-catalog.service.spec.ts`
- [x] T022 [P] [US1] Add server price calculation and override permission tests in `apps/api/src/ordering/counter-sales/counter-order-calculator.spec.ts`
- [x] T023 [P] [US1] Add counter order contract and idempotent retry integration tests in `apps/api/test/counter-order.integration.spec.ts`
- [x] T024 [P] [US1] Add touch capture, customization, unavailable product and price feedback UI tests in `apps/web/app/admin/pos/pos-client.spec.tsx`

### Implementation for User Story 1

- [x] T025 [P] [US1] Add complement CRUD DTOs and controller in `apps/api/src/catalog/dto/product-complement.dto.ts` and `apps/api/src/catalog/controllers/admin-product-complement.controller.ts`
- [x] T026 [P] [US1] Add counter order DTOs with item modifications and price override fields in `apps/api/src/ordering/counter-sales/dto/create-counter-order.dto.ts`
- [x] T027 [US1] Implement active counter catalog assembly from products, technical sheets and complements in `apps/api/src/ordering/counter-sales/counter-catalog.service.ts`
- [x] T028 [US1] Implement authoritative item and total calculation with snapshot output in `apps/api/src/ordering/counter-sales/counter-order-calculator.ts`
- [x] T029 [US1] Implement counter order creation, availability revalidation, public code and operational events in `apps/api/src/ordering/counter-sales/counter-order.service.ts`
- [x] T030 [US1] Expose `GET /api/admin/pos/catalog` and `POST /api/admin/pos/orders` in `apps/api/src/ordering/counter-sales/counter-sales.controller.ts`
- [x] T031 [US1] Add counter order and complement contracts to `packages/types/src/pos.ts`
- [x] T032 [US1] Add POS catalog and order client calls to `apps/web/lib/api.ts`
- [x] T033 [US1] Build category/product browsing, search, cart and persistent summary in `apps/web/app/admin/pos/pos-client.tsx`
- [x] T034 [US1] Build item customization and price review dialog in `apps/web/app/admin/pos/item-customization-dialog.tsx`
- [x] T035 [US1] Wire authenticated POS page, loading and action feedback in `apps/web/app/admin/pos/page.tsx`

**Checkpoint**: Counter capture works without tabs or automatic payments and produces a valid order for operations.

---

## Phase 4: User Story 2 - Manter uma comanda aberta (Priority: P1)

**Goal**: Group multiple independently produced orders under an optional open tab and close it only against the correct balance.

**Independent Test**: Open a tab, add two orders at different times, progress each independently, start checkout and verify the consolidated open balance and version conflict behavior.

### Tests for User Story 2

- [x] T036 [P] [US2] Add tab totals, state, reopen and optimistic concurrency unit tests in `apps/api/src/ordering/tabs/service-tab.service.spec.ts`
- [x] T037 [P] [US2] Add multi-order tab and cross-tenant integration tests in `apps/api/test/service-tab.integration.spec.ts`
- [x] T038 [P] [US2] Add tab list, detail, add order and checkout UI tests in `apps/web/app/admin/tabs/tabs-client.spec.tsx`

### Implementation for User Story 2

- [x] T039 [P] [US2] Add open, update, checkout, reopen and cancel tab DTOs in `apps/api/src/ordering/tabs/dto/service-tab.dto.ts`
- [x] T040 [US2] Implement tab numbering, derived totals, status changes and concurrency in `apps/api/src/ordering/tabs/service-tab.service.ts`
- [x] T041 [US2] Associate counter orders with open tabs and reject checkout-pending tabs in `apps/api/src/ordering/counter-sales/counter-order.service.ts`
- [x] T042 [US2] Expose tab list/detail/open/checkout/reopen/cancel routes in `apps/api/src/ordering/tabs/service-tab.controller.ts`
- [x] T043 [US2] Add tab contracts and derived balance fields to `packages/types/src/pos.ts`
- [x] T044 [US2] Add tab API operations to `apps/web/lib/api.ts`
- [x] T045 [US2] Build tab board, detail and checkout state UI in `apps/web/app/admin/tabs/tabs-client.tsx`
- [x] T046 [US2] Add tab selection/opening to the POS flow in `apps/web/app/admin/pos/pos-client.tsx` and route data in `apps/web/app/admin/tabs/page.tsx`

**Checkpoint**: Multiple orders can be produced and delivered under one open balance without requiring a payment provider.

---

## Phase 5: User Story 3 - Cobrar automaticamente no Mercado Pago Point (Priority: P1)

**Goal**: Send one idempotent charge to an enabled Point terminal, process signed Orders webhooks, consult final state and update payment balance safely.

**Independent Test**: Select a PDV terminal, create a Point order, approve it, process a duplicate webhook and verify one payment/allocation; repeat with declined, expired, cancelled and unknown states.

### Tests for User Story 3

- [X] T047 [P] [US3] Add terminal listing and Orders API client mapping tests in `apps/api/src/payments/mercado-pago-point/mercado-pago-point.client.spec.ts`
- [X] T048 [P] [US3] Add official order/transaction state mapping tests in `apps/api/src/payments/mercado-pago-point/mercado-pago-point.mapper.spec.ts`
- [X] T049 [P] [US3] Add signed Orders webhook duplication and out-of-order tests in `apps/api/test/mercado-pago-point-webhook.e2e-spec.ts`
- [X] T050 [P] [US3] Add automatic charge approved/declined/expired/unknown integration tests in `apps/api/test/mercado-pago-point-charge.integration.spec.ts`
- [X] T051 [P] [US3] Add terminal selection and live charge status UI tests in `apps/web/app/admin/pos/point-charge-panel.spec.tsx`

### Implementation for User Story 3

- [X] T052 [P] [US3] Add sanitized Point terminal and order response types in `apps/api/src/payments/mercado-pago-point/mercado-pago-point.types.ts`
- [X] T053 [P] [US3] Add automatic charge DTO and provider error taxonomy in `apps/api/src/payments/application/dto/create-charge.dto.ts` and `apps/api/src/payments/mercado-pago-point/point-provider-error.ts`
- [X] T054 [US3] Extend the authenticated Mercado Pago connection service for Point-scoped requests in `apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-authenticated-request.service.ts`
- [X] T055 [US3] Implement paginated terminal listing, order create/get/cancel/refund calls in `apps/api/src/payments/mercado-pago-point/mercado-pago-point.client.ts`
- [X] T056 [US3] Implement provider-to-charge status mapping and redaction in `apps/api/src/payments/mercado-pago-point/mercado-pago-point.mapper.ts`
- [X] T057 [US3] Implement tenant terminal synchronization and enabled PDV allow-list in `apps/api/src/payments/mercado-pago-point/payment-terminal.service.ts`
- [X] T058 [US3] Implement atomic automatic charge creation, active-attempt guard and provider reference persistence in `apps/api/src/payments/application/payment-charge.service.ts`
- [X] T059 [US3] Implement payment/allocation creation and tab/order projection after approval in `apps/api/src/payments/application/payment-settlement.service.ts`
- [X] T060 [US3] Implement durable signed Orders webhook intake and processing in `apps/api/src/payments/webhooks/mercado-pago-orders-webhook.controller.ts` and `apps/api/src/payments/webhooks/payment-provider-event.processor.ts`
- [X] T061 [US3] Implement targeted pending-charge reconciliation and one-shot authenticated retry in `apps/api/src/payments/mercado-pago-point/point-reconciliation.service.ts` and `apps/api/src/payments/mercado-pago-point/point-reconciliation.scheduler.ts`
- [X] T062 [US3] Expose terminal sync/list and automatic charge get/create/refresh/cancel routes in `apps/api/src/payments/payment-terminal.controller.ts` and `apps/api/src/payments/payment-charge.controller.ts`
- [X] T063 [US3] Add terminal and charge API clients plus polling cutoff rules to `apps/web/lib/api.ts` and `apps/web/app/admin/pos/use-payment-charge.ts`
- [X] T064 [US3] Build terminal selection, waiting, success and safe retry interface in `apps/web/app/admin/pos/point-charge-panel.tsx`

**Checkpoint**: Point payments are automatic, idempotent and recoverable without coupling payment result to KDS state.

---

## Phase 6: User Story 4 - Registrar pagamento manual PagBank ou caixa local (Priority: P1)

**Goal**: Confirm PagBank or cash payments manually with institution/method separation, change calculation and auditable correction.

**Independent Test**: Confirm PagBank + debit with reference and Caixa local + cash with change, then cancel one confirmation as an authorized manager and verify the balance.

### Tests for User Story 4

- [X] T065 [P] [US4] Add manual payment validation, cash change and reversal tests in `apps/api/src/payments/manual/manual-payment.service.spec.ts`
- [X] T066 [P] [US4] Add manual confirmation permission and tenant integration tests in `apps/api/test/manual-payment.integration.spec.ts`
- [X] T067 [P] [US4] Add PagBank, institution/method and cash change UI tests in `apps/web/app/admin/pos/manual-payment-panel.spec.tsx`

### Implementation for User Story 4

- [X] T068 [P] [US4] Add manual confirmation and cancellation DTOs in `apps/api/src/payments/manual/dto/manual-payment.dto.ts`
- [X] T069 [US4] Implement enabled institution/method validation, cash calculation and manual settlement in `apps/api/src/payments/manual/manual-payment.service.ts`
- [X] T070 [US4] Implement append-only correction/cancellation and balance reopening in `apps/api/src/payments/manual/manual-payment-reversal.service.ts`
- [X] T071 [US4] Expose manual charge confirmation and cancellation routes in `apps/api/src/payments/manual/manual-payment.controller.ts`
- [X] T072 [US4] Add manual payment contracts to `packages/types/src/payments.ts`
- [X] T073 [US4] Add manual payment client methods to `apps/web/lib/api.ts`
- [X] T074 [US4] Build provider/method selection, PagBank confirmation and cash change UI in `apps/web/app/admin/pos/manual-payment-panel.tsx`
- [X] T075 [US4] Integrate manual and automatic payment choice into checkout in `apps/web/app/admin/pos/payment-checkout-dialog.tsx`

**Checkpoint**: The pilot can operate end-to-end without Point automation while preserving auditable financial state.

---

## Phase 7: User Story 5 - Operar a cozinha em um KDS omnicanal (Priority: P1)

**Goal**: Consolidate all active order sources into a fulfillment-aware, recoverable KDS ordered by operational priority.

**Independent Test**: Create Counter, Public Menu and iFood orders, see origins and modifications, progress pickup and delivery through their allowed transitions and recover the current snapshot after disconnect.

### Tests for User Story 5

- [x] T076 [P] [US5] Add fulfillment-aware KDS projection and ordering tests in `apps/api/src/ordering/kds/kds-query.service.spec.ts`
- [x] T077 [P] [US5] Add KDS status transition, cancellation awareness and source normalization integration tests in `apps/api/test/kds-omnichannel.integration.spec.ts`
- [x] T078 [P] [US5] Add KDS cards, contextual labels, priority and reconnect UI tests in `apps/web/app/admin/orders/kds-client.spec.tsx`
- [x] T079 [P] [US5] Add authenticated tenant room tests for realtime order events in `apps/api/src/ordering/orders.gateway.spec.ts`

### Implementation for User Story 5

- [x] T080 [US5] Set source and public code for public menu, iFood and imported orders in `apps/api/src/ordering/ordering.service.ts`, `apps/api/src/ordering/external-order-ingestion.service.ts` and `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T081 [US5] Implement KDS snapshot, payment summary, age and next-action projection in `apps/api/src/ordering/kds/kds-query.service.ts`
- [x] T082 [US5] Implement fulfillment-aware transitions, timestamps and cancellation acknowledgement in `apps/api/src/ordering/kds/kds-command.service.ts`
- [x] T083 [US5] Expose KDS snapshot and status routes in `apps/api/src/ordering/kds/kds.controller.ts`
- [x] T084 [US5] Authenticate Socket.io connections, enforce tenant rooms and emit invalidation events in `apps/api/src/ordering/orders.gateway.ts`
- [x] T085 [US5] Add KDS contracts to `packages/types/src/pos.ts` and client calls to `apps/web/lib/api.ts`
- [x] T086 [US5] Refactor existing order board into origin-aware KDS columns and cards in `apps/web/app/admin/orders/kds-client.tsx`
- [x] T087 [US5] Implement snapshot refresh, realtime invalidation and reconnect recovery in `apps/web/app/admin/orders/use-kds-orders.ts`
- [x] T088 [US5] Replace delivery-only labels and wire the KDS page in `apps/web/app/admin/orders/page.tsx` while preserving order maintenance access

**Checkpoint**: Kitchen operations are omnichannel and correct for both food truck pickup and delivery.

---

## Phase 8: User Story 6 - Assumir e concluir o atendimento (Priority: P2)

**Goal**: Assign and transfer responsibility for orders/tabs so duplicate service and charging are visible and controlled.

**Independent Test**: Assign a tab to one attendant, attempt charging as another, confirm the warning, transfer with reason and verify the full history.

### Tests for User Story 6

- [X] T089 [P] [US6] Add assignment, transfer and authorization unit tests in `apps/api/src/ordering/assignments/operational-assignment.service.spec.ts`
- [X] T090 [P] [US6] Add concurrent assignment integration tests in `apps/api/test/operational-assignment.integration.spec.ts`
- [X] T091 [P] [US6] Add assignment badges and transfer confirmation UI tests in `apps/web/app/admin/orders/assignment-control.spec.tsx`

### Implementation for User Story 6

- [X] T092 [US6] Implement order/tab claim, transfer, version check and audit in `apps/api/src/ordering/assignments/operational-assignment.service.ts`
- [X] T093 [US6] Expose assignment and transfer routes in `apps/api/src/ordering/assignments/operational-assignment.controller.ts`
- [X] T094 [US6] Add assignment contracts and API calls to `packages/types/src/pos.ts` and `apps/web/lib/api.ts`
- [X] T095 [US6] Build reusable assignment badge and transfer control in `apps/web/app/admin/orders/assignment-control.tsx`
- [X] T096 [US6] Integrate responsibility warnings into KDS, tabs and checkout in `apps/web/app/admin/orders/kds-client.tsx`, `apps/web/app/admin/tabs/tabs-client.tsx` and `apps/web/app/admin/pos/payment-checkout-dialog.tsx`

**Checkpoint**: Responsibility is visible, transferable and audited without locking the operation to one user session.

---

## Phase 9: User Story 7 - Acompanhar a fila como cliente (Priority: P2)

**Goal**: Expose a privacy-safe, tenant-isolated public queue with oldest active and newest completed orders.

**Independent Test**: Open the queue anonymously, progress an order, verify ordering and stale-state feedback, and prove that no PII/payment data or other tenant appears.

### Tests for User Story 7

- [X] T097 [P] [US7] Add public queue ordering, configuration and redaction unit tests in `apps/api/src/customer-experience/order-queue/public-order-queue.service.spec.ts`
- [X] T098 [P] [US7] Add unknown/inactive/two-tenant public queue contract tests in `apps/api/test/public-order-queue.integration.spec.ts`
- [X] T099 [P] [US7] Add TV/mobile layout, ordering and stale-state UI tests in `apps/web/app/(public-menu)/fila/page.spec.tsx`

### Implementation for User Story 7

- [X] T100 [US7] Implement tenant queue configuration defaults and validation in `apps/api/src/customer-experience/order-queue/order-queue-config.ts`
- [X] T101 [US7] Implement sanitized active/completed queue projection in `apps/api/src/customer-experience/order-queue/public-order-queue.service.ts`
- [X] T102 [US7] Expose slug and domain-resolved public queue endpoints in `apps/api/src/customer-experience/order-queue/public-order-queue.controller.ts`
- [X] T103 [US7] Add public queue contracts and safe fetch/revalidation to `packages/types/src/pos.ts` and `apps/web/lib/api.ts`
- [X] T104 [US7] Build responsive public queue board and stale indicator in `apps/web/app/(public-menu)/fila/public-order-queue.tsx`
- [X] T105 [US7] Resolve the store host/slug and render `/fila` in `apps/web/app/(public-menu)/fila/page.tsx`

**Checkpoint**: Customers can follow preparation without authentication or exposure of personal/financial data.

---

## Phase 10: User Story 8 - Trabalhar com perfil Atendente (Priority: P2)

**Goal**: Provide a least-privilege default attendant profile and navigation restricted to POS and KDS/orders.

**Independent Test**: Log in as Attendant, use capture/KDS, then verify that direct and navigational access to configuration, users, reports, terminal management and exceptions is denied.

### Tests for User Story 8

- [X] T106 [P] [US8] Add default Attendant profile seed and permission boundary tests in `apps/api/src/management/access/profiles/attendant-profile.spec.ts`
- [X] T107 [P] [US8] Add direct-route authorization integration tests in `apps/api/test/attendant-access.integration.spec.ts`
- [X] T108 [P] [US8] Add attendant navigation and store-switching UI tests in `apps/web/components/admin/admin-shell.spec.tsx`

### Implementation for User Story 8

- [X] T109 [US8] Seed idempotent Attendant profile and base permissions in `packages/database/prisma/seed.ts`
- [X] T110 [US8] Add sensitive permission delegation rules for override, cancel, refund and terminal management in `apps/api/src/management/access/users/user-access-rules.ts`
- [X] T111 [US8] Apply permission decorators to POS, tabs, KDS and payment controllers under `apps/api/src/ordering/` and `apps/api/src/payments/`
- [X] T112 [US8] Add permission-aware POS, tabs and KDS entries to `apps/web/components/admin/admin-navigation.ts`
- [X] T113 [US8] Enforce route-level permission fallback on POS, tabs, orders and exceptions pages under `apps/web/app/admin/`
- [X] T114 [US8] Verify active-store changes invalidate POS, tab, KDS, terminal and charge caches in `apps/web/components/admin/store-switcher.tsx`

**Checkpoint**: Attendants can operate but cannot administer the store or access sensitive payment controls.

---

## Phase 11: User Story 9 - Supervisionar exceções e reconciliação (Priority: P3)

**Goal**: Make unknown, duplicate, divergent and refunded payment situations visible and safely resolvable.

**Independent Test**: Produce two possible approvals for one balance, verify an exception instead of double settlement, resolve it as manager and confirm preserved history.

### Tests for User Story 9

- [x] T115 [P] [US9] Add duplicate approval, manual divergence and refund-after-delivery tests in `apps/api/src/payments/application/payment-exception.service.spec.ts`
- [x] T116 [P] [US9] Add reconciliation resolution authorization and audit integration tests in `apps/api/test/payment-exception.integration.spec.ts`
- [x] T117 [P] [US9] Add exception list, detail and resolution UI tests in `apps/web/app/admin/payment-exceptions/payment-exceptions-client.spec.tsx`

### Implementation for User Story 9

- [x] T118 [US9] Implement exception detection for unknown results, duplicate approval, manual divergence, token failure and post-delivery refund in `apps/api/src/payments/application/payment-exception.service.ts`
- [x] T119 [US9] Implement manager resolution, dismissal and reconciliation actions in `apps/api/src/payments/application/payment-exception-resolution.service.ts`
- [x] T120 [US9] Expose exception list/detail/resolve routes in `apps/api/src/payments/payment-exception.controller.ts`
- [x] T121 [US9] Add exception contracts and API operations to `packages/types/src/payments.ts` and `apps/web/lib/api.ts`
- [x] T122 [US9] Build exception filters, detail timeline and resolution actions in `apps/web/app/admin/payment-exceptions/payment-exceptions-client.tsx`
- [x] T123 [US9] Wire the protected exception page in `apps/web/app/admin/payment-exceptions/page.tsx`
- [x] T124 [US9] Add shift-close summary for open tabs, active orders and inconclusive charges in `apps/api/src/ordering/shift-close/shift-close.service.ts` and `apps/web/app/admin/tabs/shift-close-panel.tsx`

**Checkpoint**: Financial anomalies are explicit, recoverable and auditable instead of silently changing balances.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Validate security, performance, compatibility, operations and production rollout across all stories.

- [x] T125 [P] Add OpenAPI decorators and align implemented routes with `specs/016-pos-kds-commands/contracts/pos-kds-payments.openapi.yaml`
- [x] T126 [P] Document terminal onboarding, PDV mode, webhook configuration and contingency in `specs/016-pos-kds-commands/runbook.md`
- [x] T127 [P] Add structured logs and metrics without tokens, PII or card data across `apps/api/src/ordering/` and `apps/api/src/payments/`
- [x] T128 Add rate limits for public queue and webhook intake in `apps/api/src/customer-experience/order-queue/public-order-queue.controller.ts` and `apps/api/src/payments/webhooks/mercado-pago-orders-webhook.controller.ts`
- [x] T129 Add migration compatibility tests for historical orders and existing payment reports in `apps/api/test/pos-migration-compatibility.integration.spec.ts`
- [ ] T130 Add full E2E counter -> KDS -> manual payment and tab -> Point -> webhook flows in `apps/api/test/pos-kds-payments.e2e.spec.ts`
- [ ] T131 Add Playwright touch/tablet and public display smoke flows in `apps/web/e2e/pos-kds-public-queue.spec.ts`
- [ ] T132 Run schema validation, typecheck, lint, tests and builds from `specs/016-pos-kds-commands/quickstart.md`
- [ ] T133 Execute the controlled second-account Point POC and record approved, declined, expired, cancel, refund and reconnect evidence in `specs/016-pos-kds-commands/point-poc-results.md`
- [ ] T134 Execute two-tenant isolation, 100-event idempotency, KDS reconnect and public queue privacy checks and record results in `specs/016-pos-kds-commands/pilot-readiness.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundation (Phase 2)**: Depends on Setup and blocks every user story.
- **US1 Counter Capture (Phase 3)**: Depends on Foundation and is the first deployable slice.
- **US2 Tabs (Phase 4)**: Depends on US1 because tabs receive counter orders.
- **US3 Mercado Pago Point (Phase 5)**: Depends on Foundation and the order/target contracts from US1; tab charging additionally uses US2.
- **US4 Manual Payments (Phase 6)**: Depends on Foundation and US1; tab payments additionally use US2. It does not depend on US3.
- **US5 KDS (Phase 7)**: Depends on Foundation and US1; it does not depend on tabs or payment automation.
- **US6 Assignment (Phase 8)**: Depends on US2 and US5 projections.
- **US7 Public Queue (Phase 9)**: Depends on US5 states and public codes.
- **US8 Attendant Profile (Phase 10)**: Depends on routes from US1, US2, US4 and US5 so final permission coverage is testable.
- **US9 Exceptions (Phase 11)**: Depends on US3 and US4 payment flows.
- **Polish (Phase 12)**: Depends on every story selected for the release.

### User Story Completion Graph

```text
Foundation
  |
  +--> US1 Counter Capture
         |
         +--> US2 Tabs --------+--> US6 Assignment
         |                     |
         +--> US4 Manual ------+--> US8 Attendant
         |
         +--> US5 KDS ---------+--> US7 Public Queue
         |
         +--> US3 Point -------+
                   |           |
                   +-----------+--> US9 Exceptions
```

### Recommended Pilot Sequence

```text
Foundation -> US1 Capture -> US5 KDS -> US4 Manual Payment
-> US2 Tabs -> US8 Attendant -> US3 Point
-> US6 Assignment -> US7 Public Queue -> US9 Exceptions
```

This sequence intentionally delivers a usable food-truck operation before depending on Point certification.

### Within Each User Story

- Write tests first and confirm they fail for the intended behavior.
- Complete schema/contracts before services that consume them.
- Complete services and transition guards before controllers.
- Complete endpoints before frontend integration.
- Validate the independent checkpoint before advancing.

### Parallel Opportunities

- T001-T006 can mostly run in parallel after directory naming is agreed.
- T007-T009 run in parallel; T014-T018 touch independent foundational areas.
- In each story, API unit tests, integration tests and UI tests marked `[P]` can run in parallel.
- After US1, US4 Manual Payments and US5 KDS can proceed in parallel.
- US3 Point can proceed beside US2 after target contracts are stable.
- US7 Public Queue and US8 permissions can proceed in parallel after KDS/manual routes stabilize.
- Documentation, observability and security hardening in T125-T128 can run alongside late story work.

---

## Parallel Examples

### User Story 1

```text
Task T021: Counter catalog rules tests
Task T022: Server calculation and override tests
Task T023: Counter order integration contract tests
Task T024: POS UI tests
```

### User Story 3

```text
Task T047: Point client tests
Task T048: Point status mapper tests
Task T049: Webhook idempotency E2E
Task T050: Charge lifecycle integration tests
Task T051: Terminal and charge UI tests
```

### User Story 5

```text
Task T076: KDS projection unit tests
Task T077: Omnichannel integration tests
Task T078: KDS UI tests
Task T079: Authenticated realtime room tests
```

### User Story 7

```text
Task T097: Public queue projection tests
Task T098: Public contract and tenant isolation tests
Task T099: TV/mobile UI tests
```

---

## Implementation Strategy

### Minimum Viable Operational Release

1. Complete Setup and Foundation.
2. Complete US1 Counter Capture.
3. Complete US5 KDS.
4. Complete US4 Manual Payments.
5. Seed US8 Attendant permissions for only those delivered routes.
6. Stop and validate one complete shift with manual PagBank/Caixa local.

This is a more useful MVP than US1 alone because it closes capture, production and payment without external Point dependency.

### Incremental Delivery

1. **MVP A**: Counter Capture -> demonstrate server totals and personalization.
2. **MVP B**: KDS -> operate kitchen with Counter/Public/iFood origins.
3. **MVP C**: Manual Payments -> complete real sales.
4. **MVP D**: Tabs -> support consume-now/pay-later behavior.
5. **MVP E**: Attendant -> deploy least-privilege operation.
6. **MVP F**: Point -> automate Mercado Pago terminal charge.
7. **MVP G**: Assignment/Public Queue/Exceptions -> mature peak-hour operations.

### Risk Controls

- Do not make Point a prerequisite for creating or producing an order.
- Do not derive production state from payment state.
- Do not expose provider tokens or accept them from the frontend.
- Do not mark unknown provider results as declined or approved.
- Do not allow a second charge until the first is terminal or explicitly reconciled.
- Do not expose administrative order objects in the public queue.
- Do not replace historical order statuses destructively.

## Notes

- `[P]` tasks modify independent files or prepare tests/contracts without depending on unfinished implementation.
- `[USn]` labels map directly to the nine user stories in `spec.md`.
- Paths describe the intended modular-monolith layout and are authoritative for implementation.
- Automated Point tests use fixtures; the controlled real-terminal POC remains a release gate.
- Commit after each task or cohesive task group.
