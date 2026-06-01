# Research: Cadastro de Lojas e Personalizacao Visual

## Decision: Store onboarding starts as internal platform-admin workflow

**Rationale**: The current product is still validating real delivery operations. Internal setup lets the team add new stores safely while avoiding public signup, billing, verification, abuse prevention and plan management.

**Alternatives considered**:

- Public self-service signup: deferred because it requires account verification, anti-abuse controls and commercial flows.
- Seed/script-only setup: rejected because it keeps every new store dependent on technical intervention.

## Decision: Introduce explicit platform administration capability

**Rationale**: Existing users are tenant-scoped. A user who can create stores needs platform-wide permission that is separate from store owner/operator permissions, otherwise tenant isolation becomes ambiguous.

**Alternatives considered**:

- Reuse OWNER role for store creation: rejected because OWNER should only administer one store.
- Special seed-only admin script: rejected because it does not provide the requested screen-based workflow.

## Decision: Store identity extends existing tenant concept

**Rationale**: The current schema already uses Tenant for store identity, public slug and active/open state. The feature should extend that concept rather than creating a parallel "Store" root entity.

**Alternatives considered**:

- Separate Store model unrelated to Tenant: rejected because catalog, orders, stock and financial data already scope to Tenant.
- Store data entirely inside generic config JSON: rejected because launch readiness, search, validation and reporting need explicit fields.

## Decision: Visual settings are versioned as draft and published configurations

**Rationale**: Draft/publish supports preview before customer impact and enables restoration of the latest published state. This reduces risk when changing colors, logo or layout.

**Alternatives considered**:

- Single mutable branding record: simpler but no safe preview/restore path.
- Full audit/event sourcing: too heavy for the first version.

## Decision: Layout customization uses approved presets

**Rationale**: Presets allow store-level visual differentiation while preserving usability, mobile behavior and operational consistency.

**Alternatives considered**:

- Free-form page builder: rejected because it increases risk of broken menus and requires broader design/tooling work.
- No layout option: rejected because the user explicitly asked for layout configurability if possible.

## Decision: Logo starts as URL/asset reference with validation

**Rationale**: Existing product images already support image URLs, and the constitution allows local fallback with later S3-compatible storage. A logo URL or managed asset reference gives a pragmatic v1 while keeping future upload storage possible.

**Alternatives considered**:

- Require full upload/storage workflow first: deferred because it is useful but not required to validate onboarding and branding.
- Embed binary image data in store configuration: rejected due to size, caching and maintainability concerns.

## Decision: Validate contrast before publication

**Rationale**: Store-defined colors can easily make text/actions unreadable. Contrast checks protect customer checkout and operator workflows.

**Alternatives considered**:

- Let users choose any colors: rejected because it can break readability.
- Limit to a fixed palette only: deferred; presets plus validation offer more flexibility for real brands.
