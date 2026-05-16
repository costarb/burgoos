# Data Model: Gestao de CMV, Precificacao e Estoque

## FinancialConfiguration

Tenant-level defaults used by pricing, DRE and dashboards.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `tax_rate`: decimal percentage
- `card_fee_rate`: decimal percentage
- `operational_loss_rate`: decimal percentage
- `desired_margin_rate`: decimal percentage
- `average_packaging_cost`: decimal money
- `monthly_fixed_cost`: decimal money
- `monthly_revenue_goal`: decimal money
- `cmv_warning_rate`: decimal percentage
- `net_margin_goal_rate`: decimal percentage
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- Percentages must be between 0 and 1.
- Money values must be greater than or equal to zero.
- One active configuration applies per tenant.

## PurchaseUnit

Domain record for units used in ingredient purchase and recipe quantities.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `name`: string
- `abbreviation`: string
- `kind`: enum `WEIGHT`, `VOLUME`, `COUNT`, `PACKAGE`
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- Name and abbreviation must be unique per tenant.
- Inactive units cannot be used on new ingredients or recipe lines.

## Supplier

Provider of ingredients, packaging or operational supplies.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `name`: string
- `category`: string
- `contact_name`: string nullable
- `phone`: string nullable
- `email`: string nullable
- `notes`: string nullable
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- Inactive suppliers remain visible historically but cannot be selected for new ingredients.

## OrderPlatform

Sales channel or marketplace used for fees and profitability.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `name`: string
- `fee_rate`: decimal percentage
- `payment_fee_rate`: decimal percentage nullable
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- Platform name must be unique per tenant.
- Fee percentages must be between 0 and 1.
- Inactive platforms cannot be selected for new orders but remain linked to history.

## Ingredient

Purchasable input used in product recipes and stock.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `purchase_unit_id`: UUID FK
- `supplier_id`: UUID FK nullable
- `name`: string
- `category`: string
- `purchase_quantity`: decimal
- `purchase_cost`: decimal money
- `unit_cost`: decimal money
- `current_stock`: decimal
- `minimum_stock`: decimal
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- Purchase quantity must be greater than zero.
- Purchase cost, current stock and minimum stock must be greater than or equal to zero.
- Unit cost equals `purchase_cost / purchase_quantity`.
- Inactive ingredients cannot be used in new technical sheet lines.

## TechnicalSheet

Recipe/composition for one sellable product.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `product_id`: UUID FK
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Relationships:

- Has many `TechnicalSheetLine`.

Validation:

- One active technical sheet per product.
- Product must belong to the same tenant.

## TechnicalSheetLine

Ingredient quantity consumed by one unit of a product.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `technical_sheet_id`: UUID FK
- `ingredient_id`: UUID FK
- `quantity_used`: decimal
- `unit_cost_snapshot`: decimal money
- `item_cost`: decimal money
- `is_packaging`: boolean
- `notes`: string nullable
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- Quantity used must be greater than zero.
- Item cost equals `quantity_used * unit_cost_snapshot`.
- Ingredient must belong to the same tenant.

## ProductCostSnapshot

Calculated product cost and pricing state for a product and optional platform.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `product_id`: UUID FK
- `order_platform_id`: UUID FK nullable
- `ingredient_cmv`: decimal money
- `packaging_cost`: decimal money
- `operational_loss_cost`: decimal money
- `total_cmv`: decimal money
- `current_price`: decimal money
- `cmv_rate`: decimal percentage
- `desired_margin_rate`: decimal percentage
- `fee_rate`: decimal percentage
- `ideal_price`: decimal money
- `estimated_profit`: decimal money
- `estimated_margin_rate`: decimal percentage
- `status`: enum `OK`, `REVIEW_PRICE`, `MISSING_TECHNICAL_SHEET`
- `created_at`: datetime

Validation:

- Product and platform must belong to the same tenant.
- Status is `MISSING_TECHNICAL_SHEET` when product recipe is incomplete.

## StockMovement

Ledger entry for estimated stock changes.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `ingredient_id`: UUID FK
- `order_id`: UUID FK nullable
- `order_item_id`: UUID FK nullable
- `movement_type`: enum `INITIAL`, `MANUAL_ENTRY`, `MANUAL_ADJUSTMENT`, `RESERVATION`, `CONSUMPTION`, `RELEASE`
- `quantity`: decimal
- `reason`: string nullable
- `created_at`: datetime

Validation:

- Quantity must be greater than zero.
- Reservation, consumption and release movements linked to orders must reference same-tenant orders.
- A cancelled order must release open reservations.

## OrderProfitabilitySnapshot

Financial snapshot for one order item or order total.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `order_id`: UUID FK
- `order_item_id`: UUID FK nullable
- `order_platform_id`: UUID FK nullable
- `gross_revenue`: decimal money
- `discount`: decimal money
- `net_revenue`: decimal money
- `cmv`: decimal money
- `platform_fee`: decimal money
- `tax_amount`: decimal money
- `payment_fee`: decimal money
- `gross_profit`: decimal money
- `created_at`: datetime

Validation:

- Snapshot is immutable after order reaches terminal status.
- Cancelled orders do not count as realized revenue in DRE.

## DREPeriodSummary

Computed result for a reporting period.

Fields:

- `tenant_id`: UUID
- `period_start`: date
- `period_end`: date
- `gross_revenue`: decimal money
- `discounts`: decimal money
- `net_revenue`: decimal money
- `cmv`: decimal money
- `fees_and_taxes`: decimal money
- `gross_profit`: decimal money
- `fixed_expenses`: decimal money
- `estimated_net_profit`: decimal money
- `net_margin_rate`: decimal percentage
- `break_even_revenue`: decimal money

Validation:

- Includes delivered/realized orders for the period.
- Excludes cancelled orders.

## MenuEngineeringClassification

Computed product performance for a reporting period.

Fields:

- `tenant_id`: UUID
- `product_id`: UUID
- `period_start`: date
- `period_end`: date
- `volume_sold`: decimal
- `revenue`: decimal money
- `cmv`: decimal money
- `gross_profit`: decimal money
- `margin_rate`: decimal percentage
- `classification`: enum `STAR`, `WORKHORSE`, `PUZZLE`, `DOG`

Validation:

- Classification requires enough sales data for the period.
- Labels are displayed in Portuguese as Estrela, Cavalo, Quebra-cabeca and Abacaxi.

## State Transitions

### Stock reservation by order status

- `PENDING` or equivalent new order state: create reservation movements.
- `PREPARING` / `SHIPPED`: keep reservation active.
- `DELIVERED`: convert reservation to consumption or mark it realized.
- `CANCELLED`: release active reservation.

### Product cost reliability

- Complete technical sheet -> cost can be calculated.
- Missing sheet or missing ingredient cost -> product marked as unreliable for CMV and pricing.
