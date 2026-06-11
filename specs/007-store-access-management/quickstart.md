# Quickstart: Login e Gestao de Acessos por Loja

## Goal

Validate that master users control all stores while store admins manage access only inside their authorized store.

## Prerequisites

- Database has at least two stores: Store A and Store B.
- One active master user exists.
- One store admin user exists for Store A.
- Permission catalog includes at least user maintenance, profile maintenance and audit view permissions.

## Seed Data Plan

- Create or reuse a master administrative user with global access and an active status.
- Create Store A and Store B when they do not already exist in the local database.
- Create a Store A admin user with `canManageStoreAccess` enabled only for Store A.
- Create baseline profiles for master, store admin and operational user using the permission catalog.
- Seed operations must be non-destructive and must not overwrite existing pilot tenant data.

## Scenario 1: Master creates a store user

1. Sign in as the master user.
2. Open the user maintenance screen.
3. Create a new user with Store A assignment and a non-master profile.
4. Complete first access for the new user.
5. Sign in as the new user.
6. Confirm the user can access only Store A and only the permissions from the assigned profile.

**Expected result**: The user is created, can authenticate, sees Store A context, and cannot access Store B.

## Scenario 2: Store admin manages only local users

1. Sign in as the Store A admin.
2. Open user maintenance.
3. Confirm only Store A users are listed.
4. Create another user assigned to Store A.
5. Attempt to assign Store B or view Store B users.

**Expected result**: Store A operations succeed; Store B access is denied and audited.

## Scenario 3: Master manages profiles

1. Sign in as the master user.
2. Open access profile maintenance.
3. Create a profile with permissions for one operational area.
4. Assign the profile to a Store A user.
5. Sign in as that user and verify visible menus and allowed actions.

**Expected result**: Permissions from the profile control visible screens and server-authorized actions.

## Scenario 4: Last master protection

1. Sign in as the only active master user.
2. Attempt to deactivate the same master account or remove its master authority.

**Expected result**: The system blocks the change and explains that at least one active master must remain.

## Scenario 5: Audit access events

1. Sign in as master and change a user's profile.
2. Sign in as Store A admin and attempt an unauthorized Store B action.
3. Open access audit as master.
4. Open access audit as Store A admin.

**Expected result**: Master sees all relevant audit events. Store A admin sees only events in Store A scope. No passwords or raw tokens appear in audit details.

## Suggested Verification

- Unit tests for permission resolution, last-master rule and token state transitions.
- Integration tests for user/profile mutations and cross-tenant denial.
- E2E tests for login, store switcher, user creation by master and local admin denial outside scope.

## Validation Evidence

Recorded on 2026-06-10 for branch `007-store-access-management`.

### Store Admin Scope

- Covered by `apps/api/src/management/access/users/store-admin-user-rules.spec.ts`.
- Covered by `apps/api/test/access-users-store-admin.integration.spec.ts`.
- Validated that store admins can manage assignments only for stores in `manageableStoreIds`.
- Validated that store admins cannot change master users or users assigned only to another store.
- Cross-tenant denial is recorded through `UsersService.recordAccessDenied()` with `ACCESS_DENIED` and `DENIED` result.

### Master User Maintenance

- Covered by `apps/api/src/management/access/users/user-access-rules.spec.ts`.
- Covered by `apps/api/test/access-users-master.integration.spec.ts`.
- Validated master-scoped filters, user creation with store assignment and duplicate login/last-active-master protections.
- Last master protection blocks deactivation or master removal when only one active master remains.

### Audit Scenarios

- Covered by `apps/api/src/management/access/access-audit.service.spec.ts`.
- Covered by `apps/api/test/access-audit.integration.spec.ts`.
- Validated metadata redaction for password/token/hash fields during audit writes and reads.
- Validated that master audit queries are unrestricted by local store scope.
- Validated that store-admin audit queries carry `manageableStoreIds` and require bearer authentication.

### Profile Scenarios

- Covered by `apps/api/src/management/access/profiles/access-profiles.service.spec.ts`.
- Covered by `apps/api/test/access-profiles.integration.spec.ts`.
- Validated profile name uniqueness, store-admin scope denial, permission catalog upsert, duplication with grants and conflict when inactivating a profile used by active assignments.

### Automated Command Evidence

- `npm.cmd run test --workspace apps/api -- auth access`: 10 files passed, 40 tests passed.
- `npm.cmd run test --workspace apps/web -- login-page users-page access-profiles-page access-audit-page`: 4 files passed, 6 tests passed.
- `npm.cmd run typecheck --workspace apps/api`: passed.

### Web Screen Evidence

- Covered by `apps/web/app/login/login-page.spec.tsx`.
- Covered by `apps/web/app/admin/users/users-page.spec.tsx`.
- Covered by `apps/web/app/admin/access-profiles/access-profiles-page.spec.tsx`.
- Covered by `apps/web/app/admin/access-audit/access-audit-page.spec.tsx`.
- Validated login first/error/success states, users page forms and filters, profile permission grouping/actions and audit filters/results.

### Performance Evidence

- Focused auth/access API test suite completed in about 21 seconds in the local Vitest environment.
- Individual auth integration scenarios completed under 4 seconds total for four HTTP flows in the mocked Nest test server.
- The implemented list endpoints apply bounded queries and scoped filters; audit queries are capped at 200 rows.
