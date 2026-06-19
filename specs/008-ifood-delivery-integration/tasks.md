# Tasks: iFood Delivery Integration

**Input**: Design documents from `/specs/008-ifood-delivery-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Included because the feature touches tenant isolation, order workflow, token lifecycle, idempotent event processing, provider deadlines, and external synchronization.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when dependencies are complete
- **[Story]**: User story label, only for story phases
- Every task includes exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare module structure, shared contracts, and environment knobs used by every story.

- [x] T001 Create delivery integrations API module structure in apps/api/src/management/integrations/
- [x] T002 Create iFood adapter folder structure in apps/api/src/management/integrations/ifood/
- [x] T003 Create external order ingestion folder/files in apps/api/src/ordering/external-order-ingestion.service.ts
- [x] T004 Create admin delivery integrations route folder in apps/web/app/admin/integrations/delivery/
- [x] T005 [P] Add delivery integration env variable documentation to apps/api/.env.example
- [x] T006 [P] Add iFood/deployment env variable documentation to README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, types, shared service boundaries, permissions, and provider-neutral abstractions required before user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Add Prisma enums for delivery integration status, credential status, event status, sync status, provider, order action, order mode, order timing and integration audit action in packages/database/prisma/schema.prisma
- [x] T008 Add Prisma models DeliveryIntegration, DeliveryIntegrationCredential, DeliveryPlatformEvent, PlatformOrderLink, PlatformSyncAttempt, PlatformCancellationReason, PlatformDispute and DeliveryIntegrationAudit in packages/database/prisma/schema.prisma
- [x] T009 Add Tenant, User, Order, OrderPlatform and related model relations for delivery integration models in packages/database/prisma/schema.prisma
- [x] T010 Generate migration for delivery integration schema in packages/database/prisma/migrations/
- [x] T011 [P] Add delivery integration permission seed entries in packages/database/prisma/seed.ts
- [x] T012 [P] Add shared provider-neutral TypeScript types in packages/types/src/delivery-integrations.ts
- [x] T013 Export delivery integration types from packages/types/src/index.ts
- [x] T014 Add DeliveryIntegrationsModule and register it in apps/api/src/management/management.module.ts
- [x] T015 Create provider adapter interfaces in apps/api/src/management/integrations/delivery-provider.adapter.ts
- [x] T016 Create integration secret redaction utilities in apps/api/src/management/integrations/integration-secret.util.ts
- [x] T017 Create integration audit service in apps/api/src/management/integrations/delivery-integration-audit.service.ts
- [x] T018 Create integration repository/service base in apps/api/src/management/integrations/delivery-integrations.service.ts
- [x] T019 Create controller shell with permission guards in apps/api/src/management/integrations/delivery-integrations.controller.ts
- [x] T020 Create health service shell in apps/api/src/management/integrations/delivery-integration-health.service.ts
- [x] T021 [P] Add foundational unit tests for secret redaction in apps/api/src/management/integrations/integration-secret.util.spec.ts
- [x] T022 [P] Add foundational tenant isolation tests for integration repository in apps/api/src/management/integrations/delivery-integrations.service.spec.ts

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Configurar integracao iFood por loja (Priority: P1) MVP

**Goal**: Store admin configures, validates, activates, pauses, and rotates iFood integration credentials for only the active store.

**Independent Test**: Configure iFood for the pilot store, validate merchant access, activate, pause, rotate credentials, and prove another store/user cannot view or change it.

### Tests for User Story 1

- [x] T023 [P] [US1] Add API tests for create/update/validate/activate/pause credential flows in apps/api/src/management/integrations/delivery-integrations.controller.spec.ts
- [x] T024 [P] [US1] Add iFood auth token lifecycle tests in apps/api/src/management/integrations/ifood/ifood-auth.service.spec.ts
- [x] T025 [P] [US1] Add web tests for delivery integration settings page in apps/web/app/admin/integrations/delivery/delivery-integrations-page.spec.tsx

### Implementation for User Story 1

- [x] T026 [US1] Implement create/list/get/update integration methods in apps/api/src/management/integrations/delivery-integrations.service.ts
- [x] T027 [US1] Implement credential save/rotation with secret redaction in apps/api/src/management/integrations/delivery-integrations.service.ts
- [x] T028 [US1] Implement iFood OAuth/token lifecycle in apps/api/src/management/integrations/ifood/ifood-auth.service.ts
- [x] T029 [US1] Implement iFood merchant validation client methods in apps/api/src/management/integrations/ifood/ifood-client.ts
- [x] T030 [US1] Implement validate/activate/pause endpoints in apps/api/src/management/integrations/delivery-integrations.controller.ts
- [x] T031 [US1] Implement integration health summary for credential, merchant and propagation states in apps/api/src/management/integrations/delivery-integration-health.service.ts
- [x] T032 [US1] Add admin delivery integration page server component in apps/web/app/admin/integrations/delivery/page.tsx
- [x] T033 [US1] Add delivery integration client UI for list, form, validation, activation, pause and credential rotation in apps/web/app/admin/integrations/delivery/delivery-integrations-client.tsx
- [x] T034 [US1] Add integration health badge component in apps/web/components/admin/integration-health-badge.tsx
- [x] T035 [US1] Add delivery integrations navigation entry gated by permission in apps/web/components/admin/admin-shell.tsx

**Checkpoint**: US1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Capturar pedidos realizados no iFood (Priority: P1)

**Goal**: Active iFood integration ingests provider events, fetches order details, persists events safely, creates one internal order, and acknowledges only after durable processing.

**Independent Test**: Simulate one iFood order event twice and verify one internal order, one platform link, event audit, retry handling for temporary detail unavailability, and safe ACK.

### Tests for User Story 2

- [x] T036 [P] [US2] Add event idempotency tests in apps/api/src/management/integrations/ifood/ifood-event-poller.service.spec.ts
- [x] T037 [P] [US2] Add iFood order mapping tests in apps/api/src/management/integrations/ifood/ifood-order-mapper.spec.ts
- [x] T038 [P] [US2] Add external order ingestion tests in apps/api/src/ordering/external-order-ingestion.service.spec.ts
- [x] T039 [P] [US2] Add cross-tenant ingestion E2E test in apps/api/test/ifood-tenant-isolation.e2e.spec.ts

### Implementation for User Story 2

- [x] T040 [US2] Implement iFood polling client and event fetch/ack methods in apps/api/src/management/integrations/ifood/ifood-client.ts
- [x] T041 [US2] Implement iFood event poller with 30-second interval guard in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts
- [x] T042 [US2] Implement durable event persistence and status transitions in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts
- [x] T043 [US2] Implement bounded retry for temporarily unavailable order details in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts
- [x] T044 [US2] Implement iFood order payload normalization in apps/api/src/management/integrations/ifood/ifood-order-mapper.ts
- [x] T045 [US2] Implement external order creation/linking using existing Order and OrderItem models in apps/api/src/ordering/external-order-ingestion.service.ts
- [x] T046 [US2] Wire external order ingestion into OrderingModule providers in apps/api/src/ordering/ordering.module.ts
- [x] T047 [US2] Emit order-created socket event for imported iFood orders in apps/api/src/ordering/external-order-ingestion.service.ts
- [x] T048 [US2] Add source/deadline/platform metadata to admin order response in apps/api/src/ordering/ordering.service.ts
- [x] T049 [US2] Display iFood source, external id and confirmation deadline in apps/web/app/admin/orders/orders-client.tsx
- [x] T050 [US2] Implement ACK job after processed/ignored events in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts

**Checkpoint**: US2 is fully functional and testable independently.

---

## Phase 5: User Story 3 - Aceitar ou recusar pedidos da plataforma (Priority: P1)

**Goal**: Operator accepts or refuses iFood orders from the internal queue within provider deadline, with sync attempts and visible retry/failure state.

**Independent Test**: Use a pending iFood order, accept it before the deadline and verify provider sync attempt; then simulate refusal with valid reason and provider asynchronous result.

### Tests for User Story 3

- [x] T051 [P] [US3] Add platform confirm/refuse API tests in apps/api/src/ordering/admin-order.controller.spec.ts
- [x] T052 [P] [US3] Add iFood status sync tests for confirm/refuse failures in apps/api/src/management/integrations/ifood/ifood-status-sync.service.spec.ts
- [x] T053 [P] [US3] Add web tests for confirm/refuse controls in apps/web/app/admin/orders/orders-client.spec.tsx

### Implementation for User Story 3

- [x] T054 [US3] Implement provider cancellation reason sync/cache in apps/api/src/management/integrations/ifood/ifood-status-sync.service.ts
- [x] T055 [US3] Implement confirm/refuse action service with deadline validation in apps/api/src/management/integrations/ifood/ifood-status-sync.service.ts
- [x] T056 [US3] Add platform confirm/refuse endpoints to apps/api/src/ordering/admin-order.controller.ts
- [x] T057 [US3] Persist PlatformSyncAttempt records for confirm/refuse actions in apps/api/src/management/integrations/ifood/ifood-status-sync.service.ts
- [x] T058 [US3] Add deadline warning state to admin order listing in apps/api/src/ordering/ordering.service.ts
- [x] T059 [US3] Add accept/refuse controls, reason selection and sync feedback in apps/web/app/admin/orders/orders-client.tsx
- [x] T060 [US3] Add visible retry state and operator warning for failed confirm/refuse sync in apps/web/app/admin/orders/orders-client.tsx

**Checkpoint**: US3 is fully functional and testable independently.

---

## Phase 6: User Story 4 - Sincronizar evolucao de status ate a entrega (Priority: P2)

**Goal**: Internal status changes for platform-origin orders are translated into the correct iFood workflow action for delivery, merchant delivery, and takeout.

**Independent Test**: Advance accepted delivery and takeout orders through preparation, ready/dispatch and delivery/conclusion, verifying sync attempts and rejection handling.

### Tests for User Story 4

- [x] T061 [P] [US4] Add platform status transition tests in apps/api/src/management/integrations/ifood/ifood-status-sync.service.spec.ts
- [x] T062 [P] [US4] Add order status integration tests for platform-origin orders in apps/api/src/ordering/ordering.service.spec.ts

### Implementation for User Story 4

- [x] T063 [US4] Implement internal-to-iFood status mapping by modality in apps/api/src/management/integrations/ifood/ifood-status-sync.service.ts
- [x] T064 [US4] Hook platform status sync into order status updates in apps/api/src/ordering/ordering.service.ts
- [x] T065 [US4] Persist retryable PlatformSyncAttempt state for rejected status transitions in apps/api/src/management/integrations/ifood/ifood-status-sync.service.ts
- [x] T066 [US4] Add platform sync detail endpoint to apps/api/src/ordering/admin-order.controller.ts
- [x] T067 [US4] Show platform sync detail and retryable errors in apps/web/app/admin/orders/order-maintenance-dialog.tsx

**Checkpoint**: US4 is fully functional and testable independently.

---

## Phase 7: User Story 5 - Preparar base para futuras plataformas (Priority: P2)

**Goal**: Provider-neutral interfaces and UI/domain structure allow adding another delivery provider without changing the internal order workflow.

**Independent Test**: Register a simulated inactive provider adapter and verify it uses the same configuration, event, order link and sync abstractions without affecting iFood.

### Tests for User Story 5

- [x] T068 [P] [US5] Add provider adapter contract tests in apps/api/src/management/integrations/delivery-provider.adapter.spec.ts
- [x] T069 [P] [US5] Add simulated provider registration tests in apps/api/src/management/integrations/delivery-integrations.service.spec.ts

### Implementation for User Story 5

- [x] T070 [US5] Refactor iFood adapter behind DeliveryProviderAdapter interface in apps/api/src/management/integrations/delivery-provider.adapter.ts
- [x] T071 [US5] Add provider registry service in apps/api/src/management/integrations/delivery-provider-registry.service.ts
- [x] T072 [US5] Register iFood adapter through provider registry in apps/api/src/management/integrations/delivery-integrations.module.ts
- [x] T073 [US5] Add simulated provider fixture for tests in apps/api/src/management/integrations/testing/simulated-delivery-provider.adapter.ts
- [x] T074 [US5] Ensure UI reads provider capabilities from API rather than hardcoding all actions in apps/web/app/admin/integrations/delivery/delivery-integrations-client.tsx

**Checkpoint**: US5 is fully functional and testable independently.

---

## Phase 8: User Story 6 - Tratar excecoes do fluxo iFood (Priority: P3)

**Goal**: Operators/admins can handle order modifications, cancellations, disputes, delivery tracking availability, and integration health problems.

**Independent Test**: Simulate order patched, cancellation result, dispute, token expired and merchant warning events, then verify alerts, audit and visible pending actions.

### Tests for User Story 6

- [x] T075 [P] [US6] Add order patched event tests in apps/api/src/management/integrations/ifood/ifood-event-poller.service.spec.ts
- [x] T076 [P] [US6] Add dispute workflow tests in apps/api/src/management/integrations/ifood/ifood-dispute.service.spec.ts
- [x] T077 [P] [US6] Add integration health page tests in apps/web/app/admin/integrations/delivery/delivery-integrations-page.spec.tsx

### Implementation for User Story 6

- [x] T078 [US6] Implement order modification handling and operator exception creation in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts
- [x] T079 [US6] Implement cancellation result event handling in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts
- [x] T080 [US6] Implement dispute persistence and response service in apps/api/src/management/integrations/ifood/ifood-dispute.service.ts
- [x] T081 [US6] Add dispute response endpoint to apps/api/src/management/integrations/delivery-integrations.controller.ts
- [x] T082 [US6] Implement optional/rate-limited delivery tracking refresh in apps/api/src/management/integrations/ifood/ifood-delivery-tracking.service.ts
- [x] T083 [US6] Add health counters for failed events, pending disputes, token expiry and merchant status in apps/api/src/management/integrations/delivery-integration-health.service.ts
- [x] T084 [US6] Show pending exceptions, disputes and homologation readiness in apps/web/app/admin/integrations/delivery/delivery-integrations-client.tsx
- [x] T085 [US6] Add integration audit page/table section in apps/web/app/admin/integrations/delivery/delivery-integrations-client.tsx

**Checkpoint**: US6 is fully functional and testable independently.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, performance, documentation, and full validation.

- [x] T094 [US1] Add iFood centralized authentication mode using client_credentials in apps/api/src/management/integrations/ifood/ifood-auth.service.ts
- [x] T095 [US1] Add authentication mode selection to delivery credential UI in apps/web/app/admin/integrations/delivery/delivery-integrations-client.tsx
- [x] T096 [US6] Add iFood merchant status and opening-hours health checks in apps/api/src/management/integrations/ifood/ifood-client.ts
- [x] T097 [US6] Show iFood store availability and configured opening hours in apps/web/app/admin/integrations/delivery/delivery-integrations-client.tsx
- [x] T086 [P] Update specs/008-ifood-delivery-integration/quickstart.md with any implementation-specific commands discovered during build
- [x] T087 [P] Add production/homologation notes for Render env vars in README.md
- [x] T088 Harden logs to prevent credential or customer-sensitive payload leakage in apps/api/src/management/integrations/
- [x] T089 Add structured logs for polling, ACK, order ingestion and sync attempts in apps/api/src/management/integrations/
- [ ] T090 Run Prisma validate/generate/migration validation for packages/database/prisma/schema.prisma
- [x] T091 Run API lint, typecheck and focused tests for apps/api/
- [x] T092 Run web lint, typecheck and focused tests for apps/web/
- [ ] T093 Execute quickstart validation from specs/008-ifood-delivery-integration/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories
- **US1 (P1)**: Depends on Foundational
- **US2 (P1)**: Depends on Foundational and can use active integration from US1 for manual validation
- **US3 (P1)**: Depends on US2 for platform-origin orders
- **US4 (P2)**: Depends on US3 accepted orders
- **US5 (P2)**: Depends on Foundational and can run after US1, but should be finalized after iFood adapter stabilizes
- **US6 (P3)**: Depends on US2 event processing and US3/US4 sync foundations
- **Polish**: Depends on selected user stories being complete

### User Story Dependencies

- **US1**: Independent MVP configuration slice
- **US2**: Independent ingestion slice after foundational services; manual validation is easier after US1
- **US3**: Requires platform-origin order from US2
- **US4**: Requires accepted order action from US3
- **US5**: Parallelizable with US2/US3 once provider-neutral abstractions exist
- **US6**: Exception handling layer built on ingestion and sync behavior

### Parallel Opportunities

- T005-T006 can run in parallel.
- T011-T013 and T021-T022 can run in parallel after schema draft.
- Test tasks inside each story can be written in parallel before implementation.
- US1 web tasks and API tasks can run in parallel after endpoints are defined.
- US2 mapper, poller tests and external ingestion tests can run in parallel.
- US5 provider registry work can run in parallel with US4 status details after foundational interfaces are stable.

---

## Parallel Example: User Story 2

```text
Task: "T036 [P] [US2] Add event idempotency tests in apps/api/src/management/integrations/ifood/ifood-event-poller.service.spec.ts"
Task: "T037 [P] [US2] Add iFood order mapping tests in apps/api/src/management/integrations/ifood/ifood-order-mapper.spec.ts"
Task: "T038 [P] [US2] Add external order ingestion tests in apps/api/src/ordering/external-order-ingestion.service.spec.ts"
Task: "T039 [P] [US2] Add cross-tenant ingestion E2E test in apps/api/test/ifood-tenant-isolation.e2e-spec.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 to configure and validate iFood per store.
3. Complete US2 to import orders into the existing queue.
4. Complete US3 to confirm/refuse provider orders.
5. Stop and validate the pilot flow before status/dispute extensions.

### Incremental Delivery

1. US1: store-scoped configuration and validation.
2. US2: event ingestion and internal order creation.
3. US3: acceptance/refusal with provider sync.
4. US4: status synchronization through preparation/delivery.
5. US5: provider-neutral hardening for future platforms.
6. US6: exceptions, disputes, tracking and homologation readiness.

### Validation Gates

- No story is done until tenant isolation is covered for its API/service paths.
- No iFood event may be ACKed before durable processing.
- No secret may be returned by API, rendered in UI, logged or stored in audit metadata.
- No platform-origin order status transition may bypass existing internal order transition validation.
