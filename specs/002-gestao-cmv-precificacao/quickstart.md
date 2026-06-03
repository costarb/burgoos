# Quickstart: Gestao de CMV, Precificacao e Estoque

## Goal

Validate the first operational profitability flow locally:

1. Admin configures financial parameters and domains.
2. Admin creates purchase units, suppliers and order platforms.
3. Admin creates ingredients with costs and stock thresholds.
4. Admin creates a product technical sheet.
5. Admin reviews CMV and price recommendation by platform.
6. Customer creates an order for that product.
7. Stock is reserved/consumed while the order is in progress.
8. Admin delivers or cancels the order.
9. Admin checks inventory, DRE, dashboard and menu engineering.

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
npm.cmd run test -w @burgoos/api
npm.cmd run lint
```

## Manual Validation Script

1. Open the admin dashboard.
2. Configure financial settings:
   - iFood/platform fee
   - tax rate
   - card/payment fee
   - operational loss rate
   - desired margin
   - average packaging cost
   - monthly fixed cost
   - monthly revenue goal
3. Create purchase units:
   - gram
   - kilogram
   - unit
4. Create at least one supplier.
5. Create order platforms:
   - iFood
   - WhatsApp
   - own channel
6. Create ingredients:
   - blend beef
   - bun
   - cheese
   - sauce
   - packaging
7. Set current stock and minimum stock for each ingredient.
8. Create or open a sellable product from the existing catalog.
9. Build the product technical sheet with at least 5 ingredient lines.
10. Open pricing analysis for the product.
11. Verify ingredient CMV, packaging, operational loss, total CMV and CMV percentage.
12. Select iFood as platform and verify ideal price uses platform fees.
13. Select WhatsApp/own channel and verify the ideal price changes when fees differ.
14. Create a public order for the product.
15. Open inventory and verify ingredient stock impact appears while the order is active.
16. Cancel the order and verify stock impact is released, or deliver it and verify it remains consumed.
17. Create a delivered order.
18. Open DRE for the day and verify revenue, CMV, fees, gross profit and fixed expense impact.
19. Open dashboard and verify alerts for price review, stock purchase and margin.
20. Open menu engineering and verify classification appears when there is enough sales data.

## Historical Payment Extract Import Validation

Use this flow when the operation has sales in payment institution extracts but no item-level order history.

1. Open `/admin/orders/import`.
2. Select layout `Mercado Pago` and paste the original Mercado Pago extract.
3. Import the file and verify the screen shows processing, then a completion message with valid/imported/ignored counts.
4. Verify imported orders use:
   - payment institution `MERCADO_PAGO`
   - payment method mapped from `PAYMENT_METHOD_DETAIL`
   - external payment ID from `PAYMENT_ID`
   - gross value from `GROSS_VALUE`
   - fee from `SALES_DISCOUNTS`
   - net received from `NET`
   - order/snapshot date from `OPERATION_DATETIME`
5. Select layout `PagBank` and paste the original PagBank extract.
6. Verify imported orders use:
   - payment institution `PAGBANK`
   - payment method mapped from `Forma de Pagamento`
   - external payment ID from `Codigo da Transacao`
   - gross value from `Valor Bruto`
   - fee from `Valor Taxa`
   - net received from `Valor Liquido`
   - order/snapshot date from `Data da Transacao`
7. For local cash sales, select layout `Simples`, choose `CAIXA_LOCAL` or `DINHEIRO` as the default institution, and import `Data;Valor` or `Data;Instituicao;Meio;Valor`.
8. Reimport the same extract and verify duplicates are ignored.
9. Open DRE filtered to the original sale date and verify gross revenue and received net revenue appear for that day, not for the import day.

## Launch Readiness Checklist

- Required domains can be maintained from admin screens.
- Every new CRUD has a visible maintenance screen.
- Product without technical sheet is clearly flagged.
- Product CMV matches manual calculation from ingredient costs and quantities.
- Price recommendation changes by platform fees.
- In-progress orders affect estimated stock.
- Cancelled orders release stock impact.
- Delivered orders preserve profitability snapshots.
- DRE excludes cancelled orders.
- DRE shows both operational net revenue and received net revenue from payment institutions.
- Historical imports preserve transaction date, external payment ID, gross amount, fee amount and net amount.
- Import screen gives visible processing, success and error feedback.
- Dashboard highlights CMV, margin, price review and stock alerts.
- Menu engineering requires at least two products with delivered-order profitability snapshots in the selected period.

## Operational Fallback

If stock reservation fails during pilot:

- Continue receiving orders through the existing delivery flow.
- Use the technical sheet and ingredient list to manually estimate critical stock.
- Temporarily mark products unavailable when a key ingredient is at risk.
- Reconcile manual stock adjustments after service.
- Keep delivered order snapshots as the source for DRE once the issue is corrected.

## Launch Caveats

- Stock is estimated from current stock plus movements; it is not a fiscal inventory ledger.
- Orders in progress reserve ingredients from the product technical sheet; missing sheets prevent reliable stock impact.
- Delivered orders create profitability snapshots once, preserving historical CMV and fees for DRE and menu engineering.
- Menu engineering classifications compare each product against the period averages, so early pilot data can move between classes quickly.
