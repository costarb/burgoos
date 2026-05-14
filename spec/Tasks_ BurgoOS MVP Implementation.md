# Tasks: BurgoOS MVP Implementation

**Input**: Plan from `./Implementation Plan_ BurgoOS MVP.md`

## Phase 1: Setup & Infrastructure

- [ ] T001 Initialize monorepo with `apps/api` (NestJS) and `apps/web` (Next.js)
- [ ] T002 Setup `packages/database` with Prisma and PostgreSQL
- [ ] T003 Configure ESLint, Prettier and TypeScript strict across the monorepo
- [ ] T004 Configure environment variables and local Docker database
- [ ] T005 Create initial CI workflow for lint, typecheck and tests

## Phase 2: Foundational - Platform (US1)

- [ ] T006 Create Prisma models for `Tenant` and `User`
- [ ] T007 Add migrations and seed script for local development
- [ ] T008 Implement Auth Service with register, login and refresh token
- [ ] T009 Implement password hashing and JWT guards in `apps/api`
- [ ] T010 Create tenant onboarding flow that creates tenant plus owner user
- [ ] T011 Implement admin tenant context from authenticated user
- [ ] T012 Implement public tenant resolution by slug
- [ ] T013 Add integration tests for tenant creation and slug uniqueness
- [ ] T014 Add integration tests for tenant isolation guards

## Phase 3: Product Catalog (US2)

- [ ] T015 Create Prisma models for `Category` and `Product`
- [ ] T016 Implement category CRUD endpoints scoped by tenant
- [ ] T017 Implement product CRUD endpoints scoped by tenant
- [ ] T018 Implement image upload service with S3-compatible storage
- [ ] T019 Build Admin UI for category management
- [ ] T020 Build Admin UI for product management with image preview
- [ ] T021 Add unit/integration tests for active/inactive category and product rules
- [ ] T022 Add cross-tenant catalog access tests

## Phase 4: Customer Menu & Ordering (US3)

- [ ] T023 Create public menu API endpoint fetching active catalog by slug
- [ ] T024 Create public menu page in `apps/web`
- [ ] T025 Implement shopping cart logic with local storage persistence
- [ ] T026 Create checkout form with delivery/pickup and payment method
- [ ] T027 Create Prisma models for `Order` and `OrderItem`
- [ ] T028 Implement order creation endpoint that recalculates totals server-side
- [ ] T029 Validate store open/closed, product active and item availability during checkout
- [ ] T030 Build order confirmation page
- [ ] T031 Add WhatsApp deep link generation with order summary
- [ ] T032 Add tests for total calculation and invalid checkout scenarios
- [ ] T033 Add tests for WhatsApp link/message generation

## Phase 5: Order Management (US4)

- [ ] T034 Setup Socket.io in `apps/api` for tenant-scoped order updates
- [ ] T035 Build Admin Order Queue UI with status columns or filters
- [ ] T036 Implement order status transition endpoint
- [ ] T037 Add sound and visual notification for new orders in Admin UI
- [ ] T038 Implement order history view
- [ ] T039 Implement basic financial summary by period
- [ ] T040 Add tests for status transition rules
- [ ] T041 Add tests ensuring realtime events are emitted only to the correct tenant

## Phase 6: Hardening & Launch

- [ ] T042 Add E2E test: Register -> Create Menu -> Place Order -> Complete Order
- [ ] T043 Add E2E test: closed store blocks checkout
- [ ] T044 Add E2E test: inactive product is hidden from public menu
- [ ] T045 Add API logging for tenant resolution, order creation and failures
- [ ] T046 Add short TTL cache for public menu by slug
- [ ] T047 Configure production deployment with Docker/Railway or equivalent
- [ ] T048 Run final mobile performance pass for public menu
- [ ] T049 Review OpenAPI documentation coverage for public and admin APIs
- [ ] T050 Prepare launch checklist for first restaurant
