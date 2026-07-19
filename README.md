# BurgoOS

BurgoOS delivery pilot monorepo.

## Delivery Integrations

The iFood integration is designed as a store-scoped distributed application flow. Each store authorizes its own merchant access, and BurgoOS stores token metadata per tenant.

### API Environment Variables

```text
DELIVERY_INTEGRATIONS_ENABLED=true
DELIVERY_INTEGRATION_SECRET_KEY=replace-with-32-byte-base64-key
DELIVERY_POLLING_INTERVAL_SECONDS=30
IFOOD_API_BASE_URL=https://merchant-api.ifood.com.br
IFOOD_AUTH_BASE_URL=https://merchant-api.ifood.com.br/authentication/v1.0
IFOOD_CLIENT_ID=
IFOOD_CLIENT_SECRET=
IFOOD_WEBHOOK_SIGNATURE_SECRET=
IFOOD_MOCK_MODE=false
```

### Render Notes

- Run Prisma migrations before starting the API.
- Keep iFood credentials and `DELIVERY_INTEGRATION_SECRET_KEY` as secret environment variables.
- Use the iFood homologation credentials until the app is approved for production.
- The polling interval must respect iFood's documented 30-second baseline.
- Recommended API build command:
  `npm ci && npm run db:generate && npx prisma migrate deploy --schema packages/database/prisma/schema.prisma && npm run build --workspace @burgoos/api`
- Recommended API start command:
  `npm run start --workspace @burgoos/api`
- Recommended web build command:
  `npm ci && npm run db:generate && npm run build --workspace @burgoos/web`
- `DELIVERY_INTEGRATION_SECRET_KEY` must stay stable after credentials are saved. Rotating it without re-saving store credentials makes stored iFood tokens unreadable.
- Keep `IFOOD_MOCK_MODE=false` in production and use mock mode only for local validation.
- Confirm Render has the same `DATABASE_URL`, JWT variables, API public URL, web public URL and iFood base URLs configured for the target environment.

## Mercado Pago sales integration

Mercado Pago uses one central RRF5 OS application and stores an isolated connection per establishment. OAuth with PKCE is the recommended production mode. A write-only fixed Access Token is available in the administrative screen only to simplify controlled tests; it is validated remotely, encrypted and never returned by the API.

### Platform configuration

`SUPER_ADMIN` users can configure the central application at `/platform/integrations`. Client Secret and Webhook Secret are write-only and encrypted in the database; changes take effect without a deploy or API restart. Database values take precedence over environment values.

### Bootstrap environment variables

```text
MERCADO_PAGO_CLIENT_ID=
MERCADO_PAGO_CLIENT_SECRET=
MERCADO_PAGO_REDIRECT_URI=https://api.example.com/api/integrations/mercadopago/callback
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_POST_CALLBACK_URL=https://app.example.com/admin/orders/import
INTEGRATION_SECRET_KEY=replace-with-32-byte-base64-key
```

Configure the Mercado Pago application callback exactly as `MERCADO_PAGO_REDIRECT_URI` and the webhook as `https://api.example.com/api/webhooks/mercadopago`. Keep production and test connections separate. `INTEGRATION_SECRET_KEY` must remain stable after credentials are stored.

Environment values remain available for bootstrap and disaster recovery. After configuration is saved through the platform screen, store administrators only connect their own Mercado Pago account and never access the central application secrets.

The API renews OAuth tokens daily when they are within 15 days of expiry. It reconciles updates from the last 24 hours every 15 minutes and the last seven days daily. Operational states `REAUTHORIZATION_REQUIRED` and `ERROR` require administrator attention; fixed tokens are never automatically renewed.

Before enabling Point sales commercially, complete the second-account POC documented in `specs/014-mercado-pago-oauth/quickstart.md`. Payment webhooks are enabled, while Point order mapping remains intentionally disabled until that evidence is recorded.
