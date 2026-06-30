# Implementation Plan: Cadastro de Lojas e Personalizacao Visual

**Branch**: `003-store-onboarding-branding` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-store-onboarding-branding/spec.md`

## Summary

Add a controlled platform-admin onboarding flow for new stores/tenants, plus store-owned visual identity settings for logo, colors and approved layout presets. The implementation extends the existing tenant-ready modular monolith: platform-level store setup creates the tenant and responsible owner, while tenant-scoped branding/layout settings are exposed to public menu pages and lightweight admin identity cues.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, Socket.io

**Storage**: PostgreSQL through Prisma for store/setup/branding metadata; existing image URL handling for logo in v1, compatible with later S3-compatible storage

**Testing**: Vitest unit/integration tests for API validation, tenant isolation and branding publication; focused web tests for onboarding and branding forms; E2E coverage for create store -> login as owner -> publish branded menu

**Target Platform**: Web application for platform administrators, store owners/operators and public customers; mobile-first public menu and desktop-first setup/admin screens

**Project Type**: Web app with API backend and frontend in the existing monorepo

**Performance Goals**: Newly created store is usable immediately after save; published visual changes appear on public store pages within 30 seconds; public menu remains within the existing 2 second pilot load target

**Constraints**: Tenant isolation; strict typing; no public self-service signup in v1; no free-form page builder; branding must preserve readable contrast; deactivating a store must not delete historical data

**Scale/Scope**: Internal setup for multiple pilot stores; expected early scale is tens of stores, each with one owner at creation and existing catalog/order/profitability data scoped by tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. The feature removes manual seed/script work needed to add real stores and improves customer-facing trust through store branding.
- **TypeScript Strict By Default**: Pass. Store setup, visual configuration and shared contracts remain explicit and validated.
- **Modular Monolith, Domain-Oriented**: Pass. Platform-owned onboarding belongs in the Platform domain; store-owned branding integrates with Customer Experience and Management without a new service.
- **Tenant Isolation Is A Design Constraint**: Pass. Store setup creates tenant-owned boundaries, and branding/configuration access must be scoped to the authenticated tenant except platform-admin setup operations.
- **Tests Protect Operational Flow**: Pass. Required tests cover store creation, owner login, slug uniqueness, inactive store behavior, branding publication and cross-store rejection.

## Project Structure

### Documentation (this feature)

```text
specs/003-store-onboarding-branding/
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
|   |   |-- platform/
|   |   |   |-- stores/
|   |   |   |-- tenant/
|   |   |   `-- auth/
|   |   |-- customer-experience/
|   |   |   `-- branding/
|   |   |-- catalog/
|   |   |-- ordering/
|   |   |-- operations/
|   |   `-- management/
|   `-- test/
|       |-- store-onboarding.integration.spec.ts
|       |-- store-branding.integration.spec.ts
|       `-- store-onboarding-flow.e2e.spec.ts
`-- web/
    |-- app/
    |   |-- platform/
    |   |   `-- stores/
    |   |-- admin/
    |   |   `-- branding/
    |   `-- (public-menu)/
    |       `-- [slug]/
    |-- components/
    `-- lib/

packages/
|-- database/
|   `-- prisma/
|-- types/
`-- ui/
```

**Structure Decision**: Use the existing monorepo and modular monolith. Store creation and platform-admin controls live under `platform`; store-owned branding/layout settings are exposed through admin screens and consumed by the public menu. Shared DTOs/types live in `packages/types` only when used across app boundaries.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Use internal platform-admin store setup for v1, not public signup.
- Introduce an explicit platform administration capability rather than overloading tenant owner permissions.
- Store visual customization as versioned draft/published configuration.
- Start layout customization with approved presets.
- Use URL-based logo metadata in v1 while staying compatible with future managed uploads.
- Validate color contrast before publication.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. Quickstart validates onboarding a real store and publishing a branded menu, then confirms existing ordering remains usable.
- **TypeScript Strict By Default**: Pass. Contracts define store, branding, layout and readiness payloads explicitly.
- **Modular Monolith, Domain-Oriented**: Pass. Platform setup and customer branding are separated by domain while staying in the monolith.
- **Tenant Isolation Is A Design Constraint**: Pass. Data model marks tenant-owned branding and tests require cross-store rejection.
- **Tests Protect Operational Flow**: Pass. Plan requires E2E create store -> owner login -> public menu access, plus inactive store and tenant-isolation tests.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Multi-store setup promoted from deferred scope | The product now needs to configure additional real stores without manual database changes | Keeping tenants seed-only blocks real pilot expansion and makes support/error recovery technical-only |
| Platform administration capability | Store owners cannot safely create or manage other stores | Reusing tenant OWNER for platform-wide setup would violate tenant isolation and permission boundaries |
