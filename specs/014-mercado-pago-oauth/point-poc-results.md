# Mercado Pago Point POC results

**Status**: PENDING_EXTERNAL_VALIDATION

This gate must be completed with a second real Mercado Pago account before Point order mapping is enabled. Do not place access tokens, authorization codes, refresh tokens, signatures or customer data in this document.

## Evidence checklist

- [ ] OAuth completed with the second account and `offline_access` confirmed.
- [ ] `/v1/payments/search` queried for the authorized account.
- [ ] Small real Point sale created; sanitized date, amount and evidence reference recorded.
- [ ] Sale located in payment search, order resource or both.
- [ ] Signed webhook topic and `user_id` account resolution confirmed.
- [ ] Refund performed and canonical state updated without automatically mutating the imported order.
- [ ] Token renewed in a controlled window and rotated refresh token confirmed.

## Sanitized observations

| Check                | Result  | Sanitized evidence | Date |
| -------------------- | ------- | ------------------ | ---- |
| OAuth/offline access | Pending | -                  | -    |
| Payment search       | Pending | -                  | -    |
| Point resource type  | Pending | -                  | -    |
| Webhook topic        | Pending | -                  | -    |
| Refund update        | Pending | -                  | -    |
| Refresh rotation     | Pending | -                  | -    |

## Enablement decision

`MERCADO_PAGO_POINT_ORDER_CAPABILITY` remains `false`. Complete the checklist and review the observed resource schema before implementing T085.
