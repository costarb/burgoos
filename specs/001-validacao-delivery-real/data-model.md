# Data Model: Validação Delivery Real

## Tenant

Represents the pilot store and future SaaS account boundary.

Fields:

- `id`: UUID
- `name`: string
- `slug`: string, unique
- `phone`: string
- `active`: boolean
- `is_open`: boolean
- `config`: JSON, includes opening hours, delivery notes and PIX instructions
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- `slug` must be unique and URL-safe.
- inactive tenants cannot accept or show public orders.

## User

Represents an admin/operator.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `role`: enum `OWNER`, `ADMIN`, `OPERATOR`
- `name`: string
- `email`: string, unique
- `password_hash`: string
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- admin routes derive tenant from authenticated user.

## Category

Represents a public menu section.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `name`: string
- `sort_order`: integer
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- inactive categories are hidden from public menu.

## Product

Represents a sellable item.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `category_id`: UUID FK
- `name`: string
- `description`: string
- `price`: decimal
- `image_url`: string nullable
- `active`: boolean
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- `price` must be greater than or equal to zero.
- inactive products are hidden and rejected during checkout.

## Order

Represents a customer order.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `status`: enum `PENDING`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- `total`: decimal
- `customer_name`: string
- `customer_phone`: string
- `fulfillment_method`: enum `DELIVERY`, `PICKUP`
- `delivery_address`: JSON nullable
- `payment_method`: enum `CASH`, `PIX_MANUAL`, `CARD_ON_DELIVERY`
- `notes`: string nullable
- `created_at`: datetime
- `updated_at`: datetime

Validation:

- order must have at least one item.
- delivery orders require address.
- total is calculated from active product prices on server.

## OrderItem

Represents a product snapshot inside an order.

Fields:

- `id`: UUID
- `tenant_id`: UUID FK
- `order_id`: UUID FK
- `product_id`: UUID FK
- `product_name_snapshot`: string
- `quantity`: integer
- `unit_price`: decimal
- `total`: decimal

Validation:

- `quantity` must be greater than zero.
- item total equals `quantity * unit_price`.

## Status Transitions

Allowed:

- `PENDING -> PREPARING`
- `PREPARING -> SHIPPED`
- `SHIPPED -> DELIVERED`
- `PENDING -> CANCELLED`
- `PREPARING -> CANCELLED`
- `SHIPPED -> CANCELLED`

Disallowed:

- transitions from `DELIVERED`
- transitions from `CANCELLED`
- skipping to `DELIVERED` from `PENDING`
