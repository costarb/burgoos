# Data Model: iFood Delivery Integration

## Overview

The feature adds a provider-neutral integration layer around the existing ordering workflow. The existing `Tenant`, `Order`, `OrderItem`, and `OrderPlatform` models remain the operational backbone. New entities track store integration configuration, protected credentials, inbound events, external order linkage, outbound synchronization, deadlines, cancellation reasons, disputes, and audit/health state.

## Enums

### DeliveryProvider

- `IFOOD`
- Future values: `RAPPI`, `UBER_EATS`, `CUSTOM`

### DeliveryIntegrationStatus

- `DRAFT`: configuration exists but is incomplete
- `VALIDATING`: credentials or merchant access are being checked
- `ACTIVE`: integration can ingest orders
- `PAUSED`: integration is intentionally stopped without deleting credentials
- `REQUIRES_ATTENTION`: token, permission, merchant status, or homologation issue blocks normal flow
- `DISABLED`: integration cannot ingest orders and should not poll

### CredentialStatus

- `ACTIVE`
- `EXPIRED`
- `REVOKED`
- `ROTATED`
- `REQUIRES_REAUTHORIZATION`

### PlatformEventStatus

- `RECEIVED`
- `PROCESSING`
- `PROCESSED`
- `IGNORED`
- `FAILED`
- `ACK_PENDING`
- `ACKED`

### SyncAttemptStatus

- `PENDING`
- `SENT`
- `CONFIRMED`
- `FAILED`
- `RETRYABLE`
- `CANCELLED`

### PlatformOrderAction

- `CONFIRM`
- `REFUSE`
- `START_PREPARATION`
- `READY_TO_PICKUP`
- `DISPATCH`
- `DELIVER`
- `REQUEST_CANCELLATION`
- `RESPOND_DISPUTE`

### PlatformOrderMode

- `DELIVERY`
- `MERCHANT_DELIVERY`
- `TAKEOUT`
- `DINE_IN`

### PlatformOrderTiming

- `IMMEDIATE`
- `SCHEDULED`

### IntegrationAuditAction

- `CONFIG_CREATED`
- `CONFIG_UPDATED`
- `CONFIG_ACTIVATED`
- `CONFIG_PAUSED`
- `CONFIG_DISABLED`
- `CREDENTIAL_ROTATED`
- `VALIDATION_RUN`
- `EVENT_RECEIVED`
- `EVENT_PROCESSED`
- `EVENT_ACKED`
- `ORDER_CREATED`
- `ORDER_UPDATED`
- `SYNC_ATTEMPTED`
- `SYNC_FAILED`
- `DEADLINE_ALERTED`
- `DISPUTE_RECEIVED`

## Entities

### DeliveryIntegration

Store-scoped configuration for a delivery provider.

Fields:

- `id`: UUID
- `tenantId`: UUID, required, references `Tenant`
- `provider`: `DeliveryProvider`, required
- `orderPlatformId`: UUID, required, references `OrderPlatform`
- `status`: `DeliveryIntegrationStatus`, required
- `displayName`: string, required
- `externalMerchantId`: string, nullable until validation
- `pollingEnabled`: boolean, default true for iFood first release
- `webhookEnabled`: boolean, default false
- `lastValidationAt`: datetime, nullable
- `lastSuccessfulPollingAt`: datetime, nullable
- `lastErrorAt`: datetime, nullable
- `lastErrorCode`: string, nullable
- `lastErrorMessage`: string, nullable
- `homologationStatus`: string, required, values should cover pending, ready, approved, failed
- `createdByUserId`: UUID, nullable, references `User`
- `updatedByUserId`: UUID, nullable, references `User`
- `createdAt`: datetime
- `updatedAt`: datetime

Rules:

- Unique by `tenantId` and `provider`.
- Must not be `ACTIVE` without at least one active credential and external merchant validation.
- Pausing preserves credentials and history.

### DeliveryIntegrationCredential

