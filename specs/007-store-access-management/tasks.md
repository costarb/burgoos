# Tasks: Login e Gestao de Acessos por Loja

**Input**: Design documents from `/specs/007-store-access-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Auth, permission resolution, tenant isolation, last-master protection, audit and main UI flows require automated coverage.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: User story mapped from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare source folders, shared contracts and permission catalog baseline.

- [x] T001 Create access-management source directories under `apps/api/src/auth/`, `apps/api/src/auth/dto/`, `apps/api/src/auth/guards/`, `apps/api/src/auth/strategies/`, `apps/api/src/management/access/users/`, `apps/api/src/management/access/profiles/`, `apps/api/src/management/access/permissions/`, `apps/web/app/login/`, `apps/web/app/admin/users/`, `apps/web/app/admin/access-profiles/`, and `apps/web/app/admin/access-audit/`
- [x] T002 [P] Add access-management shared TypeScript contracts for users, stores, profiles, permissions, sessions and audit events in `packages/types/src/index.ts`
- [x] T003 [P] Define the initial business permission catalog keys and group metadata in `apps/api/src/management/access/permissions/permission-catalog.ts`
- [x] T004 [P] Add access-management seed-data notes for master user, pilot store admin and baseline profiles in `specs/007-store-access-management/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add persistence, module wiring, guards and helpers required by all access stories.

**CRITICAL**: Complete this phase before implementing user stories.

- [x] T005 Add User, UserStoreAssignment, AccessProfile, Permission, AccessProfilePermission, SessionToken, PasswordResetToken and AccessAuditEvent models/enums in `packages/database/prisma/schema.prisma`
- [x] T006 Generate the access-management database migration in `packages/database/prisma/migrations/`
- [x] T007 [P] Add validated auth DTOs for login, refresh, password reset and store switching in `apps/api/src/auth/dto/`
- [x] T008 [P] Add validated access DTOs for user filters, user mutations, profile mutations and audit filters in `apps/api/src/management/access/dto/`
- [x] T009 [P] Implement password hashing and token hashing helpers in `apps/api/src/auth/auth-crypto.service.ts`
- [x] T010 [P] Implement immutable access audit recording in `apps/api/src/management/access/access-audit.service.ts`
- [x] T011 Implement current-user and active-store request context resolution in `apps/api/src/auth/current-user.service.ts`
- [x] T012 Implement JWT auth guard, permission guard and store-scope guard in `apps/api/src/auth/guards/`
- [x] T013 Register auth and access modules in `apps/api/src/app.module.ts` and `apps/api/src/management/management.module.ts`
- [x] T014 [P] Add reusable web auth client helpers in `apps/web/lib/auth-client.ts`
- [x] T015 [P] Add reusable permission-gate and access-denied components in `apps/web/components/admin/permission-gate.tsx` and `apps/web/components/admin/access-denied.tsx`

**Checkpoint**: Persistence, request context, auth guards and shared UI helpers are ready.

---

## Phase 3: User Story 1 - Acessar o sistema com seguranca (Priority: P1) MVP

**Goal**: Users can sign in, establish a secure admin session, select only authorized stores and be blocked from unauthorized access.

**Independent Test**: Create active, inactive, single-store and multi-store users; validate login, denial, store selection and direct-route protection.

### Tests for User Story 1

- [x] T016 [P] [US1] Add unit tests for credential validation, inactive-user denial, token lifecycle and active-store validation in `apps/api/src/auth/auth.service.spec.ts`
- [x] T017 [P] [US1] Add integration tests for login, refresh, logout, password reset and store-switch endpoints in `apps/api/test/auth.integration.spec.ts`
- [x] T018 [P] [US1] Add web tests for login form states, invalid credentials, multi-store selection and access denied rendering in `apps/web/app/login/login-page.spec.tsx`

### Implementation for User Story 1

