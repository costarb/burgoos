# Implementation Plan: Operacoes Financeiras e Experiencia Administrativa

**Branch**: `006-financial-operations-ux` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-financial-operations-ux/spec.md`

## Summary

Evoluir a experiencia administrativa e criar uma visao operacional de tesouraria. A entrega adiciona um app shell responsivo, feedback padronizado para operacoes, labels no grafico de vendas, contas a pagar e controle de caixa atual/projetado. O caixa sera um read model calculado a partir de recebimentos de pedidos, pagamentos de contas e movimentos manuais auditaveis, evitando persistir eventos projetados ou duplicar valores realizados.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, React Query

**Storage**: PostgreSQL through Prisma; all financial records are tenant-scoped

**Testing**: Vitest unit/integration tests for financial rules and API behavior; focused web tests for feedback/navigation/chart behavior; Playwright E2E for payable-to-cash flow

**Target Platform**: Responsive admin web application for owner/administrator usage

**Project Type**: Web app with API backend and frontend in the existing monorepo

**Performance Goals**: Admin navigation responds immediately; monthly payable and cash-flow queries respond within 2 seconds at pilot scale; operation state feedback appears within 300 ms

**Constraints**: Tenant isolation; strict typing; immutable financial audit history; no double counting between projected and realized values; responsive layouts; no bank integration in this increment

**Scale/Scope**: One pilot store initially; dozens of admin screens; hundreds of monthly orders and financial events; model remains multi-tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Accounts payable and cash projection address the pilot's immediate need to understand available and future money.
- **TypeScript Strict By Default**: Pass. Financial DTOs, shared contracts and operation-feedback states will be explicitly typed.
- **Modular Monolith, Domain-Oriented**: Pass. Treasury behavior remains in Management/Financial and composes existing Ordering data.
- **Tenant Isolation Is A Design Constraint**: Pass. Every persisted financial entity includes tenant ownership and every query resolves tenant from authenticated context.
- **Tests Protect Operational Flow**: Pass. The plan requires tests for payable lifecycle, cash composition, transfers, reversals, feedback and cross-tenant denial.

## Project Structure

### Documentation (this feature)

```text
specs/006-financial-operations-ux/
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
|   |       |-- financial/
|   |       |   |-- accounts-payable/
|   |       |   |-- cash-flow/
|   |       |   `-- financial-audit.service.ts
|   |       `-- reports/
|   |           `-- sales-report.service.ts
|   `-- test/
|       |-- accounts-payable.spec.ts
|       |-- cash-flow.spec.ts
|       `-- financial-flow.e2e.spec.ts
`-- web/
    |-- app/
    |   `-- admin/
    |       |-- layout.tsx
    |       |-- finance/
    |       |   |-- payables/
    |       |   `-- cash-flow/
    |       `-- reports/sales/
    `-- components/admin/
        |-- admin-shell.tsx
        |-- operation-feedback.tsx
        `-- submit-button.tsx

packages/
|-- database/
|   `-- prisma/
|-- types/
`-- ui/
```

**Structure Decision**: Preserve the existing monorepo and modular monolith. Financial write models and cash composition live under `management/financial`; sales labels remain in the existing sales report UI; reusable admin-shell and operation-feedback components live in the web application and generic primitives remain in `packages/ui`.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Build a persistent responsive admin shell with route-grouped navigation instead of isolated page links.
- Standardize operation communication through a shared state contract and reusable feedback/submit components.
- Treat accounts payable, payable payments and manual cash movements as separate auditable write models.
- Calculate cash position as a read model composed from released order receipts, payable payments and manual movements.
- Derive projected events at query time instead of persisting them.
- Map payment institutions to financial accounts and expose an unallocated bucket when mapping is absent.
- Keep the existing lightweight chart and add collision-aware labels rather than adding a chart dependency.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. Quickstart validates actual payable registration, payment and cash projection for the pilot.
- **TypeScript Strict By Default**: Pass. Contracts define explicit financial states, amounts and operation outcomes.
- **Modular Monolith, Domain-Oriented**: Pass. Design adds no service boundary and composes current domains transactionally.
- **Tenant Isolation Is A Design Constraint**: Pass. Data model, queries and contracts require tenant-scoped ownership.
- **Tests Protect Operational Flow**: Pass. Design covers lifecycle transitions, no-double-counting, reversals, responsive navigation and feedback.

## Complexity Tracking

No constitution violations.
