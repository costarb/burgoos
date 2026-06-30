# Data Model: Filtros de Pesquisa em Contas a Pagar

## Payable

Represents one payable obligation shown in the accounts-payable search.

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Existing identifier |
| `tenantId` | UUID | Resolved from authenticated context; never accepted from query params |
| `categoryId` | UUID | Required; filters by exact category within tenant |
| `supplierId` | UUID, nullable | Optional; filters by exact supplier within tenant |
| `competenceDate` | Date, nullable | Source for Mes de referencia filter |
| `dueDate` | Date | Existing `start`/`end` filters continue to use due date |
| `status` | Derived enum | Filtered after status calculation as today |

### Query Rules

- `categoryId` matches `Payable.categoryId`.
- `supplierId` matches `Payable.supplierId`; empty means all suppliers, including payables without supplier.
- `competenceMonth` uses `Payable.competenceDate`.
- `start` and `end` keep filtering `Payable.dueDate`.
- All query conditions are combined with AND.
- Results remain ordered by due date ascending, then creation date ascending.

## FinancialCategory

Represents an option for the Categoria filter.

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Used as `categoryId` query value |
| `tenantId` | UUID | Must match authenticated tenant |
| `name` | String | Display label |
| `active` | Boolean | Only active categories appear in filter options |

## Supplier

Represents an option for the Fornecedor filter.

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | UUID | Used as `supplierId` query value |
| `tenantId` | UUID | Must match authenticated tenant |
| `name` | String | Display label |
| `active` | Boolean | Only active suppliers appear in filter options |

## PayablesFilters

Shared filter shape used by the web client and API helper.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `start` | ISO date | No | Existing due-date lower bound |
| `end` | ISO date | No | Existing due-date upper bound |
| `status` | PayableStatus | No | Existing derived status filter |
| `categoryId` | UUID | No | New visible Categoria filter |
| `supplierId` | UUID | No | New visible Fornecedor filter |
| `competenceMonth` | `YYYY-MM` | No | New Mes de referencia filter |

## Validation Rules

- Invalid UUID values for `categoryId` or `supplierId` are rejected by request validation.
- Invalid `competenceMonth` values are rejected by request validation.
- `competenceMonth` does not match payables with null `competenceDate`.
- Clearing filters sends no value for empty fields.
- Options returned to the UI are limited to active records in the authenticated tenant.

## State Transitions

No new payable state transitions are introduced. Filtering does not alter payable status, payment history, cancellation state or audit history.
