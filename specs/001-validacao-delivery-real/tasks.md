# Tasks: Validação Delivery Real

**Input**: Design documents from `/specs/001-validacao-delivery-real/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Required for checkout rules, totals, tenant scoping, status transitions and E2E pilot flow.

## Phase 1: Setup

**Purpose**: Create the monorepo and development baseline.

- [x] T001 Initialize monorepo with `apps/api`, `apps/web`, `packages/database`, `packages/types`, `packages/ui`
- [x] T002 Configure TypeScript strict, ESLint and Prettier across the workspace
- [x] T003 Configure PostgreSQL local development and environment variables
- [x] T004 Configure Prisma in `packages/database`
- [x] T005 Configure initial test runners for API and web

---

## Phase 2: Foundational

**Purpose**: Shared data, auth and tenant context needed by all stories.

- [x] T006 Create Prisma schema for Tenant and User in `packages/database`
- [x] T007 Create Prisma schema for Category, Product, Order and OrderItem in `packages/database`
- [x] T008 Add initial migration and seed for one pilot tenant/admin user
- [x] T009 Implement auth login and JWT guard in `apps/api/src/platform`
- [x] T010 Implement tenant context for admin routes from authenticated user
- [x] T011 Implement tenant resolution for public routes by slug
- [x] T012 Add structured logging for tenant resolution and API errors
- [x] T013 Add integration tests for tenant resolution and cross-tenant blocking

**Checkpoint**: Foundation ready; user stories can be implemented.

---

## Phase 3: User Story 1 - Publicar cardápio vendável (Priority: P1)

**Goal**: Admin can publish a mobile-friendly menu with active categories/products.

**Independent Test**: Seed pilot store, add products, open public menu and verify active catalog.

### Tests

- [x] T014 [P] [US1] Add API tests for category/product active filtering
- [x] T015 [P] [US1] Add public menu contract test based on `contracts/openapi.yaml`

### Implementation

- [x] T016 [US1] Implement category CRUD endpoints in `apps/api/src/catalog`
- [x] T017 [US1] Implement product CRUD endpoints in `apps/api/src/catalog`
- [x] T018 [US1] Implement public menu endpoint `GET /public/tenants/{slug}/menu`
- [x] T019 [US1] Build admin category/product screens in `apps/web/app/admin`
- [x] T020 [US1] Build public menu page in `apps/web/app/(public-menu)`
- [x] T021 [US1] Add mobile responsive styling for public menu

**Checkpoint**: Pilot catalog can be published and viewed.

---

## Phase 4: User Story 2 - Receber pedido real pelo cardápio (Priority: P1)

**Goal**: Customer can place a real order from the public menu.

**Independent Test**: Place one delivery order and verify server-calculated total and WhatsApp summary.

### Tests

- [x] T022 [P] [US2] Add unit tests for order total calculation
- [x] T023 [P] [US2] Add integration tests for closed store, inactive product and empty cart rejection
- [x] T024 [P] [US2] Add unit tests for WhatsApp deep link generation

### Implementation

- [x] T025 [US2] Implement local cart in `apps/web`
- [x] T026 [US2] Implement checkout form for delivery/pickup and payment method
- [x] T027 [US2] Implement order creation endpoint `POST /public/tenants/{slug}/orders`
- [x] T028 [US2] Recalculate order totals server-side and persist snapshots
- [x] T029 [US2] Implement order confirmation page with WhatsApp deep link
- [x] T030 [US2] Add user-facing checkout rejection states

**Checkpoint**: A real customer order can be created.

---

## Phase 5: User Story 3 - Operar fila de pedidos (Priority: P1)

**Goal**: Operator can receive, hear/see and manage orders.

**Independent Test**: Create order from public menu and update it through the admin queue.

### Tests

- [x] T031 [P] [US3] Add tests for order status transition rules
- [x] T032 [P] [US3] Add tests for tenant-scoped order listing

### Implementation

- [x] T033 [US3] Implement admin order list endpoint `GET /admin/orders`
- [x] T034 [US3] Implement status endpoint `PATCH /admin/orders/{id}/status`
- [x] T035 [US3] Configure Socket.io order-created event scoped by tenant
- [x] T036 [US3] Build admin order queue UI in `apps/web/app/admin/orders`
- [x] T037 [US3] Add visual and sound alert for new orders
- [x] T038 [US3] Add order history filter for delivered/cancelled orders

**Checkpoint**: Operator can run a live order shift.

---

## Phase 6: User Story 4 - Medir resultado diário mínimo (Priority: P2)

**Goal**: Owner can see basic daily outcome.

**Independent Test**: Delivered orders appear in daily count and gross revenue; cancelled orders do not.

### Tests

- [x] T039 [P] [US4] Add tests for daily summary calculation

### Implementation

- [x] T040 [US4] Implement `GET /admin/reports/daily-summary`
- [x] T041 [US4] Build daily summary widget in admin dashboard

**Checkpoint**: Pilot has basic business measurement.

---

## Phase 7: Pilot Hardening

**Purpose**: Validate the real operation before launch.

- [x] T042 Add E2E test for create catalog -> public menu -> place order -> manage order
- [x] T043 Add E2E test for store closed blocking checkout
- [x] T044 Add E2E test for inactive product hidden from public menu
- [x] T045 Validate mobile layout of public menu and checkout
- [x] T046 Validate public menu performance target with pilot catalog size
- [x] T047 Run quickstart validation from `specs/001-validacao-delivery-real/quickstart.md`
- [x] T048 Prepare pilot launch checklist and rollback/manual fallback notes

---

## Implementation Strategy

1. Complete Phase 1 and Phase 2.
2. Deliver US1 and validate menu publishing.
3. Deliver US2 and run first internal order.
4. Deliver US3 and simulate a live shift.
5. Deliver US4 if time permits before first external customer.
6. Run Phase 7 before using with real customers.
