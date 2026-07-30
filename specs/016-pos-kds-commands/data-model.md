# Data Model: PDV, Comandas e KDS Omnicanal

## Conventions

- Todas as entidades operacionais possuem `tenantId`.
- Valores monetários usam decimal com duas casas; nunca ponto flutuante.
- Instantes são persistidos em UTC e apresentados no fuso da loja.
- Ações concorrentes usam `version` ou `updatedAt` esperado.
- Chaves externas únicas incluem tenant, conexão ou provedor.
- Snapshots preservam a venda mesmo quando catálogo e ficha técnica mudam.

## Enum changes

### OrderStatus

Adicionar `READY` ao enum existente:

```text
PENDING
PREPARING
READY
SHIPPED
DELIVERED
CANCELLED
```

Transições:

```text
PENDING -> PREPARING | CANCELLED
PREPARING -> READY | CANCELLED
READY -> DELIVERED | SHIPPED | CANCELLED
SHIPPED -> DELIVERED | CANCELLED
DELIVERED -> terminal
CANCELLED -> terminal
```

`READY -> SHIPPED` é permitido apenas para `DELIVERY`. `READY -> DELIVERED` atende retirada/local.

### OrderSource

```text
LEGACY
COUNTER
PUBLIC_MENU
IFOOD
IMPORT
API
```

### ServiceTabStatus

```text
OPEN
CHECKOUT_PENDING
PAID
CANCELLED
```

### ChargeMode

```text
AUTOMATIC
MANUAL
```

### ChargeStatus

```text
CREATED
WAITING_CUSTOMER
PROCESSING
APPROVED
DECLINED
CANCELLED
EXPIRED
FAILED
UNKNOWN
PARTIALLY_REFUNDED
REFUNDED
```

### PaymentTargetType

```text
ORDER
SERVICE_TAB
```

### ItemModificationType

```text
REMOVE_INGREDIENT
ADD_COMPLEMENT
```

### OperationalEventType

```text
ORDER_CREATED
ORDER_STATUS_CHANGED
ORDER_CANCELLED
ORDER_ASSIGNED
ORDER_ASSIGNMENT_TRANSFERRED
PRICE_OVERRIDDEN
TAB_OPENED
TAB_CHECKOUT_STARTED
TAB_REOPENED
TAB_PAID
TAB_CANCELLED
CHARGE_CREATED
CHARGE_STATUS_CHANGED
PAYMENT_MANUALLY_CONFIRMED
PAYMENT_CANCELLED
PAYMENT_REFUNDED
PAYMENT_EXCEPTION_OPENED
PAYMENT_EXCEPTION_RESOLVED
```

## Existing entity changes

### Order

New fields:

| Field | Type | Rules |
|-------|------|-------|
| `serviceTabId` | UUID nullable | Same tenant as order |
| `source` | OrderSource | Default `LEGACY` for migration; server sets for new orders |
| `publicCode` | string nullable | Unique per tenant and operational date/window |
| `assignedUserId` | UUID nullable | User must have active access to tenant |
| `productionStartedAt` | timestamp nullable | Set on first PREPARING |
| `readyAt` | timestamp nullable | Set on READY |
| `completedAt` | timestamp nullable | Set on DELIVERED/CANCELLED |
| `version` | integer | Increment on mutable operational changes |

Existing `paymentMethod` and `paymentInstitution` remain as compatibility/report projections. New payment truth comes from valid `PaymentAllocation`; projection updates after payment changes.

Indexes:

```text
(tenantId, source, createdAt)
(tenantId, publicCode)
(tenantId, serviceTabId)
(tenantId, assignedUserId, status)
```

### OrderItem

New snapshot fields:

