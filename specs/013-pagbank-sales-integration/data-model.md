# Data Model: Integracao de Vendas PagBank

## Enums

### SalesProvider

- `PAGBANK`
- Futuro: `MERCADO_PAGO`

### SalesInputChannel

- `API`
- `FILE`
- `OTHER`

### SalesIntegrationStatus

- `DRAFT`
- `ACTIVE`
- `PAUSED`
- `REQUIRES_ATTENTION`
- `DISABLED`

### SalesCredentialStatus

- `ACTIVE`
- `ROTATED`
- `REVOKED`

### SalesImportRunStatus

- `PENDING`
- `FETCHING`
- `PREVIEW_READY`
- `PARTIALLY_READY`
- `IMPORTING`
- `COMPLETED`
- `COMPLETED_WITH_ERRORS`
- `FAILED`
- `CANCELLED`

### SalesImportDayStatus

- `PENDING`
- `FETCHING`
- `READY`
- `BLOCKED_NOT_VALIDATED`
- `BLOCKED_DATE`
- `FAILED`

### ExternalMovementKind

- `SALE`
- `NON_SALE`
- `UNKNOWN`

### ExternalMovementStatus

- `NEW`
- `DUPLICATE`
- `REJECTED`
- `IMPORTING`
- `IMPORTED`
- `FAILED`

## SalesIntegration

Configuracao tenant-scoped de um provider de vendas.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID | Required; FK Tenant; never accepted from request body |
| provider | SalesProvider | Required |
| channel | SalesInputChannel | `API` for PagBank |
| status | SalesIntegrationStatus | Default `DRAFT` |
| displayName | string | 1..100 |
| externalMerchantId | string | PagBank USER; required before activation |
| settings | JSON | Non-secret provider settings, validated by adapter |
| lastValidationAt | datetime? | Last controlled validation |
| lastErrorCode | string? | Safe internal/provider category |
| lastErrorMessage | string? | Redacted, max 500 |
| createdByUserId | UUID? | Actor audit |
| updatedByUserId | UUID? | Actor audit |
| createdAt/updatedAt | datetime | Managed timestamps |

**Constraints**:

- Unique `(tenantId, provider, channel)`.
- All queries include authenticated `tenantId`.
- `ACTIVE` requires external merchant ID and one active credential.

## SalesIntegrationCredential

Versioned encrypted credential for a sales integration.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID | Required; same tenant as integration |
| integrationId | UUID | FK SalesIntegration |
| status | SalesCredentialStatus | One `ACTIVE` per integration |
| credentialType | string | `PAGBANK_EDI_TOKEN` initially |
| secretCiphertext | string | AES-256-GCM authenticated ciphertext |
| fingerprint | string | Non-reversible short hash for operational comparison |
| createdByUserId | UUID? | Actor audit |
| rotatedAt | datetime? | Set when replaced |
| createdAt | datetime | Managed timestamp |

**Constraints**:

- Secret is write-only at API boundary.
- Rotation marks previous active credential `ROTATED` in the same transaction.

## SalesImportRun

Persisted preview/import execution.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key and confirmation token |
| tenantId | UUID | Required |
| integrationId | UUID | FK SalesIntegration |
| provider | SalesProvider | Snapshot |
| channel | SalesInputChannel | Snapshot |
| requestedByUserId | UUID | Required actor |
| startDate/endDate | date | Inclusive; start <= end; maximum 31 days |
| status | SalesImportRunStatus | State machine below |
| strategy | HistoricalOrderImportStrategy | `PRICE_WEIGHTED` or `FIXED_PRODUCT` |
| fixedProductId | UUID? | Required only for fixed product strategy |
| counts | JSON | found/new/duplicate/rejected/imported/failed/blockedDays |
| startedAt/completedAt | datetime? | Processing timestamps |
| errorCode/errorMessage | string? | Safe failure detail |
| createdAt/updatedAt | datetime | Managed timestamps |

**Indexes**: `(tenantId, createdAt desc)`, `(tenantId, integrationId, status)`, `(tenantId, provider, startDate, endDate)`.

