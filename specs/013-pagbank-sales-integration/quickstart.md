# Quickstart: Integracao de Vendas PagBank

## Prerequisites

- Node.js 20+ and npm 10.
- PostgreSQL available through the existing Docker Compose setup.
- Existing project dependencies installed.
- A tenant admin with `orders.manage`; implementation adds `integrations.sales.view` and `integrations.sales.manage` to the permission catalog and seed defaults.
- No real PagBank token is required for automated development tests.

## Environment

Configure an authenticated encryption key for integration credentials:

```text
INTEGRATION_SECRET_KEY=<32-byte-key-encoded-as-base64>
```

Development may retain the documented local fallback. Staging and production must fail startup or integration activation when the key is absent/invalid. PagBank USER/TOKEN are stored through the admin screen/API and must not be placed in committed `.env` files.

## Database setup

```powershell
npm.cmd run db:up
.\node_modules\.bin\prisma.cmd migrate dev --schema packages\database\prisma\schema.prisma
.\node_modules\.bin\prisma.cmd generate --schema packages\database\prisma\schema.prisma
npm.cmd run db:seed
```

Expected migration additions:

- Sales integration and encrypted credential tables.
- Import run, per-day result, external movement and durable external identity tables.
- Tenant, actor and order relations/indexes.
- Permission seed entries for viewing/managing sales integrations.

## Fixture-driven validation before receiving the token

Create sanitized fixtures from the PagBank documentation for the applicable sale cases:

- Credit, installment credit and seller/buyer installment plans.
- PIX, debit and boleto.
- Split sale.
- Cancellation, chargeback and unknown event examples to prove they do not create orders.
- Pagination with more than one page.
- `VALIDADO=TRUE`, `FALSE` and absent header variants.

Fixtures must contain no real customer/store credentials. Adapter HTTP tests should mock `fetch`, including response headers and status codes.

## Run automated checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test --workspace @burgoos/api
npm.cmd run test --workspace @burgoos/web
.\node_modules\.bin\prisma.cmd validate --schema packages\database\prisma\schema.prisma
```

Critical assertions:

1. A 31-day period produces one PagBank request sequence per eligible date.
2. Every page is collected before a day becomes `READY`.
3. `VALIDADO=FALSE` or missing blocks the entire day.
4. Current/future dates are blocked without a provider call.
5. Repeating a run or importing the same external ID from CSV creates no duplicate order.
6. A malformed movement is rejected without rolling back valid movements.
7. Cancellation/chargeback/adjustment events create no order.
8. Credential values never appear in response, logs, audits or serialized errors.
9. A user cannot access another tenant's integration, run or movement, even by UUID.
10. Two concurrent confirmations still produce one external identity and one order.

## Manual local flow with fixtures

1. Start API and web using the existing `dev` scripts.
2. Sign in as a tenant administrator.
3. Open Orders > Import and choose external integration.
4. Create a PagBank draft integration using a fixture-mode adapter in local development only.
5. Enter a closed period and select the historical item strategy.
6. Start preview and poll until `PREVIEW_READY` or `PARTIALLY_READY`.
7. Inspect new, duplicate, rejected and blocked-day counts.
8. Confirm the run and verify imported orders and run history.
9. Confirm the same run again and verify zero duplicates.

## Controlled production smoke test after token delivery

1. Confirm the credential is the EDI API token and record the PagBank USER/establishment ID.
2. Use a tenant dedicated to the real store and a short, already closed period.
3. Save the token through the write-only credential endpoint; verify retrieval returns only `hasCredential`/fingerprint.
4. Preview one D-1 date and confirm the day is importable only with `VALIDADO=TRUE`.
5. Compare counts and a small sample with the PagBank portal before confirmation.
6. Confirm import once, rerun the same date and verify all prior sales are duplicates.
7. Review structured logs and database records to confirm no USER/TOKEN leakage.

Do not call real PagBank endpoints from automated CI. They expose real operations and there is no sandbox.

## Validation evidence — 2026-07-18

Fixture-driven implementation validation was completed without a real PagBank credential:

- Prisma schema validation: passed.
- Prisma Client generation: passed with Prisma 5.22.0.
- API TypeScript typecheck: passed.
- Web TypeScript typecheck: passed.
- API lint: passed.
- Sales integration API suite: 15 files and 50 tests passed.
- Sales integration web suite: 6 files and 7 tests passed.
- The 31,000-movement reconciliation test completed in 867 ms, below the 10-second test budget.
- HTTP contract tests covered configuration, write-only credentials, preview start/polling, repeated confirmation, history and tenant propagation from authentication.
- Fixture/provider tests covered PagBank mapping, pagination/error categories, `VALIDADO`, blocked days, persisted redacted payloads, idempotent identity conflicts, retries and the simulated alternate channel.

The fixture-driven operational flow was exercised through the HTTP and UI component suites: configure a tenant integration, store the write-only token, start and poll a preview, inspect ready/blocked outcomes, confirm twice and inspect history/result groups. No real PagBank endpoint was called.

Known repository-wide validation note: `npm.cmd run lint --workspace=@burgoos/web` still reports three preexisting issues outside this feature (`orders-client.tsx`, `platform-users.spec.tsx` and `admin-shell.tsx`). The files added or changed for the sales integration pass typecheck and their focused tests.

Production smoke remains intentionally pending until the EDI USER/TOKEN is available. When received, follow “Controlled production smoke test after token delivery” above using one closed D-1 date and compare the preview with the PagBank portal before confirmation.
