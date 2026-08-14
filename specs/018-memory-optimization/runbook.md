# Runbook: Memory and Background Work

## Runtime roles

| APP_ROLE | HTTP | Durable worker | Intended use |
|---|---|---|---|
| api | enabled | disabled | Production request-serving process |
| worker | disabled | enabled | Production background process |
| all | enabled | enabled | Local development and single-process fallback |

Legacy schedulers remain behind their existing controls until each handler migration task is complete. A migrated handler must never have both legacy and durable consumers enabled.

## Handler migration flags

Each flag is an exclusive mode selector, not an additional consumer switch. `false` runs only the legacy path; `true` registers/enqueues only the durable path. Values other than the literal `true` or `false` fail environment validation at startup.

| Handler | Flag | Default | Durable priority | Rollback path |
|---|---|---:|---|---|
| Export | `EXPORT_DURABLE_JOBS_ENABLED` | `false` | LOW | In-process export worker |
| Sales import | `SALES_IMPORT_DURABLE_JOBS_ENABLED` | `false` | NORMAL | In-process preview/confirmation |
| Provider webhook | `PROVIDER_WEBHOOK_DURABLE_JOBS_ENABLED` | `false` | CRITICAL | Persist plus legacy immediate dispatch |
| Payment webhook | `PAYMENT_WEBHOOK_DURABLE_JOBS_ENABLED` | `false` | CRITICAL | Persist plus legacy immediate dispatch |
| iFood poll | `IFOOD_DURABLE_JOBS_ENABLED` | `false` | HIGH | Sequential legacy poller |
| MP reconciliation | `MP_RECONCILIATION_DURABLE_JOBS_ENABLED` | `false` | NORMAL | Existing reconciliation scheduler |
| MP token refresh | `MP_REFRESH_DURABLE_JOBS_ENABLED` | `false` | HIGH | Existing refresh scheduler |
| Point reconciliation | `POINT_RECONCILIATION_DURABLE_JOBS_ENABLED` | `false` | HIGH | Existing batch-25 scheduler |
| Retention | `RETENTION_DURABLE_JOBS_ENABLED` | `false` | LOW | Bounded daily retention cycle |

Enable one row at a time. Restart both API and worker roles after changing a flag, verify that exactly one handler registration/producer path is active, and retain pending durable records during rollback.

## Memory budget

- Container/service limit: 512 MB individually for web, API and an isolated worker.
- API heap starting point: `NODE_OPTIONS=--max-old-space-size=384`.
- Warning RSS: 400 MB for two consecutive 30-second samples.
- High pressure RSS: 440 MB for two consecutive samples.
- Acceptance peak: 460 MB.
- Recovery requires two consecutive samples below the current boundary.
- High pressure pauses new NORMAL/LOW work; CRITICAL operational work remains admissible.

The soak runner samples web and API RSS by PID/container. API metrics add heap, external and array-buffer detail.

## Database pool

Start with a PostgreSQL connection limit of 3-5 connections per 512 MB process. Account for every `api`, `worker` and deployment replica before raising it. Encode the provider-supported pool limit in `DATABASE_URL` and verify total connections after rollout.

## Request and asset limits

- Default API body limit: 2 MiB.
- Accepted image size: 2 MiB.
- Maximum image width/height: 4096 pixels.
- Production assets: S3-compatible storage.
- Development fallback: `ASSET_LOCAL_ROOT`, streamed through the authenticated local upload endpoint.
- Export retention: seven days by default.

The local fallback is not suitable for multi-instance production because files are instance-local.

## Background defaults

- Worker concurrency: 1.
- Discovery batch: 25.
- Export cursor batch: 250.
- Lease: 60 seconds with heartbeat before expiry.
- Max attempts: 5 with bounded exponential backoff and jitter.

## Production startup

Build in a separate build environment. Start runtime processes from built artifacts:

```text
APP_ROLE=api NODE_OPTIONS=--max-old-space-size=384 npm run start:api --workspace @burgoos/api
APP_ROLE=worker NODE_OPTIONS=--max-old-space-size=384 npm run start:worker --workspace @burgoos/api
npm run start --workspace @burgoos/web
```

Next.js uses standalone output. Package only `.next/standalone`, `.next/static` and required public assets in the production runtime image.

## Initial rollback

1. Stop new low-priority job admission.
2. Disable the specific migrated durable handler.
3. Wait for or safely expire its current lease.
4. Enable the corresponding legacy handler only after the durable consumer is stopped.
5. Preserve queued records and domain idempotency state for later resumption.

Never run both paths for the same handler concurrently.

### Rollout/rollback release checklist

- [ ] Build API and web from a non-synchronized workspace and archive the source revision.
- [ ] Start isolated `api`, `worker` and web processes with individual 512 MiB limits.
- [ ] Verify API health reports `role=api` and `pressure=NORMAL`; verify the worker owns durable consumers.
- [ ] Enable one handler flag at a time and confirm only one legacy/durable path is active.
- [ ] Run five representative cycles and attach RSS plus API heap/external/array-buffer evidence.
- [ ] Confirm POS, KDS, payment, notification and public queue freshness during the cycles.
- [ ] Kill one claimed worker, wait for lease expiry and confirm exactly one recovery without duplicate domain effects.
- [ ] Record pending/running job counts before rollback, disable the implicated durable flag and stop its consumer.
- [ ] Confirm pending durable records remain intact, then enable the legacy path only after durable consumption stops.
- [ ] Re-enable the durable handler and confirm the preserved queue resumes idempotently.
- [ ] Attach eight-hour graphs/raw samples, restart/OOM count and job latency to the release record.

Automated validation completed on 2026-08-14 covers static checks, lease ownership, retry/recovery logic, 100-job draining, tenant isolation, redaction, handler flags, reports, exports, assets and adaptive polling. Unchecked items require the production-like release environment and must not be pre-checked from unit-test evidence.

## Resource metrics and ten-minute diagnosis

Structured JSON logs expose these stable events without job payloads:

| Event | Important fields |
|---|---|
| `resource.process.sample` | `role`, `level`, `rss`, `heapUsed`, `heapTotal`, `external`, `arrayBuffers`, `eventLoopLagP99Ms` |
| `background_job.started` | `role`, `pressureLevel`, `jobId`, `handler`, `queueLagMs`, `activeJobs`, memory snapshot |
| `background_job.finished` | `role`, `pressureLevel`, `jobId`, `handler`, `outcome`, `durationMs`, `processedCount`, memory snapshot |

Alert when RSS remains at or above 400 MiB for two samples, immediately escalate at 460 MiB, or when queue lag/duration grows for a single handler. Never attach payload, credentials, provider responses or customer/card data to these events.

Triage procedure:

1. Read `/api/health` and identify `role` and current `pressure`.
2. Filter `resource.process.sample` by the affected instance and compare RSS with heap, external and array buffers.
3. Correlate the interval with `background_job.started` and `background_job.finished` by handler and job ID.
4. Compare duration, processed count and start/end memory from `background_job_attempts`; abandoned attempts retain their terminal memory snapshot.
5. If heap grows, capture a heap profile in a controlled replica. If only external/array buffers grow, inspect streaming and native dependencies for that handler.
6. Pause NORMAL/LOW admission or disable only the implicated durable-handler flag; do not disable critical payment/webhook work.

Error messages are bounded and centrally redact bearer tokens, credentials, card fields and raw provider payloads before persistence.

## Dependency note

The XLSX streaming dependency and its transitive packages must be loaded only by export workers. `npm install` currently reports transitive vulnerability/deprecation findings; do not run forced automatic upgrades. Review and update them through a dedicated dependency change with export compatibility tests.