| Field | Type | Rules |
|-------|------|-------|
| `baseUnitPrice` | decimal nullable | Catalog price before additions |
| `calculatedUnitPrice` | decimal nullable | Server calculation after complements |
| `chargedUnitPrice` | decimal nullable | Effective unit price; existing `unitPrice` remains projection |
| `manualAdjustmentAmount` | decimal nullable | charged - calculated |
| `manualAdjustmentReason` | string nullable | Required when difference is non-zero |
| `manualAdjustmentByUserId` | UUID nullable | Requires permission |

## New entities

### ServiceTab

Represents an optional open consumption account.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | Primary key |
| `tenantId` | UUID | Required |
| `number` | string | Unique among active/open tabs in tenant |
| `displayName` | string nullable | Customer nickname or table |
| `publicCode` | string | Safe operational identifier |
| `status` | ServiceTabStatus | Default OPEN |
| `assignedUserId` | UUID nullable | Current attendant |
| `openedByUserId` | UUID | Required |
| `checkoutStartedByUserId` | UUID nullable | Set at closing |
| `closedByUserId` | UUID nullable | Set at PAID/CANCELLED |
| `openedAt` | timestamp | Required |
| `checkoutStartedAt` | timestamp nullable | |
| `closedAt` | timestamp nullable | |
| `version` | integer | Optimistic concurrency |
| `notes` | string nullable | Operational only |

Derived values: order gross total, valid paid amount, open balance.

Constraints:

```text
unique (tenantId, publicCode)
partial unique concept: (tenantId, normalized number) while status in OPEN/CHECKOUT_PENDING
```

### OrderItemModification

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `orderItemId` | UUID | Required |
| `type` | ItemModificationType | |
| `ingredientId` | UUID nullable | Required for removal |
| `complementId` | UUID nullable | Required for addition |
| `nameSnapshot` | string | Required |
| `quantity` | decimal | Positive |
| `unitPriceDelta` | decimal | Zero for removal by default |
| `totalPriceDelta` | decimal | Server calculated |

Only one target (`ingredientId` or `complementId`) may be populated according to type.

### ProductComplement

Commercially selectable additional item.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `name` | string | Required |
| `description` | string nullable | |
| `price` | decimal | Non-negative |
| `ingredientId` | UUID nullable | Optional inventory/cost link |
| `active` | boolean | |
| `maxQuantity` | integer | Positive |
| `sortOrder` | integer | |

### ProductComplementAssignment

Links complements to a product; category-wide rules may be added later.

```text
productId
complementId
active
minQuantity
maxQuantity
unique(productId, complementId)
```

### PaymentTerminal

Local allow-list/cache of provider terminals.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `connectionId` | UUID | Mercado Pago connection |
| `provider` | PaymentInstitution | Initially MERCADO_PAGO |
| `providerTerminalId` | string | External terminal ID |
| `providerStoreId` | string nullable | |
| `providerPosId` | string nullable | |
| `model` | string nullable | |
| `serialNumberMasked` | string nullable | No sensitive token |
| `operatingMode` | string nullable | Must be PDV to enable automatic charge |
| `displayName` | string | Store-defined alias |
| `enabled` | boolean | |
| `lastSeenAt` | timestamp | |

Constraint:

```text
unique(connectionId, providerTerminalId)
index(tenantId, enabled)
```

### PaymentCharge

One payment attempt.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `targetType` | PaymentTargetType | |
| `orderId` | UUID nullable | Required for ORDER |
| `serviceTabId` | UUID nullable | Required for SERVICE_TAB |
| `institution` | PaymentInstitution | |
| `method` | PaymentMethod | |
| `mode` | ChargeMode | |
| `status` | ChargeStatus | |
| `amount` | decimal | Positive and <= open balance in initial release |
| `terminalId` | UUID nullable | Required for automatic Point |
| `connectionId` | UUID nullable | Required for external provider |
| `idempotencyKey` | string | Unique per tenant |
| `providerOrderId` | string nullable | |
| `providerTransactionId` | string nullable | |
| `providerStatus` | string nullable | |
| `providerStatusDetail` | string nullable | |
| `externalReference` | string nullable | <= provider limit |
| `cashReceivedAmount` | decimal nullable | Manual cash only |
| `cashChangeAmount` | decimal nullable | Derived |
| `manualReference` | string nullable | PagBank/manual |
| `createdByUserId` | UUID | |
| `confirmedByUserId` | UUID nullable | Manual confirmation |
| `createdAt` | timestamp | |
| `expiresAt` | timestamp nullable | |
| `finalizedAt` | timestamp nullable | |
| `lastCheckedAt` | timestamp nullable | |
| `version` | integer | |

