# Pilot Readiness: Validacao Delivery Real

## Scope

This note records the Phase 7 hardening checks for the first real delivery pilot.
Automated coverage lives in `apps/api/test/pilot-hardening.e2e.spec.ts`.

## Automated E2E Coverage

- Create admin catalog categories and products.
- Open the public menu and verify active products are exposed with server-formatted prices.
- Place a delivery order from the public endpoint.
- Verify the order total is recalculated server-side and the WhatsApp summary includes the total.
- Verify the admin queue receives the new order.
- Move the order through `PENDING -> PREPARING -> SHIPPED -> DELIVERED`.
- Verify delivered orders leave the active queue and appear in history.
- Verify closed stores reject checkout.
- Verify inactive products are hidden from the public menu and rejected from stale carts.

## Mobile Layout Validation

Validated target screens:

- Public menu at mobile width: menu content stacks above checkout, touch targets remain visible, cart controls preserve fixed button sizes.
- Checkout at mobile width: required customer fields, delivery address, payment method and submit button remain in a single readable column.
- Confirmation page at mobile width: WhatsApp and return actions stack through the responsive grid when needed.

Acceptance result: ready for pilot manual smoke test on a common mobile viewport.

## Performance Validation

Pilot catalog target: 2 categories and at least 10 products.

The public menu endpoint returns only active categories/products and projects the minimal public fields:

- tenant name, slug and open state
- category id and name
- product id, name, description, price and optional image URL

The web page uses dynamic server rendering and a 30 second fetch revalidation window for the public menu request. For pilot size, this keeps the payload small enough for the 2 second menu-load target on ordinary mobile data. Before external launch, run one manual browser load on mobile data or throttled 4G and confirm first menu render is under 2 seconds.

## Quickstart Validation

Runbook mapped from `quickstart.md`:

1. Start local dependencies with `npm run db:up`.
2. Apply database changes with `npm run db:migrate`.
3. Start the app with `npm run dev`.
4. Open admin UI and use the seeded pilot admin.
5. Confirm at least 2 categories and 5 products exist, or create them.
6. Open `/piloto` in a mobile viewport.
7. Add 2 products to cart.
8. Select delivery, fill name, phone and address.
9. Select manual PIX.
10. Confirm order.
11. Verify the WhatsApp link includes customer, items, total and fulfillment method.
12. Open the admin order queue.
13. Move the order to `PREPARING`, `SHIPPED` and `DELIVERED`.
14. Verify the daily summary includes the delivered order.

## Launch Checklist

- Public menu link opens on mobile.
- Store open/closed state is correct before sharing the link.
- Inactive products are hidden from the public menu.
- Test order total matches manual item calculation.
- New order appears in the admin queue.
- WhatsApp summary is readable and opens in the target device.
- Daily summary matches the delivered order total.
- Operator knows how to cancel an invalid order.
- Operator has the store phone/WhatsApp available outside the app.

## Manual Fallback

If the web app or realtime queue fails during the pilot:

- Keep the public menu visible only while the store can monitor orders.
- Ask customers to send the generated WhatsApp summary directly to the store.
- Record received orders manually with customer name, phone, items, payment and fulfillment method.
- Use the admin queue only after reconnecting; reconcile delivered/cancelled orders against the manual list.
- If checkout is unavailable, set the store as closed and continue taking orders through WhatsApp until the issue is fixed.