- [x] T019 [P] [US1] Implement authentication service for login, refresh, logout, first access and password reset in `apps/api/src/auth/auth.service.ts`
- [x] T020 [US1] Implement auth controller endpoints from contract in `apps/api/src/auth/auth.controller.ts`
- [x] T021 [US1] Implement session token persistence and revocation behavior in `apps/api/src/auth/session-token.service.ts`
- [x] T022 [US1] Implement password reset token issue and confirm behavior in `apps/api/src/auth/password-reset.service.ts`
- [x] T023 [US1] Implement store-switch endpoint and active-store validation in `apps/api/src/auth/store-context.controller.ts`
- [x] T024 [P] [US1] Implement login page with validation, loading, denial and first-access links in `apps/web/app/login/page.tsx`
- [x] T025 [P] [US1] Implement store switcher for authorized stores in `apps/web/components/admin/store-switcher.tsx`
- [x] T026 [US1] Protect admin layout with session loading, permission context and store switcher in `apps/web/app/admin/layout.tsx`
- [x] T027 [US1] Add auth and active-store contracts to the implemented OpenAPI docs in `specs/007-store-access-management/contracts/openapi.yaml`

**Checkpoint**: Login, session refresh, logout, password reset and authorized store selection are functional.

---

## Phase 4: User Story 2 - Administrar usuarios globalmente como master (Priority: P1)

**Goal**: Master users can create, view, edit, activate, deactivate and filter users across all stores while preserving at least one active master.

**Independent Test**: Sign in as master, manage users in two stores, assign profiles, deactivate users and confirm last-master protection.

### Tests for User Story 2

- [x] T028 [P] [US2] Add unit tests for master authority, unique login and last-active-master rules in `apps/api/src/management/access/users/user-access-rules.spec.ts`
- [x] T029 [P] [US2] Add integration tests for master user CRUD, filters, store assignments and last-master conflict in `apps/api/test/access-users-master.integration.spec.ts`
- [x] T030 [P] [US2] Add web tests for master user list, create/edit dialog, filters and deactivate flow in `apps/web/app/admin/users/users-page.spec.tsx`

### Implementation for User Story 2

- [x] T031 [P] [US2] Implement user access rule helpers for master scope and last-master protection in `apps/api/src/management/access/users/user-access-rules.ts`
- [x] T032 [US2] Implement master-scoped user list, detail, create, update and status changes in `apps/api/src/management/access/users/users.service.ts`
- [x] T033 [US2] Implement user maintenance endpoints with permission and store-scope checks in `apps/api/src/management/access/users/users.controller.ts`
- [x] T034 [US2] Record audit events for master user maintenance and store assignment changes in `apps/api/src/management/access/users/users.service.ts`
- [x] T035 [P] [US2] Implement master-capable user list, search and filters in `apps/web/app/admin/users/users-client.tsx`
- [x] T036 [P] [US2] Implement user create/edit, store assignments, profile assignment and status form in `apps/web/app/admin/users/user-form.tsx`
- [x] T037 [P] [US2] Implement deactivate/reactivate confirmation dialog in `apps/web/app/admin/users/user-status-dialog.tsx`
- [x] T038 [US2] Compose users route with server-side data loading and permission denial states in `apps/web/app/admin/users/page.tsx`

**Checkpoint**: Master user maintenance works across stores and cannot remove the last active master.

---

## Phase 5: User Story 3 - Administrar usuarios da propria loja (Priority: P2)

**Goal**: Store admins can manage only users and assignments inside stores where they have local access-management authority.

**Independent Test**: Sign in as Store A admin, manage Store A users, attempt Store B assignment or direct access and confirm denial plus audit.

### Tests for User Story 3

- [x] T039 [P] [US3] Add unit tests for store-admin assignment boundaries and forbidden master changes in `apps/api/src/management/access/users/store-admin-user-rules.spec.ts`
- [x] T040 [P] [US3] Add integration tests for local admin user CRUD and cross-tenant denial in `apps/api/test/access-users-store-admin.integration.spec.ts`
- [x] T041 [P] [US3] Add E2E coverage for Store A admin local user creation and Store B denial in `apps/web/tests/access-store-admin.e2e.spec.ts`

### Implementation for User Story 3

