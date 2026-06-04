# Research: Manutencao Auditavel de Pedidos

## Logical deletion separate from operational status

**Decision**: Add logical deletion data to Order without creating a new `OrderStatus`.

**Rationale**: Status represents the operational lifecycle. Deletion is an administrative decision that may happen in any status and must remove the order from standard queries without destroying evidence.

**Alternatives considered**: Physical deletion loses auditability. A `DELETED` status mixes visibility with operational state and complicates current filters.

## Immutable audit with before/after snapshots

**Decision**: Persist one maintenance record per operation with action, reason, actor, timestamp, expected version, before snapshot, after snapshot and impact summary.

**Rationale**: Complete JSON snapshots preserve items and financial fields as the model evolves and make corrections explainable.

**Alternatives considered**: Changed fields alone make full reconstruction difficult. Application logs are not a tenant-scoped functional audit trail.

## Optimistic concurrency through `updatedAt`

**Decision**: The client sends the observed `updatedAt`; maintenance proceeds only when it still matches.

**Rationale**: Prevents silent overwrites with little complexity and uses a field already present on Order.

**Alternatives considered**: Pessimistic locks create long-lived locks. A separate version number is unnecessary for the current flow.

## One transaction for order, effects and audit

**Decision**: Validation, compensation, update, effect reapplication and audit creation run in one transaction.

**Rationale**: Any failure must restore the entire previous operational and financial state.

**Alternatives considered**: Async recalculation creates visible inconsistency windows. Updating only Order leaves stock and snapshots incorrect.

## Compensating stock movements

**Decision**: Preserve existing movements and create compensating movements to neutralize the prior net effect. Apply a corrected reservation for active orders or consumption for delivered orders.

**Rationale**: Inventory is an operational trail. Rewriting or deleting old movements removes the explanation of the balance.

**Alternatives considered**: Deleting old movements loses traceability. Unlinked manual adjustments obscure the correction source.

## Replace current profitability snapshots

**Decision**: For delivered edits, delete current profitability snapshots and recreate them transactionally from the corrected version. For logical deletion, remove current snapshots.

**Rationale**: Current reports aggregate these snapshots and must represent only the valid version. The maintenance audit preserves before/after evidence.

**Alternatives considered**: Financial reversal snapshots require a broader accounting model. Mutating snapshots in place weakens traceability.

## Maintenance permission

**Decision**: Only `OWNER` and `ADMIN` may edit or delete orders. Operators retain normal status-transition permissions.

**Rationale**: Maintenance can alter inventory and financial results.

**Alternatives considered**: Allowing operators is too permissive. Granular permissions are deferred until the real operation needs them.

## External identifier remains reserved

**Decision**: Duplicate import checks continue to include logically deleted orders.

**Rationale**: Deleting a duplicate must not accidentally allow the same banking transaction to be imported again.

**Alternatives considered**: Releasing the identifier after deletion recreates accidental duplicates.
