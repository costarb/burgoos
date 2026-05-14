# Implementation Plan: Validação Delivery Real

**Branch**: `001-validacao-delivery-real` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-validacao-delivery-real/spec.md`

## Summary

Build the smallest production-capable delivery flow for one real pilot store: admin catalog, public menu, checkout, order queue, WhatsApp order summary and daily results. The implementation should be single-store friendly while preserving tenant-ready data boundaries.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, TailwindCSS, Socket.io

**Storage**: PostgreSQL; S3-compatible image storage or URL field during pilot

**Testing**: Unit/integration tests for backend; Playwright or equivalent E2E for pilot flow

**Target Platform**: Web application; mobile-first public menu; desktop/mobile admin

**Project Type**: Web app with API backend and frontend

**Performance Goals**: Public menu loads within 2 seconds for pilot catalog size; realtime order appears within 5 seconds while connected

**Constraints**: Must support real orders; total calculated server-side; tenant isolation must be preserved; WhatsApp is deep link only

**Scale/Scope**: One pilot store initially; data model supports multiple tenants later

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Scope is limited to pilot delivery operation.
- **TypeScript Strict By Default**: Pass. Stack is TypeScript-only.
- **Modular Monolith, Domain-Oriented**: Pass. Use domain modules inside API and feature slices in web.
- **Tenant Isolation Is A Design Constraint**: Pass. Data model includes tenant context even for one pilot store.
- **Tests Protect Operational Flow**: Pass. Checkout, order totals, inactive products, closed store, status transitions and E2E are required.

## Project Structure

### Documentation (this feature)

```text
specs/001-validacao-delivery-real/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── platform/
│   │   ├── catalog/
│   │   ├── ordering/
│   │   ├── operations/
│   │   └── management/
│   └── test/
└── web/
    ├── app/
    │   ├── (public-menu)/
    │   └── admin/
    ├── components/
    └── tests/

packages/
├── database/
├── types/
└── ui/
```

**Structure Decision**: Use monorepo with `apps/api`, `apps/web` and shared packages. Keep domains explicit in the API so pilot logic can become SaaS modules later without a rewrite.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Build pilot as tenant-ready single-store.
- Defer online payments and WhatsApp API.
- Recalculate all totals on backend.
- Use realtime only for admin order updates.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Tenant fields in pilot | Avoids rework when moving from one pilot store to SaaS | Pure single-store schema would make later migration risky |
| Realtime order queue | Real operation needs immediate order visibility | Polling is simpler but risks delayed order handling during pilot |
