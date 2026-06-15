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
