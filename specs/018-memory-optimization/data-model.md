# Data Model: Controle de Memória e Processamento em Segundo Plano

## BackgroundJob

Representa a orquestração durável de um trabalho existente, sem copiar o payload de negócio.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID nullable | Required for tenant-owned work; indexed and related to Tenant |
| type | enum | EXPORT, SALES_IMPORT_PREVIEW, SALES_IMPORT_CONFIRM, PROVIDER_WEBHOOK, PAYMENT_WEBHOOK, IFOOD_POLL, MP_RECONCILIATION, MP_TOKEN_REFRESH, POINT_RECONCILIATION, RETENTION |
| priority | enum | CRITICAL, HIGH, NORMAL, LOW |
| status | enum | PENDING, RUNNING, RETRY_WAIT, SUCCEEDED, FAILED, CANCELLED |
| targetType | string | Domain model name; allowlisted per handler |
| targetId | string | Domain identifier, integration identifier or bounded scheduler scope |
| activeKey | string nullable | Deterministic dedupe key; unique while job is active |
| payload | JSON | Small validated routing metadata only; no credentials or provider body |
| attempts | integer | Starts at 0; incremented on claim |
| maxAttempts | integer | Positive, handler default with bounded override |
| availableAt | timestamp | Earliest claim time |
| leasedBy | string nullable | Instance identifier |
| leaseExpiresAt | timestamp nullable | Must be in future while RUNNING |
| leaseVersion | integer | Starts at 0 and increments on every successful claim/recovery |
| heartbeatAt | timestamp nullable | Last ownership renewal |
| progressCurrent | integer nullable | Non-negative |
| progressTotal | integer nullable | Null when unknown; not smaller than current |
| progressMessage | string nullable | Safe short operational description |
| startedAt | timestamp nullable | First successful claim |
| completedAt | timestamp nullable | Terminal completion time |
| lastErrorCode | string nullable | Stable safe code |
| lastErrorMessage | string nullable | Redacted, bounded text |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last change |

### Indexes and constraints

- Claim index: `(status, availableAt, priority, createdAt)`.
- Tenant fairness index: `(tenantId, status, createdAt)`.
- Target lookup: `(targetType, targetId, createdAt)`.
- Active dedupe is enforced using a partial unique database index on `activeKey` for `PENDING`, `RUNNING`, and `RETRY_WAIT`.
- Tenant-owned target handlers reject null `tenantId`.
- `payload` has an application-level size limit of 16 KiB.

### State transitions

```text
PENDING -> RUNNING -> SUCCEEDED
                  -> RETRY_WAIT -> RUNNING
                  -> FAILED
                  -> CANCELLED
PENDING/RETRY_WAIT -> CANCELLED
RUNNING with expired lease -> RETRY_WAIT or FAILED
```

Only the lease owner may heartbeat, report progress or finish `RUNNING`. Completion and retry compare `leasedBy` and `leaseVersion` to prevent a stale worker from overwriting a recovered execution.

## BackgroundJobAttempt

Bounded execution history used for diagnosis without storing business payload.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| jobId | UUID | Cascade relation to BackgroundJob |
| attempt | integer | Unique with jobId |
| workerId | string | Instance identifier |
| startedAt | timestamp | Required |
| finishedAt | timestamp nullable | Set on completion/failure/lease recovery |
| outcome | enum | RUNNING, SUCCEEDED, RETRY, FAILED, ABANDONED, CANCELLED |
| durationMs | integer nullable | Non-negative |
| processedCount | integer nullable | Non-negative |
| errorCode | string nullable | Redacted stable code |
| memoryStart | JSON nullable | rss/heap/external/arrayBuffers numeric snapshot |
| memoryEnd | JSON nullable | Same bounded shape |

Retention keeps attempt history for 30 days after terminal job state. Generated export objects and their downloadable metadata expire after seven days by default, configurable by environment.

## ExportJob changes

| Field | Change |
|---|---|
| backgroundJobId | Optional unique UUID relation during migration; required for newly queued exports after rollout |
| fingerprint | Hash of tenant, user, context, format, filters and columns; indexed |
| processedRows | Non-negative progress count |
| totalRows | Nullable estimated/known total |
| storageProvider | LOCAL or OBJECT_STORAGE |

Existing `status` remains the user-facing state. Mapping: background PENDING/RETRY_WAIT -> export PENDING; RUNNING -> PROCESSING; SUCCEEDED -> COMPLETED; terminal error -> FAILED.

## Existing domain models

- **SalesImportRun**: referenced by preview/confirmation jobs. Its domain state remains authoritative.
- **ProviderNotification** and payment provider event: persist webhook receipt before enqueue; unique provider key preserves idempotency.
- **DeliveryIntegration**: referenced by iFood and credential jobs; existing operation lock can coexist until migration completes.
- **DeliveryPlatformEvent**: events remain ordered and processed sequentially inside one integration job.
- **PaymentCharge**: Point job claims targeted stale charges in bounded pages; payment idempotency remains unchanged.
- **OperationalNotification**: no schema change required for summary/delta queries; `(tenantId, recipientUserId, status, createdAt)` already supports count and recent reads.

## Non-persisted models

### ResourcePolicy

Validated configuration per job type: enabled roles, batch size, concurrency, lease duration, max attempts, retry bounds, priority and memory admission class. Defaults are versioned in code and overridable by environment.

### ResourceMeasurement

Structured telemetry containing timestamp, role, instance, rss, heap used/total, external, array buffers, event-loop lag, active job counts and optional safe correlation identifiers. Emitted to metrics/logs, not the transactional database.

### PollingSubscription

Client-only state: key, visible/hidden interval, failure count, request-in-flight flag, last version, abort signal and next allowed refresh. It is destroyed with the component.

## Tenant isolation

- Admin job status joins both `tenantId` and authenticated user/domain ownership.
- Workers resolve tenant from the persisted job, never from untrusted payload alone.
- Global maintenance jobs may use null `tenantId` but handlers cannot read tenant data without iterating explicit scoped units.
- Dedupe keys include tenant for tenant-owned work.
