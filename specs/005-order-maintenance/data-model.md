# Data Model: Manutencao Auditavel de Pedidos

## Order extensions

Existing order fields remain unchanged. Add:

| Field | Type | Rules |
|---|---|---|
| `deletedAt` | datetime, nullable | Set only by logical deletion |
| `deletedByUserId` | UUID, nullable | Actor from authenticated tenant user |
| `deletionReason` | text, nullable | Required when `deletedAt` is set |

Relationships:

- An order belongs to one tenant.
- An order may reference the user who deleted it.
- An order has zero or more maintenance audit records.

Validation:

- Deletion fields are set together.
- Deleted orders cannot receive status transitions or further edits.
- Standard queue, history, report and DRE queries filter `deletedAt = null`.
- Duplicate checks by external payment identifier include deleted orders.

## OrderMaintenance

Represents one immutable administrative edit or logical deletion.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | Primary identifier |
| `tenantId` | UUID | Required; same tenant as order and actor |
| `orderId` | UUID | Required |
| `actorUserId` | UUID | Required; OWNER or ADMIN |
| `action` | enum | `EDIT` or `DELETE` |
| `reason` | text | Required, trimmed, minimum 3 characters |
| `expectedUpdatedAt` | datetime | Version supplied by client |
| `beforeSnapshot` | JSON | Complete maintainable order state before operation |
| `afterSnapshot` | JSON, nullable | Corrected state; null for deletion |
| `impactSummary` | JSON | Inventory and snapshot reconciliation summary |
| `createdAt` | datetime | Immutable operation timestamp |

Indexes:

- `(tenantId, orderId, createdAt)`
- `(tenantId, actorUserId, createdAt)`
- `(tenantId, action, createdAt)`

## Maintainable order snapshot

The before/after JSON snapshot contains:

- Order identity, status and timestamps.
- Customer, fulfillment, delivery and notes.
- Platform/channel and complete payment data.
- Order total.
- Items with IDs, product snapshot, quantity, unit price and total.

Authentication data is never included.

## Validation rules

- `expectedUpdatedAt` must equal current `updatedAt`.
- Quantity is a positive integer.
- Prices and financial amounts are non-negative.
- Order total equals the sum of item totals.
- Payment fee and net amount cannot exceed gross amount.
- Added/replaced products belong to the same tenant.
- Historical items may retain inactive products.
- Editing a cancelled order never changes status automatically.

## State and effect transitions

### Active order edit

1. Capture before snapshot.
2. Neutralize current reservation with compensating movements.
3. Replace order/item data.
4. Apply reservation for corrected items.
5. Create `EDIT` audit record.

### Delivered order edit

1. Capture before snapshot.
2. Neutralize the net inventory effect tied to the order.
3. Remove current profitability snapshots.
4. Replace order/item data.
5. Apply corrected delivered consumption.
6. Recreate profitability snapshots.
7. Create `EDIT` audit record.

### Cancelled order edit

1. Capture before snapshot.
2. Replace allowed order/item data.
3. Ensure no active reservation remains.
4. Create `EDIT` audit record.

### Logical deletion

1. Capture before snapshot.
2. Neutralize current reservation or delivered consumption.
3. Remove current profitability snapshots.
4. Set deletion fields.
5. Create `DELETE` audit record with null after snapshot.

All steps occur in one transaction. Any failure rolls back the complete operation.

## Query behavior

- Operational queue/history: only non-deleted orders.
- Sales report and daily summary: only non-deleted orders.
- DRE, menu engineering and financial dashboard: snapshots whose order is not deleted.
- Maintenance search: includes active, finalized and optionally deleted orders.
- Audit history: includes records for logically deleted orders.
