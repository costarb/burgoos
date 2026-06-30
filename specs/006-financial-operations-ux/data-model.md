# Data Model: Operacoes Financeiras e Experiencia Administrativa

All persisted entities are tenant-scoped. Money uses fixed decimal precision and dates use the tenant business timezone.

## FinancialAccount

Represents a location where operational money is held.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `name` | string | Required and unique per tenant |
| `paymentInstitution` | enum, nullable | Optional mapping; unique per tenant when present |
| `openingBalance` | decimal | Required, may be zero |
| `openingBalanceAt` | datetime | Required |
| `active` | boolean | Defaults to true |
| `createdAt` / `updatedAt` | datetime | Managed timestamps |

Relationships:

- Has payable payments and manual cash movements.
- May receive order events through `paymentInstitution`.

Validation:

- Inactivation preserves history.
- Missing payment-institution mappings appear under an unallocated cash bucket.

## FinancialCategory

Classifies obligations and manual movements.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `name` | string | Required and unique per tenant |
| `active` | boolean | Defaults to true |
| `createdAt` / `updatedAt` | datetime | Managed timestamps |

## PayableRecurrence

Defines how future payable occurrences were generated.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `frequency` | enum | `WEEKLY`, `MONTHLY`, `YEARLY` |
| `interval` | integer | Positive, defaults to 1 |
| `startsOn` | date | Required |
| `endsOn` | date, nullable | Optional |
| `occurrenceCount` | integer, nullable | Optional alternative to end date |
| `active` | boolean | Controls future generation |
| `createdAt` / `updatedAt` | datetime | Managed timestamps |

Validation:

- End date and occurrence count are mutually exclusive.
- Existing occurrences and payments are never rewritten by recurrence changes.

## Payable

Represents one payable occurrence.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `categoryId` | UUID | Required, same tenant |
| `supplierId` | UUID, nullable | Optional, same tenant |
| `recurrenceGroupId` | UUID, nullable | Optional |
| `description` | string | Required |
| `documentReference` | string, nullable | Optional reference |
| `competenceDate` | date, nullable | Optional accounting reference |
| `dueDate` | date | Required |
| `expectedAmount` | decimal | Required and greater than zero |
| `notes` | text, nullable | Optional |
| `cancelledAt` | datetime, nullable | Set on cancellation |
| `cancellationReason` | string, nullable | Required when cancelled |
| `createdByUserId` | UUID | Required actor |
| `createdAt` / `updatedAt` | datetime | Managed timestamps |

Derived status:

- `OPEN`: active, unpaid and not overdue.
- `PARTIALLY_PAID`: active payments are greater than zero and lower than expected amount.
- `PAID`: active payments total expected amount.
- `OVERDUE`: remaining amount is greater than zero and due date is past.
- `CANCELLED`: cancellation timestamp exists.

Validation:

- Paid amount cannot exceed expected amount.
- A payable with active payments cannot be cancelled until those payments are reversed.
- Realized history is corrected through payment reversal, not deletion.

## PayablePayment

Represents a realized total or partial payment.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `payableId` | UUID | Required, same tenant |
| `financialAccountId` | UUID | Required, same tenant |
| `amount` | decimal | Required and greater than zero |
| `paidAt` | datetime | Required |
| `notes` | string, nullable | Optional |
| `reversedAt` | datetime, nullable | Set on reversal |
| `reversalReason` | string, nullable | Required when reversed |
| `createdByUserId` | UUID | Required actor |
| `reversedByUserId` | UUID, nullable | Reversal actor |
| `createdAt` | datetime | Immutable creation time |

Validation:

- Only non-reversed payments affect payable status and cash.
- Payment plus prior active payments cannot exceed expected amount.

## CashMovement

