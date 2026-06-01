# Tasks: Cadastro de Lojas e Personalizacao Visual

**Input**: Design documents from `/specs/003-store-onboarding-branding/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Required for store creation, owner login, slug validation, inactive store behavior, tenant isolation, branding publication, layout presets and the full create-store -> publish-branded-menu flow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup

**Purpose**: Prepare shared structure for platform store setup and store branding.

- [ ] T001 Create API module folders for platform stores and branding in `apps/api/src/platform/stores` and `apps/api/src/customer-experience/branding`
- [ ] T002 Create web route folders for platform store setup and admin branding in `apps/web/app/platform/stores` and `apps/web/app/admin/branding`
- [ ] T003 [P] Add shared store onboarding and branding DTO/type exports in `packages/types/src/index.ts`
- [ ] T004 [P] Add seed data for a platform administrator and default layout presets in `packages/database/prisma/seed.ts`
- [ ] T005 Verify OpenAPI contract path coverage against `specs/003-store-onboarding-branding/contracts/openapi.yaml`

---

## Phase 2: Foundational

**Purpose**: Database, authorization and reusable validation primitives required by all user stories.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T006 Add Prisma enums/models for PlatformUser or platform role, StoreVisualConfiguration, LayoutPreset and visual configuration status in `packages/database/prisma/schema.prisma`
- [ ] T007 Extend Tenant model with explicit setup/branding fields needed for launch readiness in `packages/database/prisma/schema.prisma`
- [ ] T008 Create Prisma migration for store onboarding and visual configuration schema in `packages/database/prisma/migrations`
- [ ] T009 Regenerate Prisma client and validate schema with `packages/database/prisma/schema.prisma`
- [ ] T010 [P] Add slug normalization and reserved-word validation helpers in `apps/api/src/platform/stores/store-slug.ts`
- [ ] T011 [P] Add color contrast and hex color validation helpers in `apps/api/src/customer-experience/branding/color-contrast.ts`
- [ ] T012 [P] Add platform-admin authorization guard/decorator in `apps/api/src/platform/auth/platform-admin.guard.ts`
- [ ] T013 [P] Add shared admin/platform API client primitives for stores and branding in `apps/web/lib/api.ts`
- [ ] T014 Add structured audit logging for store setup and branding publication in `apps/api/src/platform/stores/store-audit.ts`

**Checkpoint**: Foundation ready; user story implementation can proceed.

---

## Phase 3: User Story 1 - Cadastrar uma nova loja operacional (Priority: P1) MVP

**Goal**: Platform administrator can create and manage stores with a responsible owner, and the owner can access only that store.

**Independent Test**: Create a store with slug and owner, log in as the owner, verify public tenant access by slug and confirm cross-store data is blocked.

### Tests

- [ ] T015 [P] [US1] Add API integration tests for platform store creation and owner creation in `apps/api/test/store-onboarding.integration.spec.ts`
- [ ] T016 [P] [US1] Add API integration tests for slug uniqueness, reserved slugs and slug normalization in `apps/api/test/store-onboarding.integration.spec.ts`
- [ ] T017 [P] [US1] Add API integration tests for owner login and tenant scoping in `apps/api/test/store-onboarding.integration.spec.ts`
- [ ] T018 [P] [US1] Add web form behavior tests for platform store setup in `apps/web/app/platform/stores/stores.spec.tsx`

### Implementation

- [ ] T019 [P] [US1] Implement store onboarding DTOs in `apps/api/src/platform/stores/dto/store-onboarding.dto.ts`
- [ ] T020 [P] [US1] Implement launch readiness calculator in `apps/api/src/platform/stores/launch-readiness.ts`
- [ ] T021 [US1] Implement platform store service with tenant and owner creation in `apps/api/src/platform/stores/platform-store.service.ts`
- [ ] T022 [US1] Implement platform store controller for list, create, detail, update and readiness in `apps/api/src/platform/stores/platform-store.controller.ts`
- [ ] T023 [US1] Register store setup providers/controllers in `apps/api/src/platform/stores/platform-store.module.ts` and `apps/api/src/app.module.ts`
- [ ] T024 [US1] Update authentication flow to support platform administrator access without breaking tenant owner access in `apps/api/src/platform/auth/auth.service.ts`
- [ ] T025 [US1] Add admin API client methods for platform store setup in `apps/web/lib/api.ts`
- [ ] T026 [US1] Build platform store list and create form page in `apps/web/app/platform/stores/page.tsx`
- [ ] T027 [US1] Build platform store detail/readiness page in `apps/web/app/platform/stores/[storeId]/page.tsx`
- [ ] T028 [US1] Add platform navigation entry for store setup in `apps/web/app/admin/page.tsx`

**Checkpoint**: New stores can be created without seed/script edits and owners are tenant-scoped.

---

## Phase 4: User Story 2 - Configurar identidade visual da loja (Priority: P1)

**Goal**: Store owner can save logo and color branding, validate contrast and publish branding to public store pages.

**Independent Test**: Save branding for a store, preview it, publish it and verify public tenant/menu responses include the published identity.

### Tests

- [ ] T029 [P] [US2] Add unit tests for hex color and contrast validation in `apps/api/test/store-branding.spec.ts`
- [ ] T030 [P] [US2] Add API integration tests for saving branding drafts and rejecting unsafe contrast in `apps/api/test/store-branding.integration.spec.ts`
- [ ] T031 [P] [US2] Add API integration tests for public tenant branding exposure in `apps/api/test/store-branding.integration.spec.ts`
- [ ] T032 [P] [US2] Add web form behavior tests for branding settings in `apps/web/app/admin/branding/branding.spec.tsx`

### Implementation

- [ ] T033 [P] [US2] Implement branding DTOs in `apps/api/src/customer-experience/branding/dto/store-branding.dto.ts`
- [ ] T034 [P] [US2] Implement default branding resolver in `apps/api/src/customer-experience/branding/default-branding.ts`
- [ ] T035 [US2] Implement store branding service for draft save, preview validation and published lookup in `apps/api/src/customer-experience/branding/store-branding.service.ts`
- [ ] T036 [US2] Implement store branding controller for get, save draft and preview in `apps/api/src/customer-experience/branding/store-branding.controller.ts`
- [ ] T037 [US2] Register branding module in `apps/api/src/customer-experience/branding/branding.module.ts` and `apps/api/src/app.module.ts`
- [ ] T038 [US2] Extend public tenant/menu responses with published or default branding in `apps/api/src/platform/tenant/tenant-context.service.ts` and `apps/api/src/catalog/catalog.service.ts`
- [ ] T039 [US2] Add admin API client methods for branding state, draft save and preview in `apps/web/lib/api.ts`
- [ ] T040 [US2] Build branding settings page with logo URL and color controls in `apps/web/app/admin/branding/page.tsx`
- [ ] T041 [US2] Apply published branding tokens to public menu rendering in `apps/web/app/(public-menu)/[slug]/public-menu-client.tsx`
- [ ] T042 [US2] Add lightweight store identity cue to admin dashboard in `apps/web/app/admin/page.tsx`

**Checkpoint**: Store branding can be configured and appears on public store pages.

---

## Phase 5: User Story 3 - Escolher layout das telas da loja (Priority: P2)

**Goal**: Store owner can choose an approved layout preset and public menu uses the selected preset safely.

**Independent Test**: Select each layout preset, preview it and verify public menu composition changes while remaining usable on mobile and desktop.

### Tests

- [ ] T043 [P] [US3] Add unit tests for layout preset availability and fallback rules in `apps/api/test/store-layout.spec.ts`
- [ ] T044 [P] [US3] Add API integration tests for layout preset selection in branding drafts in `apps/api/test/store-branding.integration.spec.ts`
- [ ] T045 [P] [US3] Add web tests for layout selector and preview state in `apps/web/app/admin/branding/branding.spec.tsx`

### Implementation

- [ ] T046 [P] [US3] Implement layout preset registry in `apps/api/src/customer-experience/branding/layout-presets.ts`
- [ ] T047 [US3] Extend branding service to validate active layout presets in `apps/api/src/customer-experience/branding/store-branding.service.ts`
- [ ] T048 [US3] Add layout preset options to branding API responses in `apps/api/src/customer-experience/branding/store-branding.controller.ts`
- [ ] T049 [US3] Add layout selector UI to branding page in `apps/web/app/admin/branding/page.tsx`
- [ ] T050 [US3] Implement public menu layout variants in `apps/web/app/(public-menu)/[slug]/public-menu-client.tsx`
- [ ] T051 [US3] Add responsive styling for classic, compact and visual menu presets in `apps/web/app/globals.css`

**Checkpoint**: Layout presets are selectable, previewable and reflected in public menu.

---

## Phase 6: User Story 4 - Revisar, publicar e restaurar configuracoes visuais (Priority: P3)

**Goal**: Store owner can publish a draft, view publication history and restore the previous published configuration.

**Independent Test**: Save draft, publish it, change branding again, publish again, then restore the previous published configuration and verify public pages revert.

### Tests

- [ ] T052 [P] [US4] Add API integration tests for publish, history and restore flows in `apps/api/test/store-branding.integration.spec.ts`
- [ ] T053 [P] [US4] Add E2E test for create store, owner login, publish branding and restore previous branding in `apps/api/test/store-onboarding-flow.e2e.spec.ts`
- [ ] T054 [P] [US4] Add web behavior tests for publish/history/restore controls in `apps/web/app/admin/branding/branding.spec.tsx`

### Implementation

- [ ] T055 [US4] Extend store branding service with publish, archive and restore transitions in `apps/api/src/customer-experience/branding/store-branding.service.ts`
- [ ] T056 [US4] Add publish, history and restore endpoints in `apps/api/src/customer-experience/branding/store-branding.controller.ts`
- [ ] T057 [US4] Add admin API client methods for publish, history and restore in `apps/web/lib/api.ts`
- [ ] T058 [US4] Add preview, publish, history and restore controls to branding page in `apps/web/app/admin/branding/page.tsx`
- [ ] T059 [US4] Add published branding audit entries in `apps/api/src/platform/stores/store-audit.ts`

**Checkpoint**: Visual configuration can be safely published and restored.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation and operational readiness across all stories.

- [ ] T060 [P] Update feature quickstart with implementation-specific details in `specs/003-store-onboarding-branding/quickstart.md`
- [ ] T061 [P] Add OpenAPI examples for key request/response payloads in `specs/003-store-onboarding-branding/contracts/openapi.yaml`
- [ ] T062 [P] Add empty/loading/error states across platform store and branding pages in `apps/web/app/platform/stores` and `apps/web/app/admin/branding`
- [ ] T063 Verify public menu mobile usability for all layout presets in `apps/web/app/(public-menu)/[slug]/public-menu-client.tsx`
- [ ] T064 Run full `npm.cmd run typecheck --workspaces --if-present` validation
- [ ] T065 Run full `npm.cmd run lint --workspaces --if-present` validation
- [ ] T066 Run full `npm.cmd run test --workspaces --if-present` validation
- [ ] T067 Execute quickstart validation from `specs/003-store-onboarding-branding/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all stories.
- **Phase 3 US1**: Depends on Phase 2. This is the MVP slice for creating stores and owners.
- **Phase 4 US2**: Depends on Phase 2 and benefits from US1-created stores; can be tested with seeded stores.
- **Phase 5 US3**: Depends on US2 branding draft/published configuration.
- **Phase 6 US4**: Depends on US2 and US3 configuration records.
- **Phase 7 Polish**: Depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: First MVP; no story dependency after foundation.
- **US2 (P1)**: Can be built after foundation using existing/seeded tenants, but full real workflow benefits from US1.
- **US3 (P2)**: Requires US2 branding configuration to carry layout preset choices.
- **US4 (P3)**: Requires US2 draft/published branding and US3 layout selection to restore full visual state.

