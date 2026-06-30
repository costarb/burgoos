# Quickstart: Validação Delivery Real

## Goal

Run the pilot flow locally and validate a complete delivery order:

1. Admin logs in.
2. Admin creates categories and products.
3. Customer opens public menu.
4. Customer places an order.
5. Admin receives and updates order status.
6. Admin checks daily summary.

## Expected Commands

Exact commands will be finalized after project scaffolding. Target flow:

```powershell
npm install
npm run db:up
npm run db:migrate
npm run dev
```

## Manual Validation Script

1. Open admin UI.
2. Create or use seeded pilot store.
3. Add at least 2 categories and 5 products.
4. Open public menu on mobile viewport.
5. Add 2 products to cart.
6. Select delivery and fill customer/address fields.
7. Select manual PIX.
8. Confirm order.
9. Verify WhatsApp link includes customer, items, total and fulfillment method.
10. Verify admin order queue shows new order and alert.
11. Move order from `PENDING` to `PREPARING`, then `SHIPPED`, then `DELIVERED`.
12. Verify daily summary includes the delivered order.

## Launch Readiness Checklist

- Public menu loads on mobile.
- Store closed blocks checkout.
- Inactive products are hidden from public menu.
- Server recalculates total.
- New order appears in admin panel.
- WhatsApp link is readable by the operator/customer.
- Daily summary matches manual order count.
