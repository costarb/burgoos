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
