# Quickstart: Conexao Mercado Pago Multiempresa

## Prerequisites

- PostgreSQL local and dependencies installed.
- Existing PagBank integration tests passing before schema changes.
- Mercado Pago application credentials only for manual or POC tests; automated tests use fixtures and a fake HTTP server.
- Configure local callback and webhook URLs with a public HTTPS tunnel only when exercising the real provider.

## Safe local configuration

Add environment values without committing secrets:

```text
MERCADO_PAGO_CLIENT_ID=
MERCADO_PAGO_CLIENT_SECRET=
MERCADO_PAGO_REDIRECT_URI=https://<public-host>/api/integrations/mercadopago/callback
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_POST_CALLBACK_URL=http://localhost:3000/admin/orders/import
```

Reuse the existing integration encryption key. Never place a store Access Token in fixtures, screenshots, URLs or committed `.env` examples.

## Validation sequence

1. Run Prisma format, validate, generate and the new migration against a disposable or local database.
2. Run existing PagBank tests to prove backward compatibility.
3. Run Mercado Pago unit tests for PKCE, state hashing, token envelopes, mapping, pagination, signature and refresh locking.
4. Run API contract tests for tenant isolation, write-only token, callback replay/expiry, webhook idempotency and 401 recovery.
5. Run web tests for OAuth/fixed-token selection, warnings, status, replacement and absence of token echoes.
6. Execute typecheck and lint for API, web and shared packages.

## Manual fixed-token flow

1. Enter the authenticated store administration and choose Mercado Pago.
2. Select `Access Token fixo`; verify the warning that OAuth is recommended.
3. Paste a test token and submit once.
4. Confirm the UI shows mode, connected account and status, but never the token or a real prefix or suffix.
5. Start a 30-day preview, inspect approved and ignored items, import and repeat the same period to verify zero duplicate orders.
6. Replace the token with an invalid value and confirm the active credential remains usable; then replace with a valid token.

## Manual OAuth flow

1. Select OAuth and start connection as an establishment administrator.
2. Select 30, 60 or 90 days for the initial load, complete authorization and confirm callback lands on the integration screen and starts that period.
3. Repeat the callback URL and confirm rejection without altering the connection.
4. Force expiry inside the renewal window in local data, execute refresh worker twice concurrently and confirm only one remote refresh and one active credential version.
5. Remove the initiating user's administrative access before a new callback and confirm the authorization is rejected without storing credentials.

## Webhook and reconciliation flow

1. Send a signed fixture twice and confirm one notification is processed.
2. Send an invalid signature and confirm no financial state changes.
3. Confirm the processor resolves the connection by provider user ID and fetches the canonical resource with that connection token.
4. Omit one event and run the short reconciliation; confirm the canonical state is recovered.
5. Use the canonical local endpoint `/api/webhooks/mercadopago` and verify at least 99 of 100 valid fixture notifications are accepted in under two seconds each.

## Required Point POC before rollout

1. Connect a second real Mercado Pago account through OAuth and confirm `offline_access`.
2. Query the expected initial period.
3. Make a small real Point sale.
4. Record whether it appears in payment search, an order resource or both.
5. Confirm signed webhook topic and account resolution.
6. Refund the sale and confirm canonical state update without automatic order mutation.
7. Renew the token in a controlled window and confirm the new refresh token is active.
8. Record evidence and enable the confirmed Point capability only after all steps pass.
