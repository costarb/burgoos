# Quickstart: Relatorios de Vendas e Pedidos

## Goal

Validate the first sales reports module:

1. Admin opens a sales/orders report page.
2. Admin selects a period.
3. Admin sees daily sales evolution.
4. Admin sees a visual chart of daily sales evolution.
5. Admin filters by payment institution, payment method and channel.
6. Admin drills down into analytical orders.
7. Admin verifies totals against imported payment extracts and DRE-style values.

## Expected Commands

```powershell
npm install
npm run db:up
$env:DATABASE_URL='postgresql://burgoos:burgoos@127.0.0.1:5432/burgoos?schema=public&sslmode=disable'
npm run db:migrate
npm run dev
```

Implementation validation commands:

```powershell
npm.cmd run typecheck --workspaces --if-present
npm.cmd run lint --workspaces --if-present
npm.cmd run test --workspaces --if-present
```

## Manual Validation Script

1. Ensure the pilot store has imported or delivered orders across at least three dates.
2. Open `/admin/reports/sales`.
3. Select a period covering the imported Mercado Pago and PagBank extracts.
4. Verify the top summary shows:
   - order count
   - gross revenue
   - received/acquired net revenue
   - payment fees
   - average ticket
5. Verify the daily evolution lists every date in the period, including days with zero orders.
6. Verify the daily evolution chart appears above or near the daily table.
7. Verify the chart identifies daily movement for gross revenue and received/acquired net revenue.
8. Verify days with zero orders remain visible in the chart timeline.
9. Filter by `MERCADO_PAGO` and verify only Mercado Pago totals remain.
10. Filter by `PAGBANK` and verify only PagBank totals remain.
11. Filter by payment method `PIX`, `DEBIT_CARD`, `CREDIT_CARD` or `VOUCHER` and verify totals change.
12. Filter by channel/platform and verify totals change consistently.
13. Open or inspect the analytical list for a day with sales.
14. Verify analytical rows include:
    - date/time
    - status
    - channel
    - payment institution
    - payment method
    - external payment ID
    - gross amount
    - fee amount
    - acquired net amount
    - assigned product summary
15. Compare one daily row total with the sum of analytical orders for the same day and filters.
16. Compare one chart point with the corresponding daily table row.
17. Select a period with no sales and verify the empty state.

## Launch Readiness Checklist

- Daily report groups orders by local business date.
- Daily chart uses the same daily rows and filters as the daily table.
- Chart remains readable with zero-sale days and on narrow screens.
- Cancelled/non-delivered orders are excluded by default.
- Gross revenue and acquired net revenue are clearly distinguished.
- Filters update all report sections consistently.
- Analytical list can find an imported payment transaction by external ID.
- Empty periods and empty filter combinations are readable.
- Tenant isolation is covered by API tests.

## Operational Notes

- This report is not a replacement for DRE; it focuses on sales movement and order/payment analysis.
- Export is intentionally deferred until the on-screen columns are validated by the operation.
- Orders without payment net amount should use gross amount as acquired net fallback.
