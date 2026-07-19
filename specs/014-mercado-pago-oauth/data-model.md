# Data Model: Conexao Mercado Pago Multiempresa

## Enums

### SalesProvider

- `PAGBANK`
- `MERCADO_PAGO`

### SalesIntegrationEnvironment

- `TEST`
- `PRODUCTION`

### SalesCredentialMode

- `PROVIDER_TOKEN` — compatibilidade PagBank
- `OAUTH`
- `FIXED_TOKEN`

### SalesIntegrationStatus

- Preservar `DRAFT`, `ACTIVE`, `PAUSED`, `REQUIRES_ATTENTION`, `DISABLED`.
- Acrescentar `PENDING_AUTHORIZATION`, `TOKEN_EXPIRING`, `REFRESHING`, `REAUTHORIZATION_REQUIRED` e `ERROR`.
- `ACTIVE` corresponde ao estado publico `CONNECTED`; `DISABLED` corresponde a `DISCONNECTED`, evitando migracao destrutiva de registros PagBank.

### SalesRunTrigger

- `MANUAL`
- `INITIAL_LOAD`
- `WEBHOOK`
- `RECONCILIATION_SHORT`
- `RECONCILIATION_DAILY`

### ProviderResourceType

- `PAYMENT`
- `ORDER`
- `CLAIM`
- `CHARGEBACK`

## SalesIntegration changes

| Field              | Type      | Rules                                        |
| ------------------ | --------- | -------------------------------------------- |
| environment        | enum      | Default `PRODUCTION`; part of uniqueness     |
| credentialMode     | enum      | Required; PagBank defaults `PROVIDER_TOKEN`  |
| providerUserId     | string?   | Mercado Pago account ID, discovered remotely |
| tokenExpiresAt     | datetime? | OAuth only; safe for frontend                |
| scopes             | JSON      | OAuth scope names, no secret                 |
| connectedAt        | datetime? | Set after validated credential               |
| lastSyncAt         | datetime? | Last successful sync                         |
| disconnectedAt     | datetime? | Set on disconnect                            |
| operationLockOwner | string?   | Opaque worker instance ID                    |
| operationLockUntil | datetime? | Lease expiration                             |

**Constraints**:

- Unique `(tenantId, provider, channel, environment)`.
- Unique `(provider, providerUserId, environment)` when providerUserId is non-null.
- `ACTIVE` requires providerUserId and active credential for Mercado Pago.
- OAuth requires tokenExpiresAt and refresh material; fixed token does not.
- Tenant ID is never accepted from request payload.

## SalesIntegrationCredential changes

`secretCiphertext` becomes an encrypted, versioned envelope. Existing PagBank data stays encrypted in the same column.

```text
PagBank: { version, ediToken }
MercadoPago OAuth: { version, accessToken, refreshToken }
MercadoPago Fixed: { version, accessToken }
```

Add safe fields `expiresAt`, `scopes`, `validatedProviderUserId` and `validationStatus` only when useful for queries. Never store token prefix or suffix outside ciphertext. Rotation remains atomic and one credential is active per integration.

## OAuthAuthorizationAttempt

| Field                  | Type      | Rules                                                    |
| ---------------------- | --------- | -------------------------------------------------------- |
| id                     | UUID      | Primary key                                              |
| tenantId               | UUID      | Required                                                 |
| integrationId          | UUID      | Required; Mercado Pago                                   |
| requestedByUserId      | UUID      | Required admin actor                                     |
| environment            | enum      | Required                                                 |
| initialLoadDays        | int       | `30`, `60` ou `90`; default `30`                         |
| stateHash              | string    | Unique SHA-256 hash                                      |
| codeVerifierCiphertext | text      | Encrypted                                                |
| status                 | enum      | `PENDING`, `CONSUMING`, `COMPLETED`, `EXPIRED`, `FAILED` |
| expiresAt              | datetime  | At most createdAt + 10 minutes                           |
| consumedAt             | datetime? | Set on one-time claim                                    |
| errorCode              | string?   | Safe category                                            |
| createdAt/updatedAt    | datetime  | Audit                                                    |

**Transitions**:

```text
PENDING -> CONSUMING -> COMPLETED
PENDING -> EXPIRED
PENDING/CONSUMING -> FAILED
```

Only one live attempt per integration. Callback claims `PENDING` atomically when hash matches and time remains.

## ProviderTransactionState

Mutable canonical state for resources observed by search, webhook or reconciliation.

