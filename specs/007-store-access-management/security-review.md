# Security Review: Login e Gestao de Acessos por Loja

Date: 2026-06-10
Branch: `007-store-access-management`

## Tenant Isolation

- Admin sessions carry `allowedStoreIds`, `manageableStoreIds` and `activeStoreId`.
- Store-admin user-management helpers reject assignments outside the actor's manageable stores.
- Access audit queries restrict non-master actors to `manageableStoreIds`.
- Profile management allows store admins to manage only store-scoped profiles for authorized stores.

Residual risk: web controls must remain secondary only; API guards and services are the authority.

## Credential Secrecy

- Passwords are stored as hashes and are never returned by API contracts.
- Refresh/session tokens are persisted through token-hash helpers.
- Password reset accepts requests without exposing account existence.
- Audit metadata redacts keys matching password, token, secret or hash.

Residual risk: production logging must avoid dumping request bodies for auth endpoints.

## Token Revocation

- Refresh tokens are checked against active session records before refresh, logout and store switch.
- Logout revokes the current refresh token.
- Revoked or expired refresh tokens fail refresh.

Residual risk: access tokens remain valid until their short expiry; this is accepted for the current JWT model.

## Last Master Protection

- Master removal and deactivation call `assertCanRemoveMaster`.
- The rule blocks changes that would leave zero active master users.
- Unit tests cover the single-master and multi-master cases.

Residual risk: direct database edits bypass application rules and must stay out of operational workflows.

## Audit Integrity

- Audit writes are append-only through `AccessAuditService.record`.
- Login failure, login success, logout, password changes, user maintenance, profile changes and access denial paths record access events.
- Audit read paths redact sensitive metadata again before returning results.

Residual risk: database-level immutability constraints are not yet enforced; application code is currently the integrity boundary.
