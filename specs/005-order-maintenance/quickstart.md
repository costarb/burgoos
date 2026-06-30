# Quickstart: Manutencao Auditavel de Pedidos

## Preconditions

- Log in as a tenant `OWNER` or `ADMIN`.
- Have products with technical sheets and inventory balances.
- Have at least one active order, one delivered order and one cancelled order.
- Record current inventory balance, sales report totals and DRE totals.

## Validate active order edit

1. Open `/admin/orders`.
2. Edit an active order and change one quantity, one customer field and one payment field.
3. Save with a reason when requested.
4. Confirm the card displays corrected values and recalculated total.
5. Confirm inventory reservation reflects only corrected quantities.
6. Confirm audit history shows actor, reason and before/after values.

## Validate delivered order edit

1. Open history and edit a delivered order.
2. Change date, gross/net amount, release date and one item quantity.
3. Confirm the financial-impact warning and save with a reason.
4. Confirm the order remains delivered.
5. Confirm inventory has corrected consumption without duplication.
6. Confirm sales report, receivables and DRE use only corrected values.

## Validate cancelled order edit

1. Edit a cancelled order and correct a descriptive or payment field.
2. Save with a reason.
3. Confirm it remains cancelled and excluded from realized reports.
4. Confirm no reservation or consumption is introduced.

## Validate logical deletion

1. Delete an active order with a reason; confirm it leaves the queue and releases reservation.
2. Delete a delivered order with a reason; confirm it leaves standard history, reports and DRE.
3. Search including deleted orders and confirm both remain auditable.
4. Confirm the delivered order inventory effect was compensated.

## Validate concurrency

1. Open the same order in two browser sessions.
2. Save an edit in the first session.
3. Attempt to save the stale edit in the second session.
4. Confirm it is rejected and no partial effects or audit record are created.

## Validate authorization and tenant isolation

1. Attempt maintenance as an `OPERATOR`; confirm denial.
2. Attempt maintenance for another tenant's order; confirm denial.

## Automated validation

```powershell
npm.cmd run typecheck --workspaces --if-present
npm.cmd run lint --workspaces --if-present
npm.cmd run test --workspaces --if-present
```
