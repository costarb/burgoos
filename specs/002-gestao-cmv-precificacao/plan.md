# Implementation Plan: Gestao de CMV, Precificacao e Estoque

**Branch**: `002-gestao-cmv-precificacao` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-gestao-cmv-precificacao/spec.md`

## Summary

Evolve the delivery pilot into an operational profitability module: tenant-scoped financial configuration, domain maintenance screens, suppliers, purchase units, order platforms, ingredients, technical sheets, CMV calculation, channel-based price simulation, estimated stock reservation/consumption from in-progress orders, DRE, dashboard and menu engineering. The implementation extends the existing modular monolith with Management and Operations domains while preserving product/order snapshots for historical accuracy.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, Socket.io

**Storage**: PostgreSQL through Prisma; all new business data tenant-scoped

**Testing**: Vitest unit/integration tests for API and calculation services; focused web tests where form behavior is non-trivial; E2E coverage for setup -> recipe -> order -> stock/DRE flow

**Target Platform**: Web application for admin/owner/operator usage; mobile-friendly read views where useful, desktop-first for maintenance and analysis screens

**Project Type**: Web app with API backend and frontend in the existing monorepo

**Performance Goals**: Stock reservation visible within 5 seconds of an in-progress order; CMV/price recalculation visible immediately after saving relevant inputs; dashboard period summaries respond within 2 seconds for pilot-scale data

**Constraints**: Tenant isolation; strict typing; historical order profitability snapshots must not be rewritten by later cost/config changes; estimated operational stock only, not fiscal inventory/accounting-grade valuation

**Scale/Scope**: One pilot store initially; model supports multiple tenants; pilot catalog scale around 10-100 products, 50-300 ingredients, and daily order volumes suitable for a small delivery operation

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Real Operation First**: Pass. The feature expands the pilot with profitability and stock controls needed by the same real delivery operation, without adding broad SaaS billing/onboarding.
- **TypeScript Strict By Default**: Pass. All application and shared contracts remain TypeScript-first with validation at external inputs.
- **Modular Monolith, Domain-Oriented**: Pass. New behavior is organized into financial/stock/profitability modules inside the current monolith, not separate services.
- **Tenant Isolation Is A Design Constraint**: Pass. Every new entity that belongs to the store carries tenant ownership and admin routes derive tenant from authenticated context.
- **Tests Protect Operational Flow**: Pass. Required tests cover CMV, price simulation, stock reservation/release, DRE, tenant scoping and the end-to-end profitability flow.

## Project Structure

### Documentation (this feature)

```text
specs/002-gestao-cmv-precificacao/
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
|   |   |-- management/
|   |   |   |-- domains/
|   |   |   |-- financial/
|   |   |   |-- pricing/
|   |   |   `-- reports/
|   |   |-- operations/
|   |   |   `-- inventory/
|   |   |-- catalog/
|   |   |-- ordering/
|   |   `-- platform/
|   `-- test/
|       |-- profitability.spec.ts
|       |-- inventory.spec.ts
|       `-- profitability-flow.e2e.spec.ts
`-- web/
    |-- app/
    |   `-- admin/
    |       |-- settings/
    |       |-- suppliers/
    |       |-- purchase-units/
    |       |-- order-platforms/
    |       |-- ingredients/
    |       |-- technical-sheets/
    |       |-- pricing/
    |       |-- inventory/
    |       |-- reports/
    |       `-- menu-engineering/
    `-- lib/
        `-- api.ts

packages/
|-- database/
|   `-- prisma/
|-- types/
`-- ui/
```

**Structure Decision**: Use the existing monorepo and modular monolith. Financial configuration, domains, pricing and DRE live under `management`; stock reservation and movements live under `operations/inventory`; order creation/status changes integrate with inventory and profitability snapshot services.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Treat stock as estimated operational stock, with reservation/consumption movements tied to order lifecycle.
- Preserve delivered order profitability through snapshots.
- Use tenant-maintained domain tables for units, suppliers and order platforms.
- Calculate price recommendations per channel/platform because fee structures differ.
- Prevent packaging double counting by allowing either average packaging or explicit packaging components.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. Quickstart validates a real owner/operator flow, not abstract accounting.
- **TypeScript Strict By Default**: Pass. API contracts and entities make external payloads explicit.
- **Modular Monolith, Domain-Oriented**: Pass. Source layout preserves domain ownership.
- **Tenant Isolation Is A Design Constraint**: Pass. Data model marks tenant-owned entities and validation rules.
- **Tests Protect Operational Flow**: Pass. Plan requires calculation, stock lifecycle, DRE and E2E tests before launch.

## Complexity Tracking

| Violation                                           | Why Needed                                                                                             | Simpler Alternative Rejected Because                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Advanced stock control promoted from deferred scope | User explicitly promoted stock reservation/estimated stock from spreadsheet analysis into this feature | Leaving stock deferred would make CMV/DRE useful but operationally incomplete for the requested evolution |