**State transitions**:

```text
PENDING -> FETCHING -> PREVIEW_READY -> IMPORTING -> COMPLETED
                    -> PARTIALLY_READY -> IMPORTING -> COMPLETED_WITH_ERRORS
PENDING/FETCHING/IMPORTING -> FAILED
PENDING/PREVIEW_READY/PARTIALLY_READY -> CANCELLED
```

Only `PREVIEW_READY` and `PARTIALLY_READY` accept confirmation. Confirmation is idempotent.

## SalesImportDay

Per-day completeness and pagination evidence.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID | Required |
| runId | UUID | FK SalesImportRun |
| movementDate | date | One row per run/date |
| status | SalesImportDayStatus | Required |
| validated | boolean? | Exact interpretation of provider header |
| pagesFetched | int | >= 0 |
| totalPages | int? | >= pagesFetched when known |
| totalElements | int? | >= 0 |
| errorCode/errorMessage | string? | Redacted |
| startedAt/completedAt | datetime? | Audit |

**Constraints**: Unique `(runId, movementDate)`; tenant must match run.

## ExternalSalesMovement

Immutable external movement and normalized preview item.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID | Required |
| runId | UUID | FK SalesImportRun |
| dayId | UUID | FK SalesImportDay |
| integrationId | UUID | FK SalesIntegration |
| provider | SalesProvider | Required |
| channel | SalesInputChannel | Required |
| providerMovementId | string | `movimento_api_codigo` when present |
| externalSaleId | string? | Stable sale identity, normally `codigo_transacao` |
| externalEventCode | string? | PagBank event code |
| kind | ExternalMovementKind | SALE/NON_SALE/UNKNOWN |
| status | ExternalMovementStatus | Classification/import state |
| occurredAt | datetime? | Sale date/time |
| grossAmount/netAmount/feeAmount | decimal? | Precision 12,2; non-negative for SALE |
| paymentMethod | PaymentMethod? | Normalized existing enum |
| installments | int? | >= 1 when supplied |
| normalizedData | JSON? | Typed normalized snapshot |
| rawPayload | JSON | Redacted provider record |
| rejectionCode/rejectionMessage | string? | Actionable reason |
| orderId | UUID? | FK Order after import |
| importedAt | datetime? | Set with order link |
| createdAt/updatedAt | datetime | Managed timestamps |

**Constraints**:

- Unique `(runId, providerMovementId)` prevents duplicate page data in one preview.
- Partial unique business rule `(tenantId, provider, externalSaleId)` applies when an identity has been claimed/imported. Implementation may use a dedicated `ExternalSaleIdentity` table if Prisma cannot express the required partial index portably.
- A `SALE` eligible for import requires externalSaleId, occurredAt, positive gross amount and recognized payment method.
- `IMPORTED` requires orderId and importedAt.

## ExternalSaleIdentity

Minimal durable idempotency record retained after raw movement cleanup.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID | Required |
| provider | SalesProvider | Required |
| externalSaleId | string | Stable provider identifier |
| firstChannel | SalesInputChannel | Audit of first ingestion |
| orderId | UUID? | Existing/imported order |
| firstSeenAt | datetime | Required |
| importedAt | datetime? | Set when linked |

**Constraints**: Unique `(tenantId, provider, externalSaleId)`; this is the concurrency-safe idempotency boundary for both API and CSV.

## Existing Order changes

- Keep `externalPaymentId` populated with normalized external sale ID.
- Add optional relation from `ExternalSaleIdentity.orderId` rather than adding provider-specific columns to Order.
- Existing payment institution, gross, fee, net, brand and expected release fields continue to receive normalized values.
- Historical import remains `DELIVERED`, uses existing item snapshots and creates profitability snapshot in the same transaction.

## Retention

- `SalesIntegration`, active identity and order link: retained while tenant/order exists.
- Runs, days, raw payload and normalized snapshots: 180 days by default, then eligible for cleanup.
- Cleanup must not remove `ExternalSaleIdentity`, ensuring idempotency after payload expiration.
