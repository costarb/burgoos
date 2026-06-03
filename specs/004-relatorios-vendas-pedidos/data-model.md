# Data Model: Relatorios de Vendas e Pedidos

## SalesReportFilter

Filter set applied consistently to all sales report views.

Fields:

- `tenant_id`: UUID resolved from authenticated admin context
- `period_start`: local business date
- `period_end`: local business date
- `payment_institution`: optional enum filter
- `payment_method`: optional enum filter
- `order_platform_id`: optional UUID filter
- `status`: optional order status filter, defaulting to delivered/realized sales
- `page`: optional positive integer for analytical list
- `page_size`: optional positive integer for analytical list

Validation:

- Period start must be on or before period end.
- Period range should be bounded for first release to keep reports responsive.
- Payment and platform filters must only match tenant-visible values.

## SalesReportSummary

Top-level totals for the selected filters.

Fields:

- `order_count`: integer
- `gross_revenue`: decimal money
- `acquired_net_revenue`: decimal money
- `payment_fee_amount`: decimal money
- `average_ticket`: decimal money
- `period_start`: date
- `period_end`: date

Validation:

- Includes only orders matching the selected filters.
- Cancelled/non-delivered orders are excluded by default.
- Acquired net revenue uses payment net amount when present, otherwise gross amount.
- Average ticket is zero when order count is zero.

## DailySalesSummary

One row in the daily evolution.

Fields:

- `date`: local business date
- `order_count`: integer
- `gross_revenue`: decimal money
- `acquired_net_revenue`: decimal money
- `payment_fee_amount`: decimal money
- `average_ticket`: decimal money
- `gross_revenue_delta_rate`: decimal nullable
- `order_count_delta_rate`: decimal nullable

Validation:

- Every day in the selected period appears once.
- Days without sales return zero values.
- Delta rates are null for the first day or when the previous denominator is zero.

## SalesAnalyticalOrder

Order-level row used for auditing and drill-down.

Fields:

- `order_id`: UUID
- `created_at`: datetime
- `status`: order status
- `customer_name`: string
- `order_platform_name`: string nullable
- `payment_institution`: enum nullable
- `payment_method`: enum
- `external_payment_id`: string nullable
- `payment_brand`: string nullable
- `gross_amount`: decimal money
- `payment_fee_amount`: decimal money nullable
- `acquired_net_amount`: decimal money
- `item_count`: integer
- `assigned_products`: list of product names and quantities
- `imported`: boolean

Validation:

- Row belongs to the authenticated tenant.
- Acquired net amount falls back to gross amount when no payment net amount exists.
- Imported is true when external payment ID or import metadata exists.

## PaymentDimensionSummary

Aggregate by payment institution or payment method.

Fields:

- `dimension_key`: string
- `dimension_label`: string
- `order_count`: integer
- `gross_revenue`: decimal money
- `acquired_net_revenue`: decimal money
- `payment_fee_amount`: decimal money
- `share_of_gross_revenue`: decimal percentage

Validation:

- Shares sum approximately to 100% when total gross revenue is greater than zero.
- Null institution values appear under a clear "Nao informado" label.

## ChannelSummary

Aggregate by order platform/channel.

Fields:

- `order_platform_id`: UUID nullable
- `order_platform_name`: string
- `order_count`: integer
- `gross_revenue`: decimal money
- `acquired_net_revenue`: decimal money
- `payment_fee_amount`: decimal money
- `average_ticket`: decimal money

Validation:

- Orders without platform are grouped under "Sem canal".
- Channel records remain reportable even if the platform is later inactive.

## SalesReportResponse

Complete report payload for the first release.

Fields:

- `summary`: SalesReportSummary
- `daily`: list of DailySalesSummary
- `by_payment_institution`: list of PaymentDimensionSummary
- `by_payment_method`: list of PaymentDimensionSummary
- `by_channel`: list of ChannelSummary
- `analytical`: paginated list of SalesAnalyticalOrder

Validation:

- All sections use the same filter set.
- Analytical totals for the returned page do not replace summary totals for the full filter set.