Represents explicit operational movements that do not originate from orders or payable payments.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `type` | enum | `MANUAL_INFLOW`, `MANUAL_OUTFLOW`, `TRANSFER`, `ADJUSTMENT` |
| `financialAccountId` | UUID | Source/affected account |
| `destinationAccountId` | UUID, nullable | Required only for transfer |
| `categoryId` | UUID, nullable | Optional classification |
| `amount` | decimal | Required and greater than zero |
| `occurredAt` | datetime | Required |
| `description` | string | Required |
| `justification` | string, nullable | Required for adjustment |
| `reversedAt` | datetime, nullable | Set on reversal |
| `reversalReason` | string, nullable | Required when reversed |
| `createdByUserId` | UUID | Required actor |
| `reversedByUserId` | UUID, nullable | Reversal actor |
| `createdAt` | datetime | Immutable creation time |

Validation:

- Transfer destination differs from source.
- Reversed movements have no balance effect.
- Transfer has zero consolidated balance effect.

## FinancialAudit

Immutable business audit for financial mutations.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required |
| `actorUserId` | UUID | Required |
| `entityType` | enum/string | Financial entity kind |
| `entityId` | UUID | Affected record |
| `action` | enum/string | Create, edit, cancel, pay, reverse, adjust |
| `beforeSnapshot` | JSON, nullable | State before action |
| `afterSnapshot` | JSON, nullable | State after action |
| `createdAt` | datetime | Immutable |

## CashLedgerEntry (derived)

Unified read-model row; not persisted.

Sources:

- Opening balance from `FinancialAccount`.
- Released order receipt using acquired net amount and effective release date.
- Active `PayablePayment`.
- Active `CashMovement`.

Fields:

- `sourceType`, `sourceId`
- `financialAccountId` or unallocated bucket
- `occurredAt`
- `description`
- `inflowAmount`, `outflowAmount`
- `runningBalance`
- `realizationStatus`

## CashStatementDay (derived)

Daily cash-statement group; not persisted.

Sources:

- Realized `CashLedgerEntry` rows within the selected period.
- Optional financial-account filter applied before daily aggregation.

Fields:

- `date`
- `creditAmount`
- `debitAmount`
- `netAmount`
- `runningBalance`
- `entries`

Rules:

- The consolidated statement includes all accounts and keeps transfers neutral in the total balance.
- The account-filtered statement shows only entries that affect the selected account.
- Reversed payable payments and reversed cash movements are excluded from totals.
- Each day subtotal must reconcile exactly with its analytical entries.

## CashProjectionEntry (derived)

Future read-model row; not persisted.

Sources:

- Order receipt whose effective release date is after the position reference date.
- Remaining payable amount whose due date is after the position reference date and within projection range.

Rules:

- Cancelled/deleted orders and cancelled payables are excluded.
- Realized payments reduce the projected remaining payable amount.
- Each source appears once, preventing double counting.

## State transitions

### Payable

```text
OPEN -> PARTIALLY_PAID -> PAID
OPEN/PARTIALLY_PAID -> OVERDUE (derived when due date passes)
OPEN/OVERDUE -> CANCELLED
PAID -> PARTIALLY_PAID/OPEN/OVERDUE (only through payment reversal)
```

### Payment and movement

```text
ACTIVE -> REVERSED
```

Reversal is terminal; a corrected event is created separately.

## Required indexes

- Financial account: `(tenantId, active)`, unique `(tenantId, name)`, unique nullable `(tenantId, paymentInstitution)`.
- Category: `(tenantId, active)`, unique `(tenantId, name)`.
- Payable: `(tenantId, dueDate)`, `(tenantId, supplierId, dueDate)`, `(tenantId, categoryId, dueDate)`, `(tenantId, recurrenceGroupId)`.
- Payment: `(tenantId, payableId, paidAt)`, `(tenantId, financialAccountId, paidAt)`.
- Cash movement: `(tenantId, financialAccountId, occurredAt)`, `(tenantId, destinationAccountId, occurredAt)`.
- Financial audit: `(tenantId, entityType, entityId, createdAt)`.