### Parallel Opportunities

- T003 and T004 can run in parallel.
- T010, T011, T012, T013 and T014 can run in parallel after schema work starts.
- US1 tests T015-T018 can run in parallel.
- US2 tests T029-T032 can run in parallel.
- US3 tests T043-T045 can run in parallel.
- US4 tests T052-T054 can run in parallel.
- Web pages for platform store setup and admin branding can be split once shared API clients are stable.

---

## Parallel Example: User Story 1

```text
Task: T015 Add API integration tests for platform store creation and owner creation in apps/api/test/store-onboarding.integration.spec.ts
Task: T016 Add API integration tests for slug uniqueness, reserved slugs and slug normalization in apps/api/test/store-onboarding.integration.spec.ts
Task: T017 Add API integration tests for owner login and tenant scoping in apps/api/test/store-onboarding.integration.spec.ts
Task: T018 Add web form behavior tests for platform store setup in apps/web/app/platform/stores/stores.spec.tsx
Task: T019 Implement store onboarding DTOs in apps/api/src/platform/stores/dto/store-onboarding.dto.ts
Task: T020 Implement launch readiness calculator in apps/api/src/platform/stores/launch-readiness.ts
```

## Parallel Example: User Story 2

```text
Task: T029 Add unit tests for hex color and contrast validation in apps/api/test/store-branding.spec.ts
Task: T030 Add API integration tests for saving branding drafts and rejecting unsafe contrast in apps/api/test/store-branding.integration.spec.ts
Task: T031 Add API integration tests for public tenant branding exposure in apps/api/test/store-branding.integration.spec.ts
Task: T032 Add web form behavior tests for branding settings in apps/web/app/admin/branding/branding.spec.tsx
Task: T033 Implement branding DTOs in apps/api/src/customer-experience/branding/dto/store-branding.dto.ts
Task: T034 Implement default branding resolver in apps/api/src/customer-experience/branding/default-branding.ts
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Deliver US1 so new stores and responsible owners can be created without technical intervention.
3. Validate owner login, tenant scoping, slug uniqueness and public tenant access.
4. Add US2 so stores can publish basic brand identity.

### Incremental Delivery

1. Add US3 after branding is stable to introduce layout presets.
2. Add US4 after visual configurations are stored as drafts/published versions.
3. Validate public menu behavior after each story so store setup never breaks existing ordering.

### Validation Discipline

- Write integration tests before implementation for tenant isolation, store setup and branding publication.
- Keep platform-admin permissions distinct from tenant owner/admin permissions.
- Validate cross-store access with at least two stores in test data.
- Run typecheck, lint and tests before marking the feature ready.
