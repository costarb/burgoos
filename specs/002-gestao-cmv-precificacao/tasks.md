# Tasks: Gestao de CMV, Precificacao e Estoque

**Input**: Design documents from `/specs/002-gestao-cmv-precificacao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Required for CMV calculation, pricing simulation, stock reservation/release, tenant scoping, DRE totals and the full profitability flow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup

**Purpose**: Prepare shared structure for management, inventory and profitability modules.

- [x] T001 Create API module folders for financial, domains, pricing, reports and inventory in `apps/api/src/management` and `apps/api/src/operations/inventory`
- [x] T002 Create admin route folders for settings, purchase units, suppliers, order platforms, ingredients, technical sheets, pricing, inventory, reports and menu engineering in `apps/web/app/admin`
- [x] T003 [P] Add shared financial, inventory and pricing DTO/type exports in `packages/types/src/index.ts`
- [x] T004 [P] Add seed defaults for financial settings, purchase units and order platforms in `packages/database/prisma/seed.ts`
- [x] T005 Verify OpenAPI contract path coverage against `specs/002-gestao-cmv-precificacao/contracts/openapi.yaml`

---

## Phase 2: Foundational

**Purpose**: Database entities and shared calculation primitives required by all user stories.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T006 Add Prisma models/enums for FinancialConfiguration, PurchaseUnit, Supplier, OrderPlatform, Ingredient, TechnicalSheet, TechnicalSheetLine, ProductCostSnapshot, StockMovement and OrderProfitabilitySnapshot in `packages/database/prisma/schema.prisma`
- [x] T007 Extend existing Order model with order platform/profitability links in `packages/database/prisma/schema.prisma`
- [x] T008 Create Prisma migration for CMV, pricing, inventory and profitability schema in `packages/database/prisma/migrations`
- [x] T009 Regenerate Prisma client and validate schema with `packages/database/prisma/schema.prisma`
- [x] T010 [P] Add decimal/money calculation helpers in `apps/api/src/management/financial/money.ts`
- [x] T011 [P] Add tenant-scoped repository helper patterns for new management modules in `apps/api/src/management/tenant-scope.ts`
- [x] T012 [P] Add shared admin API client primitives for new maintenance screens in `apps/web/lib/api.ts`
- [x] T013 Add structured audit logging helpers for financial, stock and pricing changes in `apps/api/src/management/audit-log.ts`

**Checkpoint**: Foundation ready; user story implementation can proceed.

---

## Phase 3: User Story 1 - Configurar parametros e dominios operacionais (Priority: P1) MVP

**Goal**: Admin can maintain financial settings and all domain records needed by later CMV, stock and DRE workflows.

**Independent Test**: Create/edit financial configuration, purchase units, suppliers and order platforms, then use those records from admin lists without free-text duplication.

### Tests

- [x] T014 [P] [US1] Add API integration tests for financial configuration CRUD in `apps/api/test/financial-config.integration.spec.ts`
- [x] T015 [P] [US1] Add API integration tests for purchase unit tenant scoping in `apps/api/test/domain-maintenance.integration.spec.ts`
- [x] T016 [P] [US1] Add API integration tests for supplier and order platform CRUD in `apps/api/test/domain-maintenance.integration.spec.ts`
- [x] T017 [P] [US1] Add web form behavior tests for domain maintenance screens in `apps/web/app/admin/settings/settings.spec.tsx`

### Implementation

- [x] T018 [P] [US1] Implement FinancialConfiguration service in `apps/api/src/management/financial/financial-configuration.service.ts`
- [x] T019 [P] [US1] Implement PurchaseUnit service in `apps/api/src/management/domains/purchase-unit.service.ts`
- [x] T020 [P] [US1] Implement Supplier service in `apps/api/src/management/domains/supplier.service.ts`
- [x] T021 [P] [US1] Implement OrderPlatform service in `apps/api/src/management/domains/order-platform.service.ts`
- [x] T022 [US1] Implement financial configuration controller in `apps/api/src/management/financial/financial-configuration.controller.ts`
- [x] T023 [US1] Implement purchase unit controller in `apps/api/src/management/domains/purchase-unit.controller.ts`
- [x] T024 [US1] Implement supplier controller in `apps/api/src/management/domains/supplier.controller.ts`
- [x] T025 [US1] Implement order platform controller in `apps/api/src/management/domains/order-platform.controller.ts`
- [x] T026 [US1] Register financial and domain modules in `apps/api/src/management/management.module.ts`
- [x] T027 [US1] Add admin API client methods for financial settings and domains in `apps/web/lib/api.ts`
- [x] T028 [US1] Build financial settings maintenance page in `apps/web/app/admin/settings/page.tsx`
- [x] T029 [US1] Build purchase unit maintenance page in `apps/web/app/admin/purchase-units/page.tsx`
- [x] T030 [US1] Build supplier maintenance page in `apps/web/app/admin/suppliers/page.tsx`
- [x] T031 [US1] Build order platform maintenance page in `apps/web/app/admin/order-platforms/page.tsx`
- [x] T032 [US1] Add admin dashboard navigation links for new maintenance screens in `apps/web/app/admin/page.tsx`

**Checkpoint**: Financial settings and domains can be maintained independently.

---

## Phase 4: User Story 2 - Cadastrar insumos e ficha tecnica dos produtos (Priority: P1)

**Goal**: Admin can maintain ingredients and technical sheets, and product ingredient CMV is calculated from recipe lines.

**Independent Test**: Create ingredients, assign supplier/unit, build a product technical sheet with at least 5 lines and verify calculated product CMV.

### Tests

- [x] T033 [P] [US2] Add unit tests for ingredient unit cost calculation in `apps/api/test/cmv-calculation.spec.ts`
- [x] T034 [P] [US2] Add unit tests for technical sheet CMV calculation in `apps/api/test/cmv-calculation.spec.ts`
- [x] T035 [P] [US2] Add API integration tests for ingredient CRUD and tenant scoping in `apps/api/test/ingredients.integration.spec.ts`
- [x] T036 [P] [US2] Add API integration tests for technical sheet replacement and validation in `apps/api/test/technical-sheet.integration.spec.ts`

### Implementation

- [x] T037 [P] [US2] Implement ingredient calculation helpers in `apps/api/src/management/financial/ingredient-cost.ts`
- [x] T038 [P] [US2] Implement technical sheet calculation helpers in `apps/api/src/management/financial/technical-sheet-cost.ts`
- [x] T039 [US2] Implement Ingredient service in `apps/api/src/management/financial/ingredient.service.ts`
- [x] T040 [US2] Implement TechnicalSheet service in `apps/api/src/management/financial/technical-sheet.service.ts`
- [x] T041 [US2] Implement ingredient controller in `apps/api/src/management/financial/ingredient.controller.ts`
- [x] T042 [US2] Implement technical sheet controller in `apps/api/src/management/financial/technical-sheet.controller.ts`
- [x] T043 [US2] Add admin API client methods for ingredients and technical sheets in `apps/web/lib/api.ts`
- [x] T044 [US2] Build ingredient maintenance page in `apps/web/app/admin/ingredients/page.tsx`
- [x] T045 [US2] Build technical sheet product selector page in `apps/web/app/admin/technical-sheets/page.tsx`
- [x] T046 [US2] Build technical sheet editor page in `apps/web/app/admin/technical-sheets/[productId]/page.tsx`
- [x] T047 [US2] Add missing technical sheet warnings to admin catalog rows in `apps/web/app/admin/catalog/catalog-client.tsx`

**Checkpoint**: Ingredient costs and product technical sheets work independently.

---

## Phase 5: User Story 3 - Precificar produtos por CMV, taxas e margem alvo (Priority: P1)

**Goal**: Admin can compare current price with channel-aware ideal price and review products that need price changes.

**Independent Test**: Select a product with complete technical sheet, simulate pricing for iFood and WhatsApp, and verify CMV, ideal price, estimated profit and review status.

### Tests

- [x] T048 [P] [US3] Add unit tests for channel-aware price recommendation in `apps/api/test/pricing.spec.ts`
- [x] T049 [P] [US3] Add unit tests preventing packaging double counting in `apps/api/test/pricing.spec.ts`
- [x] T050 [P] [US3] Add API integration tests for pricing list and platform filter in `apps/api/test/pricing.integration.spec.ts`

### Implementation

- [x] T051 [P] [US3] Implement product pricing calculation service in `apps/api/src/management/pricing/product-pricing.service.ts`
- [x] T052 [P] [US3] Implement product cost snapshot service in `apps/api/src/management/pricing/product-cost-snapshot.service.ts`
- [x] T053 [US3] Implement pricing controller in `apps/api/src/management/pricing/pricing.controller.ts`
- [x] T054 [US3] Register pricing services in `apps/api/src/management/management.module.ts`
- [x] T055 [US3] Add admin API client methods for pricing analysis in `apps/web/lib/api.ts`
- [x] T056 [US3] Build pricing analysis page with platform selector in `apps/web/app/admin/pricing/page.tsx`
- [x] T057 [US3] Add price review status indicators in `apps/web/app/admin/pricing/pricing-client.tsx`

**Checkpoint**: Product price recommendations are independently usable.

---

## Phase 6: User Story 4 - Baixar estoque conforme pedidos em andamento (Priority: P1)

**Goal**: In-progress orders reserve or consume estimated ingredient stock, and cancellation releases the impact.

**Independent Test**: Create an order for a product with technical sheet, verify stock impact while pending/preparing, cancel and verify release, then deliver and verify consumption remains.

### Tests

- [x] T058 [P] [US4] Add unit tests for stock movement reservation/release rules in `apps/api/test/inventory.spec.ts`
- [x] T059 [P] [US4] Add integration tests for order-created stock reservation in `apps/api/test/inventory-order.integration.spec.ts`
- [x] T060 [P] [US4] Add integration tests for cancelled order stock release in `apps/api/test/inventory-order.integration.spec.ts`
- [x] T061 [P] [US4] Add E2E test for order lifecycle stock impact in `apps/api/test/profitability-flow.e2e.spec.ts`

### Implementation

- [x] T062 [P] [US4] Implement stock movement calculation helpers in `apps/api/src/operations/inventory/stock-movement-calculator.ts`
- [x] T063 [US4] Implement Inventory service in `apps/api/src/operations/inventory/inventory.service.ts`
- [x] T064 [US4] Implement order stock reservation integration in `apps/api/src/ordering/ordering.service.ts`
- [x] T065 [US4] Implement stock release/consumption on status changes in `apps/api/src/ordering/ordering.service.ts`
- [x] T066 [US4] Implement inventory controller in `apps/api/src/operations/inventory/inventory.controller.ts`
- [x] T067 [US4] Register inventory module in `apps/api/src/operations/operations.module.ts`
- [x] T068 [US4] Add admin API client methods for inventory balances and movements in `apps/web/lib/api.ts`
- [x] T069 [US4] Build inventory balance page in `apps/web/app/admin/inventory/page.tsx`
- [x] T070 [US4] Build manual stock movement form in `apps/web/app/admin/inventory/inventory-client.tsx`
- [x] T071 [US4] Add insufficient stock warnings to order/admin views in `apps/web/app/admin/orders/orders-client.tsx`

**Checkpoint**: Estimated inventory responds to in-progress orders.

---

## Phase 7: User Story 5 - Medir resultado por DRE e dashboard gerencial (Priority: P2)

**Goal**: Owner can see period DRE and management dashboard based on delivered orders, CMV snapshots, fees and fixed expenses.

**Independent Test**: Deliver orders in multiple platforms and verify DRE totals, dashboard alerts and cancelled order exclusion.

### Tests

- [x] T072 [P] [US5] Add unit tests for order profitability snapshot calculation in `apps/api/test/profitability.spec.ts`
- [x] T073 [P] [US5] Add unit tests for DRE period summary calculation in `apps/api/test/dre.spec.ts`
- [x] T074 [P] [US5] Add integration tests for cancelled order exclusion from DRE in `apps/api/test/dre.integration.spec.ts`

### Implementation

- [x] T075 [P] [US5] Implement order profitability snapshot service in `apps/api/src/management/reports/order-profitability.service.ts`
- [x] T076 [US5] Integrate profitability snapshot creation with order creation/status lifecycle in `apps/api/src/ordering/ordering.service.ts`
- [x] T077 [US5] Implement DRE report service in `apps/api/src/management/reports/dre.service.ts`
- [x] T078 [US5] Implement dashboard indicator service in `apps/api/src/management/reports/financial-dashboard.service.ts`
- [x] T079 [US5] Implement DRE and dashboard controllers in `apps/api/src/management/reports/financial-reports.controller.ts`
- [x] T080 [US5] Add admin API client methods for DRE and dashboard indicators in `apps/web/lib/api.ts`
- [x] T081 [US5] Build DRE report page in `apps/web/app/admin/reports/dre/page.tsx`
- [x] T082 [US5] Extend admin dashboard with CMV, margin, price review and stock alerts in `apps/web/app/admin/page.tsx`

**Checkpoint**: Owner can validate operational profitability for a period.

---

## Phase 8: User Story 6 - Classificar produtos por menu engineering (Priority: P3)

**Goal**: Owner can classify products by sales volume and margin for menu decisions.

**Independent Test**: Use delivered orders and cost snapshots to classify products as Estrela, Cavalo, Quebra-cabeca or Abacaxi.

### Tests

- [x] T083 [P] [US6] Add unit tests for menu engineering classification in `apps/api/test/menu-engineering.spec.ts`
- [x] T084 [P] [US6] Add API integration tests for menu engineering period report in `apps/api/test/menu-engineering.integration.spec.ts`

### Implementation

- [x] T085 [US6] Implement menu engineering service in `apps/api/src/management/reports/menu-engineering.service.ts`
- [x] T086 [US6] Implement menu engineering controller in `apps/api/src/management/reports/menu-engineering.controller.ts`
- [x] T087 [US6] Add admin API client methods for menu engineering in `apps/web/lib/api.ts`
- [x] T088 [US6] Build menu engineering page in `apps/web/app/admin/menu-engineering/page.tsx`
- [x] T089 [US6] Add insufficient data state for menu engineering in `apps/web/app/admin/menu-engineering/menu-engineering-client.tsx`

**Checkpoint**: Product classification is available when sales data is sufficient.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation and operational readiness across all stories.

- [x] T090 [P] Update feature quickstart with any implementation-specific commands in `specs/002-gestao-cmv-precificacao/quickstart.md`
- [x] T091 [P] Add admin navigation polish and empty states across new pages in `apps/web/app/admin`
- [x] T092 [P] Add OpenAPI examples for key request/response payloads in `specs/002-gestao-cmv-precificacao/contracts/openapi.yaml`
- [x] T093 Run full `npm.cmd run typecheck` validation
- [x] T094 Run full `npm.cmd run lint` validation
- [x] T095 Run full `npm.cmd run test` validation
- [x] T096 Execute quickstart validation from `specs/002-gestao-cmv-precificacao/quickstart.md`
- [x] T097 Document launch caveats for estimated operational stock in `specs/002-gestao-cmv-precificacao/quickstart.md`

---

## Phase 10: Completed Increment - Historical Payment Extract Import & Reconciliation

**Purpose**: Document implemented additions for importing historical bank/payment extracts, reconciling gross/net values, and showing accurate DRE period results.

- [x] T098 [US5] Extend payment enums and order reconciliation fields in `packages/database/prisma/schema.prisma`
- [x] T099 [US5] Add Prisma migrations for payment institution and order payment reconciliation fields in `packages/database/prisma/migrations`
- [x] T100 [US5] Implement historical order import DTO and layout selection in `apps/api/src/ordering/dto/import-orders.dto.ts`
- [x] T101 [US5] Implement simple, Mercado Pago and PagBank import parsing with duplicate detection in `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T102 [US5] Add admin import endpoint for historical orders in `apps/api/src/ordering/admin-order.controller.ts`
- [x] T103 [US5] Persist imported order payment institution, method, external ID, gross amount, fee amount, net amount and brand in `apps/api/src/ordering/historical-order-import.service.ts`
- [x] T104 [US5] Ensure imported order profitability snapshots use the original sale date in `apps/api/src/management/reports/order-profitability.service.ts`
- [x] T105 [US5] Adjust DRE and menu engineering period filters to use local business dates in `apps/api/src/management/reports/financial-reports.controller.ts` and `apps/api/src/management/reports/menu-engineering.controller.ts`
- [x] T106 [US5] Add acquired net revenue to DRE output in `apps/api/src/management/reports/dre.service.ts` and `packages/types/src/index.ts`
- [x] T107 [US5] Build admin import screen with layout selector, optional defaults, progress, success and error messages in `apps/web/app/admin/orders/import/order-import-client.tsx`
- [x] T108 [US5] Add import navigation and payment summary display in `apps/web/app/admin/page.tsx` and `apps/web/app/admin/orders/orders-client.tsx`
- [x] T109 [US5] Update DRE page to show received/acquired net revenue in `apps/web/app/admin/reports/dre/page.tsx`
- [x] T110 [US5] Add shared API/types for historical import and payment reconciliation in `apps/web/lib/api.ts` and `packages/types/src/index.ts`
- [x] T111 [US5] Add CAIXA_LOCAL as a supported payment institution in `packages/database/prisma/schema.prisma`, `packages/types/src/index.ts` and import UI labels
- [x] T112 Update feature specification, data model, quickstart and OpenAPI contract for completed payment import/reconciliation scope in `specs/002-gestao-cmv-precificacao`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all stories.
- **Phase 3 US1**: Depends on Phase 2. This is the MVP slice for admin configuration and domains.
- **Phase 4 US2**: Depends on Phase 2 and benefits from US1 domain records.
- **Phase 5 US3**: Depends on US2 technical sheets and US1 financial/platform settings.
- **Phase 6 US4**: Depends on US2 technical sheets and existing ordering flow.
- **Phase 7 US5**: Depends on US3/US4 snapshots and delivered orders.
- **Phase 8 US6**: Depends on US5 profitability data.
- **Phase 9 Polish**: Depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: First MVP; no story dependency after foundation.
- **US2 (P1)**: Requires domains from US1 for best real workflow, but can be tested with seeded defaults.
- **US3 (P1)**: Requires US2 for complete CMV and US1 for platform/financial settings.
- **US4 (P1)**: Requires US2 technical sheets and order lifecycle integration.
- **US5 (P2)**: Requires order profitability snapshots from US3/US4.
- **US6 (P3)**: Requires period profitability and sales data from US5.