Protected credential state for one integration. Secret values are encrypted or hashed as appropriate and never returned in API responses.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, required, references `DeliveryIntegration`
- `status`: `CredentialStatus`, required
- `credentialType`: string, required, for example client credentials, access token, refresh token
- `secretCiphertext`: text, required
- `tokenExpiresAt`: datetime, nullable
- `refreshExpiresAt`: datetime, nullable
- `scopes`: string array or JSON, nullable
- `metadata`: JSON, nullable
- `createdByUserId`: UUID, nullable
- `rotatedAt`: datetime, nullable
- `createdAt`: datetime

Rules:

- Only one active credential bundle per integration should be used for outbound calls.
- Token expiration must be calculated from provider metadata, not fixed constants.
- Historical rotated credentials remain for audit but cannot be used.

### DeliveryPlatformEvent

Durable inbound provider event.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, required
- `provider`: `DeliveryProvider`, required
- `externalEventId`: string, required
- `externalOrderId`: string, nullable
- `eventCode`: string, required
- `fullEventCode`: string, nullable
- `status`: `PlatformEventStatus`, required
- `receivedAt`: datetime
- `providerCreatedAt`: datetime, nullable
- `processingStartedAt`: datetime, nullable
- `processedAt`: datetime, nullable
- `acknowledgedAt`: datetime, nullable
- `retryCount`: integer, default 0
- `nextRetryAt`: datetime, nullable
- `payload`: JSON, required
- `normalizedSummary`: JSON, nullable
- `errorMessage`: string, nullable

Rules:

- Unique by `provider` and `externalEventId`.
- Repeated events must reuse the existing row and not duplicate orders.
- ACK is allowed only after status is `PROCESSED` or `IGNORED`.

### PlatformOrderLink

Relationship between an internal order and an external platform order.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, required
- `orderId`: UUID, required, references `Order`
- `orderPlatformId`: UUID, required, references `OrderPlatform`
- `provider`: `DeliveryProvider`, required
- `externalMerchantId`: string, required
- `externalOrderId`: string, required
- `mode`: `PlatformOrderMode`, required
- `timing`: `PlatformOrderTiming`, required
- `externalStatus`: string, required
- `internalStatusAtLastSync`: string, nullable
- `confirmationDeadlineAt`: datetime, nullable
- `preparationStartAt`: datetime, nullable
- `deliveryTrackingAvailable`: boolean, default false
- `rawOrderSnapshot`: JSON, required
- `lastProviderUpdateAt`: datetime, nullable
- `createdAt`: datetime
- `updatedAt`: datetime

Rules:

- Unique by `provider`, `externalMerchantId`, and `externalOrderId`.
- Must share `tenantId` with the linked `Order`.
- `confirmationDeadlineAt` is required while the order is pending confirmation.

### PlatformSyncAttempt

Outbound communication attempt from BurgoOS to the delivery platform.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, required
- `platformOrderLinkId`: UUID, nullable
- `action`: `PlatformOrderAction`, required
- `status`: `SyncAttemptStatus`, required
- `requestPayload`: JSON, nullable
- `responsePayload`: JSON, nullable
- `providerStatusCode`: integer, nullable
- `errorCode`: string, nullable
- `errorMessage`: string, nullable
- `attemptNumber`: integer, required
- `nextRetryAt`: datetime, nullable
- `createdByUserId`: UUID, nullable
- `sentAt`: datetime, nullable
- `confirmedAt`: datetime, nullable
- `createdAt`: datetime

Rules:

- Recoverable failures move to `RETRYABLE` with `nextRetryAt`.
- Non-recoverable provider rejections must create a visible operator exception.

### PlatformCancellationReason

Cached provider-approved cancellation or refusal reason.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, required
- `providerReasonId`: string, required
- `description`: string, required
- `applicableActions`: string array or JSON, required
- `active`: boolean, default true
- `lastSyncedAt`: datetime

Rules:

- Cancellation/refusal requests must reference an active provider reason when required by the provider.

### PlatformDispute

