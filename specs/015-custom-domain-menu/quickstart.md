# Quickstart: Validacao do cardapio por dominio

## Preconditions

- Banco local migrado and seeded.
- API e web em execucao.
- Usuario de plataforma com permissao para manter lojas.
- Uma loja ativa com catalogo publicado.

## Administrative flow

1. Open `/platform/stores` and select the test store.
2. Set the public domain to `loja-teste.example.com` and save.
3. Confirm the detail shows `https://loja-teste.example.com/cardapio`.
4. Try assigning `www.loja-teste.example.com` to another store and confirm the conflict.
5. Try values with `https://`, a port or a path and confirm validation errors.

## Public flow

1. Route `loja-teste.example.com` to the local web application using a hosts/proxy setup.
2. Open `http://loja-teste.example.com/cardapio`.
3. Confirm branding, categories and products match the configured store.
4. Add a product and create an order.
5. Confirm the browser remains under `/cardapio/pedido/{orderId}` and the order belongs to the configured tenant.
6. Open the legacy `/{slug}` URL and confirm it still works.

## Isolation flow

1. Configure a second active store with another domain.
2. Open `/cardapio` through both domains and compare name, branding and products.
3. Send an unknown host and confirm a not-found response without fallback.
4. Deactivate the first store and confirm its domain stops serving a menu within 60 seconds.

## Automated validation

```powershell
npm.cmd run typecheck --workspace=@burgoos/api
npm.cmd run typecheck --workspace=@burgoos/web
npm.cmd test --workspace=@burgoos/api
npm.cmd test --workspace=@burgoos/web
npm.cmd run lint --workspace=@burgoos/api
npm.cmd run lint --workspace=@burgoos/web
```