| Field                                                  | Type      | Rules                               |
| ------------------------------------------------------ | --------- | ----------------------------------- |
| id                                                     | UUID      | Primary key                         |
| tenantId                                               | UUID      | Required                            |
| integrationId                                          | UUID      | Required                            |
| provider                                               | enum      | Required                            |
| resourceType                                           | enum      | Payment, order, claim or chargeback |
| providerResourceId                                     | string    | Required                            |
| externalSaleId                                         | string?   | Normalized sale identity            |
| status/statusDetail                                    | string    | Provider state                      |
| grossAmount/feeAmount/netAmount                        | decimal?  | 12,2                                |
| createdAtProvider/approvedAtProvider/updatedAtProvider | datetime? | Provider timestamps                 |
| normalizedData                                         | JSON      | Safe typed snapshot                 |
| rawPayload                                             | JSON      | Redacted source                     |
| lastSynchronizedAt                                     | datetime  | Required                            |
| orderId                                                | UUID?     | Existing imported order             |
| attentionRequired                                      | boolean   | Default false                       |
| createdAt/updatedAt                                    | datetime  | Audit                               |

**Constraints**: Unique `(integrationId, resourceType, providerResourceId)`; all reads include tenantId. Updating this entity never automatically changes an order.

## ProviderNotification

| Field                  | Type      | Rules                                                      |
| ---------------------- | --------- | ---------------------------------------------------------- |
| id                     | UUID      | Primary key                                                |
| tenantId               | UUID?     | Null until account resolution; required before processing  |
| integrationId          | UUID?     | Resolved connection                                        |
| provider               | enum      | Mercado Pago                                               |
| environment            | enum      | Derived from endpoint and `live_mode`                      |
| eventKey               | string    | Unique idempotency hash                                    |
| providerEventId        | string?   | Notification ID                                            |
| providerUserId         | string?   | Account from notification                                  |
| resourceType           | enum      | Parsed topic                                               |
| providerResourceId     | string    | Required                                                   |
| action                 | string?   | Provider action                                            |
| signatureStatus        | enum      | `VALID`, `INVALID`                                         |
| status                 | enum      | `RECEIVED`, `PROCESSING`, `PROCESSED`, `IGNORED`, `FAILED` |
| attempts               | int       | At least zero                                              |
| nextAttemptAt          | datetime? | Retry scheduling                                           |
| payload                | JSON      | Redacted minimal notification                              |
| receivedAt/processedAt | datetime  | Audit                                                      |

**Constraints**: Unique `(provider, environment, eventKey)`. Invalid signatures may be counted as security events without retaining arbitrary bodies.

## IntegrationAuditEvent

| Field         | Type     | Rules                                             |
| ------------- | -------- | ------------------------------------------------- |
| id            | UUID     | Primary key                                       |
| tenantId      | UUID     | Required                                          |
| integrationId | UUID     | Required                                          |
| actorUserId   | UUID?    | Null for scheduler or webhook                     |
| action        | string   | Connect, rotate, refresh, sync, disconnect, error |
| outcome       | string   | Success, failure or safe code                     |
| metadata      | JSON     | Allowlisted fields only                           |
| createdAt     | datetime | Immutable                                         |

## SalesImportRun changes

- Add `trigger` (`MANUAL` default for existing rows).
- `requestedByUserId` becomes nullable for system runs; manual and initial load still require actor.
- Keep start and end dates and common states.
- Mercado Pago creates `SalesImportDay` evidence per calendar day while fetching by range, distributing counts after normalization. This preserves current UI/history without forcing one remote request per day.

## ExternalSalesMovement and ExternalSaleIdentity changes

- Add optional `providerTransactionStateId` to movement.
- Add `integrationId` and `environment` to `ExternalSaleIdentity`.
- Replace uniqueness with `(tenantId, provider, environment, externalSaleId)`; connection ID remains an indexed consistency check.
- Existing PagBank identities migrate to `PRODUCTION` and their originating integration when resolvable.

## Retention

- Connections, active credential metadata, canonical transaction state, identity and audit: retained while tenant or order exists under product policy.
- OAuth attempts: purge verifier ciphertext immediately after terminal state; delete metadata after 30 days.
- Valid processed webhook payloads: 90 days; idempotency key may be retained longer.
- Runs and movements: existing 180-day policy; identity and canonical state survive cleanup.

## PlatformIntegrationConfiguration

Uma linha global por provider armazena um documento de configuração cifrado, datas de alteração e o usuário de plataforma responsável. Para Mercado Pago, o documento contém Client ID, Client Secret, Webhook Secret, redirect URI e URL pós-callback. Respostas administrativas exibem apenas flags de preenchimento e URLs não secretas.