### Parallel Opportunities

- T003 and T004 can run in parallel.
- T010, T011, T012 and T013 can run in parallel after schema work starts.
- US1 services T018-T021 can run in parallel.
- US2 calculation helpers and integration tests can run in parallel.
- US3 pricing tests T048-T050 can run in parallel.
- US4 stock tests T058-T061 can run in parallel.
- US5 report tests T072-T074 can run in parallel.
- US6 tests T083-T084 can run in parallel.
- Web pages for distinct admin sections can be split by route once shared API client methods are stable.

---

## Parallel Example: User Story 1

```text
Task: T014 Add API integration tests for financial configuration CRUD in apps/api/test/financial-config.integration.spec.ts
Task: T015 Add API integration tests for purchase unit tenant scoping in apps/api/test/domain-maintenance.integration.spec.ts
Task: T016 Add API integration tests for supplier and order platform CRUD in apps/api/test/domain-maintenance.integration.spec.ts
Task: T018 Implement FinancialConfiguration service in apps/api/src/management/financial/financial-configuration.service.ts
Task: T019 Implement PurchaseUnit service in apps/api/src/management/domains/purchase-unit.service.ts
Task: T020 Implement Supplier service in apps/api/src/management/domains/supplier.service.ts
Task: T021 Implement OrderPlatform service in apps/api/src/management/domains/order-platform.service.ts
```

## Parallel Example: User Story 4

```text
Task: T058 Add unit tests for stock movement reservation/release rules in apps/api/test/inventory.spec.ts
Task: T059 Add integration tests for order-created stock reservation in apps/api/test/inventory-order.integration.spec.ts
Task: T060 Add integration tests for cancelled order stock release in apps/api/test/inventory-order.integration.spec.ts
Task: T062 Implement stock movement calculation helpers in apps/api/src/operations/inventory/stock-movement-calculator.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Deliver US1 so all domains and financial parameters have maintenance screens.
3. Validate US1 independently with seeded pilot tenant.
4. Add US2 to make product CMV possible.
5. Add US3 to turn CMV into actionable pricing.

### Operational Increment

1. Add US4 after technical sheets are reliable.
2. Validate order lifecycle stock reservation/release before using inventory in live decisions.
3. Add US5 DRE once profitability snapshots are stable.
4. Add US6 menu engineering after enough delivered order data exists.

### Validation Discipline

- Write calculation and integration tests before implementation for each story.
- Keep tenant scoping in every service/controller test.
- Validate each story at its checkpoint before proceeding to dependent stories.
- Run typecheck, lint and tests before committing each major phase.
