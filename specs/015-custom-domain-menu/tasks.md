# Tasks: Cardapio por dominio da loja

**Input**: Design documents from `/specs/015-custom-domain-menu/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because tenant isolation, checkout behavior and public menu routing are critical operational flows in the project constitution.

**Organization**: Tasks are grouped by user story so each increment can be validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files without depending on unfinished work
- **[Story]**: User story from spec.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish persistence and reserve the new public route.

- [x] T001 Add nullable unique `publicDomain` mapping to Tenant in `packages/database/prisma/schema.prisma`
- [x] T002 Create the additive `public_domain` unique-column migration in `packages/database/prisma/migrations/20260722090000_add_tenant_public_domain/migration.sql`
- [x] T003 [P] Reserve `cardapio` against future store slugs and extend slug tests in `apps/api/src/platform/stores/store-slug.ts` and `apps/api/src/platform/stores/store-slug.spec.ts`
- [x] T004 Regenerate the Prisma client and validate the schema from `packages/database/prisma/schema.prisma`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide one canonical domain rule and shared contracts used by all stories.

**CRITICAL**: No user story work starts until canonicalization and persistence are ready.

- [x] T005 [P] Add failing unit cases for canonicalization, `www.`, invalid URLs, ports, labels and empty values in `apps/api/src/platform/stores/store-domain.spec.ts`
- [x] T006 Implement strict domain validation and canonicalization in `apps/api/src/platform/stores/store-domain.ts`
- [x] T007 [P] Add `publicDomain` and `publicMenuUrl` to store input, summary and detail contracts in `packages/types/src/index.ts`
- [x] T008 Update seed and store fixtures to tolerate the nullable domain field in `packages/database/prisma/seed.ts` and affected test builders under `apps/api/test/`

**Checkpoint**: Database and canonical domain contract are ready for story work.

---

## Phase 3: User Story 1 - Acessar cardapio pelo dominio (Priority: P1) MVP

**Goal**: Resolve an active store from the requested domain and render its existing menu at `/cardapio` without tenant fallback.

**Independent Test**: Configure three tenant fixtures with distinct domains, request each domain menu and verify correct isolation; an unknown or inactive domain returns not found.

### Tests for User Story 1

- [x] T009 [P] [US1] Add API contract tests for valid, `www.`, unknown, malformed and inactive domains in `apps/api/test/public-domain-menu.integration.spec.ts`
- [x] T010 [P] [US1] Add frontend API cache/isolation tests for domain menu requests in `apps/web/app/(public-menu)/[slug]/public-menu-api.spec.ts`
- [x] T011 [P] [US1] Add page tests for forwarded host, direct host, port removal and not-found behavior in `apps/web/app/(public-menu)/cardapio/page.spec.tsx`

### Implementation for User Story 1

- [x] T012 [US1] Resolve active tenants by canonical `publicDomain` and reuse menu assembly in `apps/api/src/catalog/catalog.service.ts`
- [x] T013 [US1] Expose `GET /api/public/domains/:domain/menu` with safe request-origin handling and structured resolution logs in `apps/api/src/catalog/controllers/public-menu.controller.ts`
- [x] T014 [US1] Add domain-keyed public menu fetching without cross-domain stale fallback in `apps/web/lib/api.ts`
- [x] T015 [US1] Implement trusted host extraction and the fixed public route in `apps/web/app/(public-menu)/cardapio/page.tsx`
- [x] T016 [US1] Verify the legacy `/{slug}` page remains unchanged and passes regression coverage in `apps/web/app/(public-menu)/[slug]/page.tsx` and `apps/web/app/(public-menu)/[slug]/public-menu-api.spec.ts`

**Checkpoint**: `/cardapio` independently renders the correct active store for each configured domain.

---

## Phase 4: User Story 2 - Configurar dominio da loja (Priority: P2)

**Goal**: Allow platform administrators to assign, replace and remove an exclusive domain and see the resulting public URL.

**Independent Test**: Save a valid domain in store maintenance, verify canonical response and audit metadata, then reject reuse by another store and remove it successfully.

### Tests for User Story 2

- [x] T017 [P] [US2] Extend platform store integration tests with create/update/remove, normalization, duplicate conflict and audit cases in `apps/api/test/store-onboarding.integration.spec.ts`
- [x] T018 [P] [US2] Extend platform store UI tests with domain input, validation feedback and final menu URL in `apps/web/app/platform/stores/stores.spec.tsx`

### Implementation for User Story 2

- [x] T019 [US2] Accept nullable domain input with length validation in `apps/api/src/platform/stores/dto/store-onboarding.dto.ts`
- [x] T020 [US2] Canonicalize, check uniqueness, persist and audit domain changes in `apps/api/src/platform/stores/platform-store.service.ts`
- [x] T021 [US2] Return `publicDomain` and `publicMenuUrl` in store list/detail responses from `apps/api/src/platform/stores/platform-store.service.ts`
- [x] T022 [US2] Add domain editing and the final clickable `/cardapio` URL to the active maintenance UI in `apps/web/app/platform/stores/store-maintenance-client.tsx`
- [x] T023 [US2] Keep the store detail route consistent with domain editing in `apps/web/app/platform/stores/[storeId]/page.tsx`

**Checkpoint**: Platform administration can manage domains without deployment and conflicts are rejected atomically.

---

## Phase 5: User Story 3 - Concluir pedido no endereco amigavel (Priority: P3)

**Goal**: Preserve the domain-based navigation through cart submission and order confirmation while using existing tenant-safe checkout rules.

**Independent Test**: Create an order from `/cardapio`, verify its tenant, land on `/cardapio/pedido/{id}`, and return to `/cardapio`; repeat the legacy slug flow as regression.

### Tests for User Story 3

- [x] T024 [P] [US3] Add client navigation tests for domain and legacy menu bases in `apps/web/app/(public-menu)/[slug]/public-menu-client.spec.tsx`
- [x] T025 [P] [US3] Add confirmation-page tests for domain-based return and WhatsApp links in `apps/web/app/(public-menu)/cardapio/pedido/[orderId]/page.spec.tsx`
- [x] T026 [P] [US3] Add an ordering isolation regression for the slug returned by domain resolution in `apps/api/test/pilot-hardening.e2e.spec.ts`

### Implementation for User Story 3

- [x] T027 [US3] Parameterize menu navigation base without changing tenant-safe order submission in `apps/web/app/(public-menu)/[slug]/public-menu-client.tsx`
- [x] T028 [US3] Pass legacy and domain navigation bases from `apps/web/app/(public-menu)/[slug]/page.tsx` and `apps/web/app/(public-menu)/cardapio/page.tsx`
- [x] T029 [US3] Implement domain-friendly confirmation at `apps/web/app/(public-menu)/cardapio/pedido/[orderId]/page.tsx`
- [x] T030 [US3] Reuse a shared confirmation presentation for legacy and domain routes in `apps/web/app/(public-menu)/_components/order-confirmation.tsx` and `apps/web/app/(public-menu)/[slug]/pedido/[orderId]/page.tsx`

**Checkpoint**: Both domain and legacy checkout journeys work without cross-tenant data or broken return URLs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate migration, deployment prerequisites, cache behavior and complete documentation.

- [x] T031 [P] Document DNS, custom-domain registration, HTTPS and proxy-host prerequisites in `specs/015-custom-domain-menu/quickstart.md`
- [x] T032 [P] Update the OpenAPI contract with final response/error examples in `specs/015-custom-domain-menu/contracts/public-domain-menu.openapi.yaml`
- [x] T033 Run migration validation, API/web typecheck, targeted tests and lint commands from `specs/015-custom-domain-menu/quickstart.md`
- [x] T034 Execute the two-domain isolation and 60-second deactivation checks documented in `specs/015-custom-domain-menu/quickstart.md`
- [x] T035 Review logs and responses to ensure raw forwarded headers, credentials and unrelated tenant data are not exposed in `apps/api/src/catalog/controllers/public-menu.controller.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on schema and migration; blocks every user story.
- **US1 (Phase 3)**: Depends on Foundation and provides domain resolution used by US3.
- **US2 (Phase 4)**: Depends on Foundation; can proceed alongside US1 after shared contracts are ready.
- **US3 (Phase 5)**: Depends on US1 page/menu resolution; does not require US2 UI when fixtures are used.
- **Polish (Phase 6)**: Depends on all selected stories.

