# Research: Gestao de CMV, Precificacao e Estoque

## Decision: Treat stock as estimated operational inventory

**Rationale**: The feature needs to prevent operational surprises during a delivery shift, not replace fiscal inventory. Estimated stock can be driven by current stock, manual entries/adjustments and product recipes consumed by orders.

**Alternatives considered**:

- Fiscal-grade inventory valuation: too heavy for the pilot and would require accounting rules outside current scope.
- No stock module: would leave the requested spreadsheet proposal incomplete and would not support ingredient availability during order flow.

## Decision: Reserve or consume stock when orders become in-progress

**Rationale**: The user explicitly asked for stock to go down as orders are happening. Reserving/consuming on in-progress statuses reflects kitchen demand before final delivery, and cancellation can release/compensate the reservation.

**Alternatives considered**:

- Consume only on delivery: simpler, but hides ingredient pressure while orders are being prepared.
- Consume on cart/checkout draft: too early and could reserve stock for abandoned carts.

## Decision: Preserve order profitability snapshots

**Rationale**: Ingredient costs, fees and configuration can change after a sale. Historical DRE and order profitability must represent what was known/applied at the sale time.

**Alternatives considered**:

- Always recalculate history from current costs: simpler but corrupts historical reporting.
- Store only aggregate DRE: loses detail for audit and product analysis.

## Decision: Use tenant-maintained domain tables for CRUD-backed options

**Rationale**: Units, suppliers, order platforms and other repeated options are business data. They need maintenance screens so operators do not rely on hard-coded or free-text values.

**Alternatives considered**:

- Hard-coded lists: quick but not flexible enough for 99Food, Keeta, local suppliers or custom units.
- Free-text fields only: fast to build but creates inconsistent reporting and invalid calculations.

## Decision: Price recommendations are channel-aware

**Rationale**: Spreadsheet data includes different channels, and platform fees can materially change margin. iFood, 99Food, Keeta, WhatsApp and own channels need different fee assumptions.

**Alternatives considered**:

- One global fee rate: easier but misleading for products sold across multiple channels.
- Separate duplicated products by channel: creates catalog maintenance burden and inconsistent menu operations.

## Decision: Packaging can be global average or explicit recipe component

**Rationale**: The spreadsheet has both average packaging and packaging as an input. The product must avoid double counting while allowing either model.

**Alternatives considered**:

- Always use global average: loses product-specific packaging cost.
- Always require packaging in every recipe: more accurate, but slower for pilot setup.

## Decision: Start with percentage-based platform fees

**Rationale**: Percentage fees cover the spreadsheet model and the common first pass for marketplaces and payment costs. Fixed fees and tiered rules can be added later.

**Alternatives considered**:

- Full fee rules engine: more flexible, but premature for the first CMV/price version.
- Manual per-order fee entry only: accurate but too slow and error-prone for daily operation.
