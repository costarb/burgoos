# Job and Polling Inventory

## Server jobs

| Flow | Owner | Discovery interval | Batch | Concurrency | Lease/retry | Priority | Memory impact | Exclusive flag |
|---|---|---:|---:|---:|---|---|---|---|
| Export | Management exports | request/startup pages of 25 | cursor 250 | 1 | 600s; 15s–15m | LOW | medium/high; streaming CSV/XLSX | `EXPORT_DURABLE_JOBS_ENABLED` |
| Sales import preview/confirm | Sales integrations | request/startup pages | bounded parser batch | 1 | handler default; bounded backoff | NORMAL | high; file parsing | `SALES_IMPORT_DURABLE_JOBS_ENABLED` |
| Provider webhook | Mercado Pago integration | per receipt | 1 event | 1 | handler default | CRITICAL | low/medium | `PROVIDER_WEBHOOK_DURABLE_JOBS_ENABLED` |
| Payment webhook | Payments | per receipt | 1 event | 1 | handler default | CRITICAL | low | `PAYMENT_WEBHOOK_DURABLE_JOBS_ENABLED` |
| iFood poll | Delivery integration | configured poll interval; integrations paged | provider event batch, sequential per integration | 1 | handler default; dedupe per integration | HIGH | medium; HTTP payload bounded | `IFOOD_DURABLE_JOBS_ENABLED` |
| MP reconciliation | Sales integrations | every 15m and daily 04:00 | connections paged | 1 | bounded backoff; exclusion per integration | NORMAL | medium | `MP_RECONCILIATION_DURABLE_JOBS_ENABLED` |
| MP token refresh | Sales integrations | daily 03:00 | connections paged | low/bounded | bounded backoff; integration lock | HIGH | low/medium | `MP_REFRESH_DURABLE_JOBS_ENABLED` |
| Point reconciliation | Payments | every 2m | 25 charges | 1 | distributed claim; bounded retry | HIGH | low/medium | `POINT_RECONCILIATION_DURABLE_JOBS_ENABLED` |
| Import retention | Sales integrations | daily 02:00 plus continuation | bounded delete page/deadline | 1 | continuation job | LOW | low/medium | `RETENTION_DURABLE_JOBS_ENABLED` |

Shared worker discovery polls every `BACKGROUND_JOB_POLL_INTERVAL_MS` (default 1s), claims one job at a time, heartbeats before lease expiry and pauses NORMAL/LOW claims under HIGH memory pressure. Recovery scans expired leases in pages of 25. Legacy and durable paths for the same row must never be enabled together.

## Browser polling

| Flow | Owner | Visible interval | Hidden behavior | Concurrency | Stop condition | Expected memory impact |
|---|---|---:|---|---:|---|---|
| Notification badge | Admin shell | bounded by notification configuration, <=30s freshness | slower/paused by shared controller | 1, abortable | unmount/logout | low; summary only |
| Notification list | Notifications page | adaptive delta refresh | slower/paused | 1, abortable | unmount | low; maximum 50 items |
| KDS recovery | Orders/KDS | Socket.io primary; slow recovery poll | slower/paused | 1, abortable | unmount | medium; bounded order response |
| Active Point charge | POS | urgent while charge is active | visibility-aware | 1, abortable | terminal/expired charge | low |
| Public order queue | Public queue | up to 5s foreground | reduced when hidden | 1, abortable | terminal/unmount | low; no permanent 1s render clock |

The admin session refresh also uses the shared adaptive lifecycle. Cash-flow's 60-second timer updates an already loaded visible position and does not issue a periodic network request.
