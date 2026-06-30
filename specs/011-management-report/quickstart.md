# Quickstart: Relatorio Gerencial Consolidado

## Prerequisites

- Docker Desktop running.
- PostgreSQL service healthy.
- Local API and web apps running.
- Seed or imported data containing orders, cash movements, financial accounts and payables.
- Admin user with report/financial permissions.

## Run Locally

```powershell
docker compose up -d postgres
npm.cmd run dev --workspace @burgoos/api
npm.cmd run dev --workspace @burgoos/web
```

Open:

- Web: `http://localhost:3000`
- API docs: `http://localhost:3001/docs`

## Manual Validation Flow

1. Login as an admin user with financial/report permissions.
2. Navigate to `Admin > Relatorios > Gerencial`.
3. Confirm the default period is the current month.
4. Confirm the page shows sections for resumo executivo, caixa, vendas and contas a pagar.
5. Change the start and end dates and apply the filter.
6. Confirm all cards and charts update for the selected period.
7. Compare cash cards with the cash-flow statement for the same period.
8. Compare sales cards and dimensions with the sales report for the same period.
9. Compare payable cards with accounts payable for the same period.
10. Confirm expense category grouping shows expected, paid, open and overdue values.
11. Select a period with no data and confirm the page stays readable with zero values.
12. Request PDF export.
13. Confirm the request returns immediately and the page remains usable.
14. Open the notification center when the export completes.
15. Download the PDF and confirm it includes period, executive summary, cash, sales and payables sections.

## Error Validation Flow

1. Submit a start date after the end date.
2. Confirm the user sees a clear validation message.
3. Simulate an export failure.
4. Confirm a failure notification appears and does not expose internal details.
5. Login with a user lacking financial/report permissions.
6. Confirm the report is blocked or unavailable.

## Automated Checks

```powershell
npm.cmd run test --workspace @burgoos/api -- management-report
npm.cmd run test --workspace @burgoos/web -- management-report
npm.cmd run typecheck --workspace @burgoos/api
npm.cmd run typecheck --workspace @burgoos/web
npm.cmd run lint --workspace @burgoos/api
npm.cmd run lint --workspace @burgoos/web
```

## Expected Evidence

- One screen summarizes cash, sales and payables for the same period.
- Totals match the source screens for the same filters.
- Expense grouping is visible and understandable.
- PDF export is asynchronous and notifies success/failure.
- PDF can be understood without access to the web screen.
