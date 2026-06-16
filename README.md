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
IFOOD_AUTH_BASE_URL=https://merchant-api.ifood.com.br/authentication
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
