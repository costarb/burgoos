# Implementation Plan: Relatorios de Vendas e Pedidos

**Branch**: `004-relatorios-vendas-pedidos` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-relatorios-vendas-pedidos/spec.md`

## Summary

Create an admin reports module focused on sales/orders. The first increment adds a period-based sales report with daily evolution, filters by payment institution/method/channel/status, analytical order drill-down, summaries by payment and channel dimensions, and a visual daily evolution chart. The implementation reuses existing order, payment reconciliation, platform and profitability data introduced in the CMV/DRE feature; no new persistence entity is required for the first release.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS

**Storage**: PostgreSQL through Prisma; report data is read from existing tenant-scoped orders, order items, order platforms and payment reconciliation fields

**Testing**: Vitest unit/integration tests for report aggregation and tenant filtering; focused web tests for filter behavior if non-trivial

**Target Platform**: Admin web application for owner/manager usage, desktop-first with responsive table and chart behavior

**Project Type**: Web app with API backend and frontend in the existing monorepo

**Performance Goals**: Pilot-scale report queries respond within 2 seconds for monthly ranges; analytical list remains usable with pagination for high-volume periods

**Constraints**: Tenant isolation; strict typing; local business-date grouping; cancelled/non-delivered orders excluded from realized sales by default; existing DRE semantics must not be changed

**Scale/Scope**: One pilot store initially, with month-level periods, tens to hundreds of daily orders, and report dimensions for payment institution, payment method and order platform

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Real Operation First**: Pass. The report answers immediate operational questions for the real food truck/pilot: daily movement, received net amounts, fees and analytical order traceability.
- **TypeScript Strict By Default**: Pass. Shared report contracts will be represented in `packages/types` and external query parameters validated at API boundaries.
- **Modular Monolith, Domain-Oriented**: Pass. Sales reporting belongs in the existing Management/Reports domain, not a separate service.
- **Tenant Isolation Is A Design Constraint**: Pass. All report queries derive tenant from authenticated admin context and filter tenant-owned orders.
- **Tests Protect Operational Flow**: Pass. Report totals, date grouping, filters and tenant scoping are critical and require tests before release.

## Project Structure

### Documentation (this feature)

```text
specs/004-relatorios-vendas-pedidos/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   |-- src/
|   |   `-- management/
|   |       `-- reports/
|   |           |-- sales-report.controller.ts
|   |           |-- sales-report.service.ts
|   |           `-- sales-report.types.ts
|   `-- test/
|       |-- sales-report.spec.ts
|       `-- sales-report.integration.spec.ts
`-- web/
    |-- app/
    |   `-- admin/
    |       `-- reports/
    |           `-- sales/
    |               |-- page.tsx
    |               `-- sales-report-client.tsx
    `-- lib/
        `-- api.ts

packages/
`-- types/
    `-- src/index.ts
```

**Structure Decision**: Use the existing monorepo and Management reports module. The API exposes admin report endpoints, `packages/types` carries shared contracts, and the web app adds a focused admin sales report route.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Reuse existing `orders` and reconciliation fields rather than adding report tables.
- Group by local business day, not UTC day, to match DRE and sales operations.
- Provide daily summary and analytical list through separate endpoint views to keep the UI responsive.
- Include zero-sale days in the daily evolution so trends are visually honest.
- Render the first daily evolution chart from the existing daily summary payload so the API contract and database model do not need to change.
- Prefer a lightweight in-app chart implementation for the first release unless richer interactions become necessary later.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. The quickstart validates the daily sales and analytical report against imported PagBank/Mercado Pago data already used by the pilot.
- **TypeScript Strict By Default**: Pass. API and web contracts are explicit and typed.
- **Modular Monolith, Domain-Oriented**: Pass. Reporting remains in `management/reports`.
- **Tenant Isolation Is A Design Constraint**: Pass. The data model and contract require authenticated tenant scoping.
- **Tests Protect Operational Flow**: Pass. Test coverage is planned for totals, filters, empty periods, date grouping and tenant isolation.

## Complexity Tracking

No constitution violations.