- [x] T042 [P] [US3] Implement store-admin scope helpers for allowed stores, assignable profiles and forbidden global changes in `apps/api/src/management/access/users/store-admin-user-rules.ts`
- [x] T043 [US3] Extend user service to apply store-admin list, create and update restrictions in `apps/api/src/management/access/users/users.service.ts`
- [x] T044 [US3] Add access-denied audit recording for cross-tenant user maintenance attempts in `apps/api/src/management/access/users/users.service.ts`
- [x] T045 [US3] Restrict user maintenance UI controls for store admins in `apps/web/app/admin/users/users-client.tsx`
- [x] T046 [US3] Restrict store and profile options in the user form according to current actor scope in `apps/web/app/admin/users/user-form.tsx`
- [x] T047 [US3] Document store-admin validation evidence in `specs/007-store-access-management/quickstart.md`

**Checkpoint**: Store admins manage local users only, with server-side denial for every cross-tenant attempt.

---

## Phase 6: User Story 4 - Configurar perfis e permissoes (Priority: P2)

**Goal**: Authorized users can create, edit, duplicate, activate and deactivate access profiles with reviewable permissions.

**Independent Test**: Create profiles with grouped permissions, assign them to users and validate menus/actions change according to the profile.

### Tests for User Story 4

- [x] T048 [P] [US4] Add unit tests for profile name uniqueness, profile scope and permission grant validation in `apps/api/src/management/access/profiles/access-profiles.service.spec.ts`
- [x] T049 [P] [US4] Add integration tests for profile CRUD, duplicate, inactivation conflict and permission catalog in `apps/api/test/access-profiles.integration.spec.ts`
- [x] T050 [P] [US4] Add web tests for profile list, permission grouping, duplicate and edit flows in `apps/web/app/admin/access-profiles/access-profiles-page.spec.tsx`

### Implementation for User Story 4

- [x] T051 [P] [US4] Implement permission catalog service and grouped permission query in `apps/api/src/management/access/permissions/permissions.service.ts`
- [x] T052 [US4] Implement access profile create, update, duplicate, status changes and permission grants in `apps/api/src/management/access/profiles/access-profiles.service.ts`
- [x] T053 [US4] Implement profile and permission endpoints with master/store-admin scope checks in `apps/api/src/management/access/profiles/access-profiles.controller.ts` and `apps/api/src/management/access/permissions/permissions.controller.ts`
- [x] T054 [US4] Enforce profile permission changes in auth permission resolution in `apps/api/src/auth/current-user.service.ts`
- [x] T055 [P] [US4] Implement access profile list and filters in `apps/web/app/admin/access-profiles/access-profiles-client.tsx`
- [x] T056 [P] [US4] Implement profile form with grouped permission selector and sensitive-permission indicators in `apps/web/app/admin/access-profiles/access-profile-form.tsx`
- [x] T057 [P] [US4] Implement profile duplicate and deactivate dialogs in `apps/web/app/admin/access-profiles/access-profile-actions.tsx`
- [x] T058 [US4] Compose access profile route and permission catalog loading in `apps/web/app/admin/access-profiles/page.tsx`

**Checkpoint**: Profiles and permission grants control visible screens and server-authorized actions.

---

## Phase 7: User Story 5 - Auditar gerenciamento de acessos (Priority: P3)

**Goal**: Master and store admins can review scoped audit events for login, denial and access-management changes.

**Independent Test**: Perform login failures, user changes, profile changes and cross-tenant denials, then confirm master sees all events and store admins see only authorized store events.

### Tests for User Story 5

- [x] T059 [P] [US5] Add unit tests for audit event redaction and scoped audit filtering in `apps/api/src/management/access/access-audit.service.spec.ts`
- [x] T060 [P] [US5] Add integration tests for access audit query permissions and tenant isolation in `apps/api/test/access-audit.integration.spec.ts`
- [x] T061 [P] [US5] Add web tests for audit filters, empty state and scoped results in `apps/web/app/admin/access-audit/access-audit-page.spec.tsx`

### Implementation for User Story 5

