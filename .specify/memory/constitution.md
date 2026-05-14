# BurgoOS Constitution

## Core Principles

### I. Real Operation First

The first milestone is validating a real delivery operation, not building every SaaS module upfront. Features must prove value for one real food business before being generalized. Multi-tenant SaaS concerns are allowed when they avoid rework, but they must not block the pilot flow: publish menu, receive order, operate kitchen/delivery, and review daily results.

### II. TypeScript Strict By Default

All application code must be written in TypeScript with strict typing enabled. Shared contracts between frontend, backend, database and tests must be explicit. Avoid untyped payloads at service boundaries; external inputs must be validated before use.

### III. Modular Monolith, Domain-Oriented

The system starts as a modular monolith organized by business domains: Platform, Customer Experience, Operations, and Management. Feature slices should cross UI, API and persistence when needed. Avoid premature microservices and avoid organizing business logic only by technical layers.

### IV. Tenant Isolation Is A Design Constraint

The pilot may run with one real store, but the architecture must remain SaaS-ready. Tenant-owned data must include `tenant_id`, admin operations must resolve tenant from authenticated context, and public operations must resolve tenant from slug. Cross-tenant access must be blocked and tested.

### V. Tests Protect Operational Flow

Critical behavior must have tests before launch: checkout rules, server-side order totals, store open/closed handling, inactive products, order status transitions and tenant isolation. E2E coverage is required for the first real validation flow: create catalog, place order, receive/manage order.

## Product Scope Rules

### MVP Includes

The MVP includes only what is needed to operate a real delivery pilot:

*   Store setup for one pilot operation.
*   Public digital menu by slug.
*   Category and product management.
*   Local cart and checkout.
*   Delivery or pickup selection.
*   Informational payment method: cash, manual PIX or card on delivery.
*   Order creation and admin order queue.
*   Order status updates.
*   Visual/sound alert for new orders.
*   WhatsApp deep link with order summary.
*   Basic daily summary: order count and gross revenue.

### Explicitly Deferred

These items are post-MVP unless a new specification promotes them:

*   Online payment integration.
*   WhatsApp Cloud API, chatbot or AI assistant.
*   Fiscal/NF-e features.
*   Advanced stock control.
*   Loyalty, coupons and campaigns.
*   Marketplace integrations.
*   Multi-store/franchise operations.
*   Delivery driver dispatch.
*   Tables/commands/POS cashier.
*   Thermal printing, unless the real pilot proves it is a launch blocker.

## Technical Standards

*   Backend: NestJS, Prisma ORM and PostgreSQL.
*   Frontend: Next.js App Router, TailwindCSS and React Query or framework-native data fetching where appropriate.
*   API: REST with OpenAPI documentation for public and admin endpoints.
*   Realtime: Socket.io for admin order updates.
*   Storage: S3-compatible object storage for product images, with a local development fallback.
*   Auth: JWT with refresh token for admin users.
*   Formatting: ESLint and Prettier.
*   Observability: structured logs for tenant resolution, order creation, checkout rejection and status changes.

## Quality Gates

Before implementation:

*   The active feature must have `spec.md`, `plan.md` and `tasks.md`.
*   User stories must be independently testable and prioritized.
*   Scope must clearly separate MVP from post-MVP.
*   Data model and API contracts must be explicit for the feature.

Before pilot launch:

*   E2E happy path passes.
*   Store closed checkout rejection passes.
*   Inactive product hidden/rejected behavior passes.
*   Cross-tenant access tests pass, if more than one tenant exists in test data.
*   Public menu is usable on mobile and loads within the MVP performance target.

## Governance

This constitution supersedes older draft documents when there is a conflict. Changes to MVP scope require updating the feature specification, implementation plan and task list together. If implementation reveals a mismatch with the spec, update the spec artifacts before continuing.

**Version**: 1.0.0 | **Ratified**: 2026-05-13 | **Last Amended**: 2026-05-13