Post-delivery dispute, negotiation, or refund proposal initiated by provider/customer.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, required
- `platformOrderLinkId`: UUID, required
- `externalDisputeId`: string, required
- `status`: string, required
- `proposal`: JSON, required
- `response`: JSON, nullable
- `expiresAt`: datetime, required
- `respondedAt`: datetime, nullable
- `createdAt`: datetime
- `updatedAt`: datetime

Rules:

- Must be visible as pending action until responded or expired.
- Response must create a `PlatformSyncAttempt`.

### DeliveryIntegrationAudit

Immutable audit trail for configuration, event, order, and sync operations.

Fields:

- `id`: UUID
- `tenantId`: UUID, required
- `integrationId`: UUID, nullable
- `actorUserId`: UUID, nullable
- `action`: `IntegrationAuditAction`, required
- `entityType`: string, required
- `entityId`: UUID or string, nullable
- `result`: string, required
- `metadata`: JSON, nullable
- `createdAt`: datetime

Rules:

- No updates or deletes after insert.
- Must avoid storing secrets in metadata.

## Existing Model Changes

### Order

Add or confirm fields needed for external orders:

- `orderPlatformId`: already exists and should point to the iFood `OrderPlatform`.
- `externalPaymentId`: can store external payment identifier when applicable.
- Add nullable `sourceChannel` or rely on `orderPlatformId` plus `PlatformOrderLink`.
- Customer phone may need to be nullable or normalized for platform orders if iFood omits it; if keeping non-null, use a documented placeholder and preserve raw payload in `PlatformOrderLink`.

### OrderItem

Existing item snapshots should continue to represent kitchen-facing items. iFood options/complements should be flattened into notes or represented in a JSON metadata field if detailed reporting is required.

## Relationships

- `Tenant` has many `DeliveryIntegration`, `DeliveryPlatformEvent`, `PlatformOrderLink`, `PlatformSyncAttempt`, `PlatformDispute`, `DeliveryIntegrationAudit`.
- `DeliveryIntegration` belongs to one `Tenant` and one `OrderPlatform`.
- `DeliveryIntegration` has many credentials, events, order links, sync attempts, cancellation reasons, disputes, and audit records.
- `PlatformOrderLink` belongs to one `Order` and one `DeliveryIntegration`.
- `PlatformSyncAttempt` optionally belongs to one `PlatformOrderLink`.
- `PlatformDispute` belongs to one `PlatformOrderLink`.

## State Transitions

### DeliveryIntegration

```text
DRAFT -> VALIDATING -> ACTIVE
DRAFT -> DISABLED
ACTIVE -> PAUSED -> ACTIVE
ACTIVE -> REQUIRES_ATTENTION -> VALIDATING -> ACTIVE
ACTIVE -> DISABLED
PAUSED -> DISABLED
```

### DeliveryPlatformEvent

```text
RECEIVED -> PROCESSING -> PROCESSED -> ACK_PENDING -> ACKED
RECEIVED -> PROCESSING -> IGNORED -> ACK_PENDING -> ACKED
RECEIVED -> PROCESSING -> FAILED -> PROCESSING
FAILED -> ACK_PENDING only when an operator marks it as intentionally ignored
```

### PlatformSyncAttempt

```text
PENDING -> SENT -> CONFIRMED
PENDING -> SENT -> RETRYABLE -> SENT
PENDING -> SENT -> FAILED
RETRYABLE -> CANCELLED
```

## Validation Rules

- Every query and mutation must resolve tenant from authenticated context unless it is an internal worker processing a store-scoped integration.
- Internal workers must load the tenant through the integration row and never process events without tenant ownership.
- Secret values must not appear in API responses, audit metadata, logs, or frontend state.
- Polling jobs must skip paused, disabled, draft, and invalid integrations.
- ACK jobs must skip events that are not durably processed.
- Confirmation deadline alerts must be generated before the iFood 8-minute window is missed.
- Duplicate external event IDs and duplicate external order IDs must be safe and idempotent.
