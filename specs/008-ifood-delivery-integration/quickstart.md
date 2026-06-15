# Quickstart: iFood Delivery Integration

This quickstart validates the first releasable slice for the pilot store: configure iFood, validate merchant access, simulate event ingestion, create an internal order, confirm it, evolve status, and inspect health/audit.

## Prerequisites

- Current branch: `008-ifood-delivery-integration`
- Local PostgreSQL running through Docker
- Database migrated and seeded
- Admin user with permissions to manage integrations and orders for the pilot store
- iFood sandbox/homologation credentials, or mocked iFood adapter enabled for local tests

## Local Setup

```powershell
npm ci
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:generate
```

Run API and web:

```powershell
npm run dev --workspace @burgoos/api
npm run dev --workspace @burgoos/web
```

## Manual Validation Flow

1. Login as an admin user with access to the pilot store.
2. Open `Admin > Integracoes > Delivery`.
3. Create an iFood integration for the active store:
   - provider: `IFOOD`
   - display name: `iFood`
   - external merchant id: sandbox or homologation merchant
   - order platform: existing or newly created iFood `OrderPlatform`
4. Save credentials. Confirm that no secret value is shown after saving.
5. Run validation.
   - Expected: credentials valid, merchant accessible, merchant status visible, integration ready or pending propagation.
6. Activate the integration.
7. Trigger mocked or sandbox polling for a new iFood order event.
8. Confirm that:
   - inbound event is persisted once
   - order details are fetched or retried when temporarily unavailable
   - one internal `Order` is created for the active store
   - `PlatformOrderLink` contains provider, merchant id, external order id, modality and deadline
   - duplicate polling of the same event does not duplicate the order
9. Open `Admin > Pedidos`.
10. Confirm the iFood order before its deadline.
11. Move the order through preparation and the correct ready/dispatch action based on modality.
12. Inspect `Admin > Integracoes > Delivery > Saude`.
    - Expected: last polling success, pending events, failed events, retryable syncs and homologation checks are visible.

## Test Commands

Focused backend tests:

```powershell
npm run test --workspace @burgoos/api -- delivery-integration
npm run test --workspace @burgoos/api -- ifood
```

Focused web tests:

```powershell
npm run test --workspace @burgoos/web -- delivery-integrations
npm run test --workspace @burgoos/web -- orders
```

Full validation before opening PR:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

## Expected Outcomes

- Store admin can configure and validate iFood without seeing stored secrets.
- Polling respects the iFood interval and does not run for paused/invalid integrations.
- Successfully processed events are acknowledged only after durable event/order persistence.
- iFood orders appear in the existing order queue with source, deadline and platform sync state.
- Accept/refuse/status actions create provider sync attempts and visible retry state on failure.
- Cross-store access is denied for integration configuration, events, and platform-origin orders.

## Production/Homologation Notes

- Production activation depends on iFood homologation approval.
- Webhooks, if enabled later, must validate provider signatures.
- Token expiration must be driven by provider metadata.
- Merchant permission propagation can temporarily show validation as pending.
- Customer data imported from iFood must respect provider privacy limitations in views and printouts.