- [x] T062 [US5] Implement scoped audit query service with sensitive metadata redaction in `apps/api/src/management/access/access-audit.service.ts`
- [x] T063 [US5] Implement access audit endpoint with master and store-admin filtering in `apps/api/src/management/access/access-audit.controller.ts`
- [x] T064 [US5] Ensure login failures, access denials, profile changes and password changes record audit events in `apps/api/src/auth/auth.service.ts` and `apps/api/src/management/access/profiles/access-profiles.service.ts`
- [x] T065 [P] [US5] Implement audit list, filters and event detail drawer in `apps/web/app/admin/access-audit/access-audit-client.tsx`
- [x] T066 [US5] Compose access audit route with scoped data loading in `apps/web/app/admin/access-audit/page.tsx`
- [x] T067 [US5] Validate audit scenarios and record evidence in `specs/007-store-access-management/quickstart.md`

**Checkpoint**: Access events are audit-ready, scoped correctly and free of sensitive secret values.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature and prepare it for operational use.

- [x] T068 [P] Add master user, Store A admin, Store B and baseline profiles to non-destructive seed data in `packages/database/prisma/seed.ts`
- [x] T069 [P] Update admin navigation entries for users, profiles and audit in `apps/web/components/admin/admin-navigation.ts`
- [x] T070 [P] Update the implemented API contract examples and error responses in `specs/007-store-access-management/contracts/openapi.yaml`
- [x] T071 Run Prisma validation/generation, lint, typecheck and automated tests from `package.json`
- [x] T072 Validate every quickstart scenario and record results in `specs/007-store-access-management/quickstart.md`
- [x] T073 Complete security review for tenant isolation, credential secrecy, token revocation, last-master protection and audit redaction in `specs/007-store-access-management/security-review.md`
- [x] T074 Verify login and list performance targets from `plan.md` and document results in `specs/007-store-access-management/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; it is the recommended MVP.
- **US2 (Phase 4)**: Depends on Foundational and uses US1 authentication context.
- **US3 (Phase 5)**: Depends on Foundational and uses US1 authentication context.
- **US4 (Phase 6)**: Depends on Foundational and can run after US1 auth context is available.
- **US5 (Phase 7)**: Depends on audit recording from Foundational and benefits from US2-US4 events.
- **Polish (Phase 8)**: Depends on all selected user stories.

### User Story Dependencies

- **US1**: No dependency on other stories after Foundational.
- **US2**: Depends on US1 for authenticated master context.
- **US3**: Depends on US1 for authenticated store-admin context; can be validated independently from US2 by seeded local users.
- **US4**: Depends on US1 for permission resolution and can be implemented before or after US2/US3.
- **US5**: Depends on audit events produced by US1-US4, but the audit query and UI can be built independently with seeded events.

### Parallel Opportunities

- T002-T004 can run in parallel.
- T007-T010 and T014-T015 can run in parallel after schema direction is understood.
- US1 tests T016-T018 can run in parallel before implementation.
- US2 tests and UI tasks marked `[P]` can run in parallel after user service contract is agreed.
- US3 tests T039-T041 can run in parallel with store-admin scope helper implementation T042.
- US4 profile API and web components marked `[P]` can run in parallel after permission catalog contract is stable.
- US5 tests and audit UI can run in parallel after audit event shape is stable.

---

## Parallel Example: User Story 1

```text
Task: T016 auth service unit tests
Task: T017 auth endpoint integration tests
Task: T018 login page web tests
Task: T024 login page implementation
Task: T025 store switcher implementation
```

## Parallel Example: User Story 4

```text
Task: T048 profile validation unit tests
Task: T049 profile endpoint integration tests
Task: T050 profile web tests
Task: T051 permission catalog service
Task: T055 access profile list UI
Task: T056 grouped permission selector UI
```

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Implement US1 for secure login, session management and authorized store context.
3. Validate US1 independently with active, inactive, single-store and multi-store users.
4. Add US2 so master can operate global user management.

### Incremental Delivery

1. Secure login and store context.
2. Master user maintenance across stores.
3. Store admin local user maintenance.
4. Access profiles and permission management.
5. Audit views and security hardening.

### Verification Discipline

- Write the listed tests before the corresponding implementation.
- Validate tenant isolation for every query and mutation.
- Validate permission checks server-side even when UI controls are hidden.
- Keep audit records append-only and redact all secret values.
- Update this task list as each task is completed.