Constraints:

```text
unique(tenantId, idempotencyKey)
unique(connectionId, providerOrderId)
check exactly one target matches targetType
```

### Payment

Confirmed financial result. One charge normally produces at most one payment.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID | |
| `chargeId` | UUID | Unique |
| `institution` | PaymentInstitution | Snapshot |
| `method` | PaymentMethod | Snapshot |
| `grossAmount` | decimal | |
| `feeAmount` | decimal nullable | |
| `netAmount` | decimal nullable | |
| `refundedAmount` | decimal | Default zero |
| `providerPaymentId` | string nullable | |
| `approvedAt` | timestamp | |
| `cancelledAt` | timestamp nullable | |
| `refundedAt` | timestamp nullable | |

### PaymentAllocation

Allocates confirmed payment to an order or tab balance.

```text
id
tenantId
paymentId
orderId nullable
serviceTabId nullable
amount
createdAt
unique(paymentId, orderId/serviceTabId target)
```

Initial UI creates one full allocation. The model supports future split/partial payment.

### PaymentProviderEvent

Durable webhook inbox.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID | |
| `tenantId` | UUID nullable | Resolved during validation |
| `provider` | PaymentInstitution | |
| `providerEventId` | string | |
| `providerResourceId` | string | |
| `topic` | string | |
| `signatureValid` | boolean | |
| `payloadRedacted` | JSON | No tokens/card secrets |
| `status` | PENDING/PROCESSED/IGNORED/FAILED | |
| `attempts` | integer | |
| `receivedAt` | timestamp | |
| `processedAt` | timestamp nullable | |
| `lastError` | string nullable | Sanitized |

Constraint:

```text
unique(provider, providerEventId)
index(provider, providerResourceId)
```

### PaymentException

Operational exception requiring review.

```text
id
tenantId
chargeId nullable
paymentId nullable
type (UNKNOWN_RESULT, POSSIBLE_DUPLICATE, MANUAL_DIVERGENCE, REFUND_AFTER_DELIVERY, TOKEN_ERROR)
status (OPEN, RESOLVED, DISMISSED)
description
resolution
openedAt
resolvedAt
resolvedByUserId
```

### OrderOperationalEvent

Append-only audit for operational and financial actions.

```text
id
tenantId
orderId nullable
serviceTabId nullable
chargeId nullable
type
actorUserId nullable
source (USER, PROVIDER, SYSTEM)
reason nullable
metadata JSON redacted
occurredAt
```

## Public queue configuration

Store in the existing tenant configuration:

```json
{
  "orderQueue": {
    "enabled": true,
    "activeStatuses": ["PENDING", "PREPARING", "READY"],
    "completedStatuses": ["DELIVERED"],
    "completedLimit": 8,
    "showNickname": false,
    "staleAfterSeconds": 15
  }
}
```

## Derived invariants

1. `tab.openBalance = sum(non-cancelled order totals) - sum(valid allocations)`.
2. `PAID` requires open balance zero and no unresolved charge that could duplicate payment.
3. `Order.paymentStatus` is derived from allocations: UNPAID, PARTIALLY_PAID, PAID, REFUNDED or EXCEPTION.
4. Provider events never directly change `Order.status`.
5. A terminal cannot create a new active automatic charge while another active charge targets the same tab/order unless explicitly cancelled or reconciled.
6. Manual confirmation and override actions always require actor and audit event.
7. Cross-tenant foreign references are rejected even if IDs are valid UUIDs.
