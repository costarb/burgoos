# Data Model: Relatorio Gerencial Consolidado

## ManagementReport

Represents the consolidated report for a selected period.

Fields:

- `period.start`: selected start date.
- `period.end`: selected end date.
- `executiveSummary`: high-level indicators across cash, sales and payables.
- `cashFlow`: cash indicators, account balances and optional trend.
- `sales`: sales indicators, evolution and dimensions.
- `payables`: payable indicators and expense category grouping.

Validation:

- `start` and `end` are required.
- `start` must be less than or equal to `end`.
- Period must be tenant-scoped.

## ExecutiveSummary

Represents the top-level management reading.

Fields:

- `grossRevenue`
- `netRevenue`
- `cashNet`
- `finalBalance`
- `payablesOpen`
- `payablesOverdue`
- `receivableAmount`
- `periodNarrative`

## ManagementCashFlowSection

Represents cash-flow indicators for the period.

Fields:

- `credits`
- `debits`
- `net`
- `finalBalance`
- `balancesByAccount[]`

Relationships:

- Uses financial accounts and cash statement entries.

## ManagementSalesSection

Represents sales indicators and dimensions.

Fields:

- `orders`
- `grossRevenue`
- `netRevenue`
- `releasedAmount`
- `receivableAmount`
- `feeAmount`
- `averageTicket`
- `daily[]`
- `byInstitution[]`
- `byPaymentMethod[]`
- `byChannel[]`

Relationships:

- Uses orders, payment information and order platforms.

## ManagementPayablesSection

Represents accounts payable indicators and expense grouping.

Fields:

- `expected`
- `paid`
- `open`
- `overdue`
- `openCount`
- `overdueCount`
- `byCategory[]`

Relationships:

- Uses payable, payable payments and financial categories.

## ExpenseCategorySummary

Represents payable totals grouped by category/type.

Fields:

- `categoryId`
- `categoryName`
- `expected`
- `paid`
- `open`
- `overdue`
- `shareOfExpected`

Validation:

- Monetary values must be formatted consistently with the rest of the financial module.
- Unknown or removed categories should still be represented with a stable label.

## ManagementReportExport

Represents an asynchronous PDF export request for a management report period.

Fields:

- `context`: management report export context.
- `format`: PDF.
- `filters.start`
- `filters.end`
- `status`
- `downloadUrl`

Relationships:

- Reuses existing export job and notification entities.