### User Story Dependencies

```text
Foundation --> US1 --> US3
          `-> US2
US1 + US2 + US3 --> Polish
```

### Within Each User Story

- Write and run the story tests before implementation.
- Implement service rules before controller or page integration.
- Keep unknown/inactive domain failure closed; never add a default tenant fallback.
- Complete the independent checkpoint before advancing.

### Parallel Opportunities

- T003 can run while T001-T002 establish persistence.
- T005 and T007 can run in parallel.
- US1 API tests, web API tests and page tests (T009-T011) touch separate files.
- US2 API and UI tests (T017-T018) can run in parallel.
- US3 navigation, confirmation and API regression tests (T024-T026) can run in parallel.
- Documentation tasks T031-T032 can run in parallel before final validation.

---

## Parallel Example: User Story 1

```text
Task T009: API contract tests in apps/api/test/public-domain-menu.integration.spec.ts
Task T010: Web fetch/cache tests in apps/web/app/(public-menu)/[slug]/public-menu-api.spec.ts
Task T011: Fixed route tests in apps/web/app/(public-menu)/cardapio/page.spec.tsx
```

## Parallel Example: User Story 2

```text
Task T017: Store API integration tests in apps/api/test/store-onboarding.integration.spec.ts
Task T018: Store maintenance UI tests in apps/web/app/platform/stores/stores.spec.tsx
```

## Parallel Example: User Story 3

```text
Task T024: Menu navigation tests in public-menu-client.spec.tsx
Task T025: Confirmation route tests in cardapio/pedido/[orderId]/page.spec.tsx
Task T026: Tenant isolation regression in apps/api/test/pilot-hardening.e2e.spec.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Implement US1 through T016.
3. Validate at least two domains plus unknown/inactive hosts.
4. Demonstrate `/cardapio` before adding administration and checkout URL polish.

### Incremental Delivery

1. Foundation establishes the unique domain model.
2. US1 delivers public domain resolution.
3. US2 removes database/manual configuration dependency.
4. US3 completes the friendly customer journey.
5. Polish validates infrastructure and operational readiness.

## Notes

- Tasks marked `[P]` modify independent files or can be prepared before dependent implementation.
- DNS and TLS automation remain out of scope; application behavior begins after the host reaches the web service.
- Do not remove slug endpoints during this feature.
- Do not trust a forwarded host to select a default store when validation or lookup fails.
