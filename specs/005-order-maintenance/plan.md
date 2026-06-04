# Implementation Plan: Manutencao Auditavel de Pedidos

**Branch**: `005-order-maintenance` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-order-maintenance/spec.md`

## Summary

Adicionar manutencao auditavel para pedidos ativos e finalizados. A solucao amplia o dominio de Ordering com edicao transacional, exclusao logica, controle otimista de concorrencia e trilha imutavel de auditoria. Correcoes reconciliam reservas/consumos de estoque e recriam snapshots de rentabilidade quando necessario; relatorios e visoes operacionais ignoram pedidos excluidos por padrao.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, Socket.io

**Storage**: PostgreSQL through Prisma; pedidos, auditorias e efeitos derivados permanecem tenant-scoped

**Testing**: Vitest unit/integration tests for validation, optimistic locking, inventory reconciliation, profitability recalculation and tenant isolation; focused web tests for edit/delete confirmation flows; E2E maintenance flow

**Target Platform**: Web application for authenticated store administrators; desktop-first maintenance experience with responsive support

**Project Type**: Web app with API backend and frontend in the existing monorepo

**Performance Goals**: Open an order for maintenance within 2 seconds and complete a standard edit/delete within 3 seconds at pilot scale

**Constraints**: Tenant isolation; strict typing; audit records are immutable; no partial maintenance effects; deleted orders remain available only to maintenance/audit queries; historical external payment identifiers remain reserved

**Scale/Scope**: One pilot store initially; model supports multiple tenants; up to hundreds of daily orders and dozens of maintenance operations per day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. The feature addresses corrections and duplicates observed in the real operation and imported sales workflow.
- **TypeScript Strict By Default**: Pass. Edit/delete inputs, audit snapshots and responses will use explicit shared contracts and validated DTOs.
- **Modular Monolith, Domain-Oriented**: Pass. Order maintenance remains in Ordering and coordinates existing Inventory and Management services inside the monolith.
- **Tenant Isolation Is A Design Constraint**: Pass. Every lookup, mutation and audit query is tenant-scoped and actor identity comes from authenticated context.
- **Tests Protect Operational Flow**: Pass. The plan requires tests for active/finalized edits, deletion, compensation, concurrency and cross-tenant denial.

## Project Structure

### Documentation (this feature)

```text
specs/005-order-maintenance/
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
|   |   |-- ordering/
|   |   |   |-- dto/
|   |   |   |-- admin-order.controller.ts
|   |   |   |-- order-maintenance.service.ts
|   |   |   `-- ordering.service.ts
|   |   |-- operations/
|   |   |   `-- inventory/
|   |   |       `-- inventory.service.ts
|   |   `-- management/
|   |       `-- reports/
|   |           |-- order-profitability.service.ts
|   |           |-- sales-report.service.ts
|   |           `-- dre.service.ts
|   `-- test/
|       |-- order-maintenance.spec.ts
|       |-- order-maintenance.integration.spec.ts
|       `-- order-maintenance-flow.e2e.spec.ts
`-- web/
    |-- app/
    |   `-- admin/
    |       `-- orders/
    |           |-- orders-client.tsx
    |           `-- order-maintenance-dialog.tsx
    `-- lib/
        `-- api.ts

packages/
|-- database/
|   `-- prisma/
|       |-- schema.prisma
|       `-- migrations/
`-- types/
    `-- src/index.ts
```

**Structure Decision**: Extend the existing Ordering feature slice. A dedicated order maintenance service owns transaction orchestration and audit creation, while Inventory and Management services expose transaction-aware reconciliation helpers. The existing admin orders page gains maintenance actions rather than introducing a disconnected module.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Use logical deletion fields on Order instead of a new order status or physical deletion.
- Persist immutable before/after JSON snapshots in a dedicated order maintenance audit entity.
- Use `updatedAt` as an optimistic concurrency token supplied by the client.
- Reconcile inventory with compensating movements; never rewrite or delete historical movements.
- Replace delivered-order profitability snapshots transactionally after an edit and remove their effect after logical deletion.
- Restrict maintenance mutations to OWNER and ADMIN roles.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. Quickstart validates correction of imported and operational orders with visible financial results.
- **TypeScript Strict By Default**: Pass. Contract defines explicit edit, delete, audit and conflict responses.
- **Modular Monolith, Domain-Oriented**: Pass. Transaction orchestration stays in Ordering and delegates calculations to current domain services.
- **Tenant Isolation Is A Design Constraint**: Pass. Data model and contracts require tenant-scoped access and actor identity.
- **Tests Protect Operational Flow**: Pass. Design includes active/delivered/cancelled/deleted orders, rollback, concurrency and tenant isolation.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
