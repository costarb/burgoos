# Research: Relatorios de Vendas e Pedidos

## Decision: Reuse existing order and payment reconciliation data

**Rationale**: Sales reports are derived from delivered orders, order items, order platforms and payment reconciliation fields already introduced by the profitability/import flow. A separate reporting table would add synchronization risk before the pilot has scale that requires pre-aggregation.

**Alternatives considered**:

- Add a daily sales aggregate table: faster for large data, but premature for pilot volume and harder to keep correct during imports/reimports.
- Reuse only DRE snapshots: good for profitability, but insufficient for analytical order fields such as external payment ID, brand and payment institution.

## Decision: Group reports by local business date

**Rationale**: Operators think in local service days. Imported payment extracts contain local sale timestamps, and DRE was already adjusted to use local period boundaries. Sales reports must match that behavior to avoid late-night sales moving to the wrong day.

**Alternatives considered**:

- Group by UTC date: simpler technically, but produces wrong business-day totals after evening service.
- Store an extra business date on orders: useful later if business-day cutoffs differ from midnight, but not needed for first release.

## Decision: Separate daily summary and analytical list concerns

**Rationale**: The page needs both high-level daily evolution and detailed orders. Keeping daily summaries and analytical rows as separate report views allows the UI to load totals quickly and paginate details without overfetching.

**Alternatives considered**:

- Return all analytical rows with summary in one response: simple but can become heavy for longer periods.
- Only provide analytics and calculate totals in the browser: risks inconsistent totals and duplicates server-side business logic.

## Decision: Include zero-sale days in daily evolution

**Rationale**: A period report should show operational continuity. Missing dates can make a flat period look shorter and hide closed or weak days.

**Alternatives considered**:

- Return only days with sales: smaller payload, but less useful for trend analysis.

## Decision: Use gross amount fallback when acquired net amount is missing

**Rationale**: Manual/cash/local orders may not have acquired net amount. Treating missing net as zero would understate received revenue. The DRE already uses this fallback for received net reporting.

**Alternatives considered**:

- Require net amount for every order: too strict for manual/local sales.
- Exclude orders without net amount from net received: misleading for cash and local caixa.

## Decision: Export is deferred

**Rationale**: The first release focuses on on-screen daily and analytical decision support. Export can be added after users validate which columns and formats matter.

**Alternatives considered**:

- Build CSV export immediately: useful, but adds scope before the primary report layout is validated.
