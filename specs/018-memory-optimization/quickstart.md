# Quickstart: Memory and Background Work Validation

## Prerequisites

- Node.js 20+
- PostgreSQL 16 available through the existing local environment
- Project dependencies installed
- Test tenant data with orders, items, notifications and integration records
- Object-storage development fallback configured

## Static validation

```powershell
npm.cmd run typecheck --workspace @burgoos/api
npm.cmd run typecheck --workspace @burgoos/web
npm.cmd run lint --workspace @burgoos/api
npm.cmd run lint --workspace @burgoos/web
```

## Database and contract validation

```powershell
.\node_modules\.bin\prisma.cmd validate --schema packages\database\prisma\schema.prisma
.\node_modules\.bin\prisma.cmd generate --schema packages\database\prisma\schema.prisma
```

Verify that two concurrent claim attempts return one lease owner, an expired lease is recovered once, active dedupe returns the existing job, and a stale owner cannot complete a recovered attempt.

## Role validation

Run the same artifact in each supported role:

```powershell
$env:APP_ROLE='api'; npm.cmd run start --workspace @burgoos/api
$env:APP_ROLE='worker'; npm.cmd run start --workspace @burgoos/api
$env:APP_ROLE='all'; npm.cmd run start --workspace @burgoos/api
```

- `api`: accepts requests and enqueues, but does not consume background work.
- `worker`: consumes work and exposes only required health/metrics behavior.
- `all`: development-compatible combined behavior.

## Polling validation

For notifications, KDS, Point status and public queue:

1. Open the page and confirm no second request starts while the first is pending.
2. Hide the tab and verify non-critical request volume falls by at least 70%.
3. Simulate repeated failures and verify exponential backoff with jitter.
4. Restore visibility and verify one immediate refresh followed by the normal interval.
5. Unmount/navigate away and verify the request is aborted and no timer remains.
6. Confirm notification badge uses summary only and the list holds at most 50 items.

## Job inventory validation

Exercise every handler with two worker instances:

| Handler | Expected guard |
|---|---|
| Export | One heavy export per worker, active fingerprint dedupe, streaming output |
| Sales import | Bounded startup recovery and one active run claim |
| Provider/payment webhook | Persist before enqueue; safe retry after restart |
| iFood poll | Paged integrations, one job per integration, sequential event processing |
| MP reconciliation | Bounded connections; short/daily overlap prevented per integration |
| MP token refresh | Bounded connections and existing credential claim preserved |
| Point reconciliation | Batch 25 and distributed claim per charge |
| Retention | Bounded delete batch and continuation |

Kill one worker after claim, wait for lease expiry, start another and verify one safe recovery without duplicate domain effects.

## Report and export validation

Seed a period containing thousands of orders with multiple items. Verify:

- analytical pagination is applied by the data query, not array slicing;
- aggregate results match the existing calculation fixtures;
- interactive periods over 92 days receive the documented response;
- CSV row production and download use backpressure;
- XLSX/PDF limits are rejected before full dataset construction;
- two accepted exports do not execute simultaneously in a concurrency-1 worker.

## Memory baseline and soak

Capture `rss`, `heapUsed`, `heapTotal`, `external` and `arrayBuffers` every 30 seconds. The runner must discover and sample both the Next server PID/container and the API PID/container. API telemetry enriches its sample with heap/external/arrayBuffers; external RSS sampling remains the acceptance source shared by both processes. Run five identical cycles containing:

1. Admin navigation and notification refresh.
2. POS order creation and KDS updates.
3. Public queue polling.
4. A 31-day sales and management report.
5. One CSV export and one image upload at the accepted boundary.
6. iFood, MP and Point jobs with fixture responses.

After each cycle, allow 15 minutes of normal traffic. The fifth stabilized heap must be at most 10% above the first. Then run the representative load for 8 hours; each web/API process must remain at RSS p95 <= 400 MB and peak <= 460 MB without OOM/restart.

## Rollback check

For each migrated handler, confirm its feature flag can stop new durable claims and temporarily restore the legacy path without running both consumers. Persisted pending jobs must remain intact and resumable after the flag is re-enabled.

## Execution record

| Scenario | Automated evidence | Manual/production-like evidence |
|---|---|---|
| Static API/web checks | Record commands in `validation.md` | none |
| Lease, recovery and 100-job flow | focused Vitest suites | kill/restart drill before rollout |
| Adaptive polling | fake-timer/component suites | browser Network panel with visible/hidden tabs |
| Reports, exports and assets | integration/unit suites | boundary file and representative tenant verification |
| Five representative cycles | harness command and `baseline.md` | required with seeded production-like data |
| Eight-hour soak | scheduled command below | owner: release operator; attach platform graphs and raw JSON/CSV to the release record |

Production-like soak command after starting isolated `api`, `worker` and web artifacts:

```powershell
npm.cmd run memory:soak -- --api-pid <API_PID> --web-pid <WEB_PID> --duration-ms 28800000 --interval-ms 30000 --output tmp/memory-soak/acceptance-8h.json
```

Do not approve rollout until the release record contains RSS p95/peak for web and API, heap stabilization across five cycles, restart count, job latency and confirmation that critical POS/KDS/payment checks remained healthy.

### Local execution on 2026-08-14

| Scenario | Result | Evidence / remaining release action |
|---|---|---|
| API/web typecheck and lint | PASS | Four workspace commands completed successfully |
| Prisma validate and generate | PASS | Schema valid and Prisma Client generated |
| Lease, recovery, 100 jobs, reports, exports, assets and handler guards | PASS | 12 API files, 51 tests |
| Adaptive polling, notifications, KDS, Point, public queue and bounded image clients | PASS | 8 web files, 19 tests, executed from `apps/web` so its jsdom config is applied |
| `APP_ROLE=api` | PASS | Compiled health returned `role=api`, `pressure=NORMAL`; legacy iFood scheduler disabled by role |
| `APP_ROLE=worker` | PASS | Compiled application context remained active until the controlled stop |
| `APP_ROLE=all` | PASS (development) | Previously validated through `scripts/start-local.ps1`; compiled staging probe did not become ready inside the local timeout and is not release evidence |
| Five representative cycles | PENDING | Requires seeded high-volume orders, fixture-controlled provider responses, accepted boundary image and 75 minutes of stabilization |
| Browser visible/hidden Network-panel checks | PENDING | Execute in the release browser session and attach request counts |
| Worker kill/lease-expiry/recovery drill | PENDING | Automated ownership tests pass; execute against two release worker processes |

Do not replace the three pending production-like checks with unit-test results. They intentionally remain rollout gates even when all automated checks pass.
