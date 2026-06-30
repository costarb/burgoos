# Data Model: Login e Gestao de Acessos por Loja

## User

Represents an administrative person who can authenticate into the system.

**Fields**:

- `id`: unique identifier
- `login`: unique login identifier, normally email
- `name`: display name
- `email`: contact email
- `phone`: optional contact phone
- `status`: `INVITED`, `ACTIVE`, `INACTIVE`, `LOCKED`
- `isMaster`: true when the user has global authority
- `passwordHash`: protected credential value, never exposed
- `lastLoginAt`: last successful login timestamp
- `createdAt`, `updatedAt`

**Validation rules**:

- `login` must be unique across the system.
- At least one active master user must remain.
- Inactive or locked users cannot authenticate.
- Password data cannot be returned by any contract.

**State transitions**:

- `INVITED` -> `ACTIVE` after first access completion
- `ACTIVE` -> `INACTIVE` when disabled by authorized user
- `ACTIVE` -> `LOCKED` when security policy blocks access
- `INACTIVE` -> `ACTIVE` when reactivated by authorized user

## Store

Represents a tenant/store that scopes operational data and local access.

**Fields**:

- `id`: unique identifier
- `name`: store name
- `slug`: public/admin-friendly identifier
- `status`: `ACTIVE`, `INACTIVE`
- `createdAt`, `updatedAt`

**Validation rules**:

- Store-scoped users, profiles and audit views must be filtered by authorized store access.
- Inactive stores cannot be selected as active context by non-master users.

## UserStoreAssignment

Links users to stores and defines whether the user can administer access in that store.

**Fields**:

- `id`: unique identifier
- `userId`: linked user
- `storeId`: linked store
- `profileId`: access profile for this store
- `canManageStoreAccess`: true when user is local store admin
- `status`: `ACTIVE`, `INACTIVE`
- `createdAt`, `updatedAt`

**Validation rules**:

- A non-master user must have at least one active assignment to authenticate into admin areas.
- Store admins can create or change assignments only for stores where they have active admin authority.
- Master users can create assignments for any store.

## AccessProfile

Represents a named group of permissions.

**Fields**:

- `id`: unique identifier
- `storeId`: optional store owner when the profile is local
- `name`: profile name
- `description`: optional business explanation
- `scope`: `GLOBAL`, `STORE`
- `status`: `ACTIVE`, `INACTIVE`
- `createdAt`, `updatedAt`

**Validation rules**:

- Active profile names must be unique within their scope.
- Profiles in use cannot be deleted; they can be inactivated only when users are moved or the operation is explicitly allowed without breaking access.
- Store admins can manage only store-scoped profiles for authorized stores.

## Permission

Represents a capability that can be granted through an access profile.

**Fields**:

- `id`: unique identifier
- `key`: stable permission key
- `area`: business area, such as Orders, Products, Finance or Access
- `screen`: user-facing screen
- `action`: `VIEW`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `MANAGE`
- `description`: business-readable description
- `sensitive`: marks critical permissions

**Validation rules**:

- Permission keys must be unique.
- Sensitive permissions must be explicit in profile review.
- Permission catalog is managed by product/system configuration, not ordinary store admins.

## AccessProfilePermission

Links an access profile to granted permissions.

**Fields**:

- `profileId`: linked access profile
- `permissionId`: linked permission
- `createdAt`

**Validation rules**:

- Duplicate permission grants in the same profile are not allowed.
- Profile permission changes must create audit events.

## SessionToken

Represents an active or revoked administrative session credential.

**Fields**:

- `id`: unique identifier
- `userId`: authenticated user
- `refreshTokenHash`: protected refresh token value
- `activeStoreId`: selected store context when applicable
- `status`: `ACTIVE`, `REVOKED`, `EXPIRED`
- `expiresAt`
- `createdAt`, `revokedAt`

**Validation rules**:

- Active store must be one of the user's authorized stores unless the user is master.
- Revoked or expired sessions cannot be refreshed.

## PasswordResetToken

Represents a first-access or password recovery token.

**Fields**:

- `id`: unique identifier
- `userId`: target user
- `purpose`: `FIRST_ACCESS`, `PASSWORD_RESET`
- `tokenHash`: protected token value
- `status`: `ACTIVE`, `USED`, `EXPIRED`
- `expiresAt`
- `createdAt`, `usedAt`

**Validation rules**:

- Tokens must expire.
- Used tokens cannot be reused.
- Public responses must not reveal whether a login exists.

## AccessAuditEvent

Represents an immutable record of access-related activity.

**Fields**:

- `id`: unique identifier
- `actorUserId`: user who performed the action, nullable for unauthenticated login failures
- `targetUserId`: affected user when applicable
- `storeId`: affected store when applicable
- `eventType`: `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `USER_CREATED`, `USER_UPDATED`, `USER_STATUS_CHANGED`, `PROFILE_CREATED`, `PROFILE_UPDATED`, `PERMISSIONS_CHANGED`, `STORE_ASSIGNMENT_CHANGED`, `ACCESS_DENIED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_CHANGED`
- `result`: `SUCCESS`, `DENIED`, `FAILED`
- `reason`: optional business reason
- `metadata`: non-sensitive contextual details
- `occurredAt`

**Validation rules**:

- Audit events are append-only.
- Audit views must be scoped: master sees all, store admins see events for authorized stores.
- Sensitive values such as passwords and raw tokens must never be stored in metadata.

## Relationships

- One `User` has many `UserStoreAssignment` records.
- One `Store` has many `UserStoreAssignment` records.
- One `UserStoreAssignment` references one `AccessProfile`.
- One `AccessProfile` has many `AccessProfilePermission` records.
- One `Permission` can be granted to many profiles.
- One `User` can have many `SessionToken` and `PasswordResetToken` records.
- One `AccessAuditEvent` can reference an actor user, a target user and a store.
