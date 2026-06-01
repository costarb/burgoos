# Data Model: Cadastro de Lojas e Personalizacao Visual

## Tenant / Store

Represents a business operation using the platform.

**Fields**:

- `id`: stable identifier.
- `name`: internal/public store name.
- `slug`: unique public URL slug.
- `phone`: public/store contact phone.
- `active`: whether the store is allowed to operate on the platform.
- `isOpen`: whether the store is currently accepting public orders.
- `logoUrl`: optional published logo reference, or derived from the published visual configuration.
- `createdAt`, `updatedAt`: lifecycle timestamps.

**Validation rules**:

- `slug` is required, unique and lowercase.
- `slug` only allows letters, numbers and hyphen.
- `slug` cannot use reserved route names such as `admin`, `api`, `platform`, `login`, `pedido` or `checkout`.
- Deactivation prevents new public orders but preserves historical data.

**Relationships**:

- Has many users, categories, products, orders and existing tenant-scoped operational records.
- Has many visual configuration versions.
- Has at most one currently published visual configuration.

## Platform Administrator

Represents a user/capability allowed to create and manage stores across tenants.

**Fields**:

- `id`: stable identifier.
- `name`: administrator display name.
- `email`: unique login identifier.
- `active`: whether platform access is allowed.

**Validation rules**:

- Platform administrator access must not imply ownership of every tenant's operational data.
- Platform-wide store management actions must be logged.

## Store Responsible User

Represents the initial owner/admin user associated with a newly created store.

**Fields**:

- `id`: stable identifier.
- `tenantId`: store ownership boundary.
- `name`: responsible user's name.
- `email`: unique login identifier.
- `role`: owner/admin permission inside the store.
- `active`: whether user can access the store.

**Validation rules**:

- Email must be unique for login.
- Responsible user must be linked to the created store.
- Responsible user cannot access another store's records.

## Store Visual Configuration

Represents a draft or published visual identity for one store.

**Fields**:

- `id`: stable identifier.
- `tenantId`: owning store.
- `status`: `DRAFT`, `PUBLISHED` or `ARCHIVED`.
- `logoUrl`: optional logo reference.
- `primaryColor`: main brand color.
- `accentColor`: highlight/action color.
- `neutralTheme`: `LIGHT`, `DARK` or `SYSTEM_DEFAULT`.
- `layoutPreset`: selected approved layout.
- `createdByUserId`: user who created the version.
- `publishedByUserId`: user who published the version.
- `publishedAt`: publication timestamp.
- `createdAt`, `updatedAt`: lifecycle timestamps.

**Validation rules**:

- Colors must be valid hex colors.
- Published colors must meet readability rules for text and key actions.
- Published layout preset must be active.
- Only one configuration can be the current published configuration per store.
- Draft configurations do not affect public customer pages until published.

**State transitions**:

- `DRAFT` -> `PUBLISHED`: after validation and publication.
- `PUBLISHED` -> `ARCHIVED`: when a newer version is published or restored.
- `ARCHIVED` -> `PUBLISHED`: only through restore of a previous published version.

## Layout Preset

Represents an approved screen composition option.

**Fields**:

- `key`: stable preset key.
- `name`: user-facing label.
- `description`: when to use it.
- `targetSurface`: `PUBLIC_MENU`, `ADMIN_CUE` or both.
- `active`: whether the preset can be selected.

**Initial presets**:

- `classic`: familiar category-first menu.
- `compact`: denser menu for larger catalogs.
- `visual`: image-forward menu for brands with strong product photography.

## Launch Readiness State

Computed view that indicates whether a store can be safely launched.

**Checks**:

- Store has valid slug.
- Store is active.
- Responsible owner/admin exists.
- Public phone is present.
- Published or default visual configuration is available.
- Required setup warnings are visible but do not block historical access.
