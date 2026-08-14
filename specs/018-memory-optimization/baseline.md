# Memory Baseline

**Status**: Representative five-cycle acceptance passed; eight-hour execution remains owned by the release operator as documented for T090.

## Known production observation

- Web exceeded the 512 MB service limit before this feature.
- API exceeded the 512 MB service limit before this feature.
- Historical telemetry separating heap, buffers and native RSS was not available, so these observations cannot yet distinguish retention from transient peaks.

## Reproducible capture

Start web and API production builds, obtain their PIDs and run:

```powershell
npm.cmd run memory:soak -- --api-pid <API_PID> --web-pid <WEB_PID> --duration-ms 60000 --interval-ms 5000 --output tmp/memory-soak/baseline.json
```

For formal acceptance, repeat the representative cycle five times with 15 minutes of stabilization and then execute the eight-hour soak described in `quickstart.md`.

## Acceptance thresholds

| Process | RSS p95 | RSS peak | Stabilized heap growth |
|---|---:|---:|---:|
| Web | <= 400 MB | <= 460 MB | <= 10% after five cycles |
| API | <= 400 MB | <= 460 MB | <= 10% after five cycles |

## Baseline results

The initial capture ran on 2026-08-07 against production builds on Windows/Node 20.20.2. The API used an empty, migrated `memory_baseline` PostgreSQL schema so legacy schedulers could initialize without contacting configured tenant integrations. During the 60-second window the harness sampled both PIDs every five seconds and issued ten health requests plus ten login page requests. This is an idle/smoke baseline, not a substitute for the representative workload and soak required by T089/T090.

| Environment | Process | Duration | RSS p95 | RSS peak | Result |
|---|---|---:|---:|---:|---|
| Production build, isolated smoke (2026-08-07) | Web | 60 s / 11 samples | 66.82 MB | 66.82 MB | Pass |
| Production build, isolated smoke (2026-08-07) | API (`APP_ROLE=api`) | 60 s / 11 samples | 91.25 MB | 91.25 MB | Pass |
| Production build from non-synchronized staging (2026-08-13) | Web standalone | 60 s / 10 samples | 60.05 MiB | 60.05 MiB | Pass |
| Production build from non-synchronized staging (2026-08-13) | API (`APP_ROLE=api`) | 60 s / 10 samples | 88.96 MiB | 88.96 MiB | Pass |

Raw evidence is written to `tmp/memory-soak/baseline.json` and its CSV companion. These generated measurements are intentionally ignored by Git; the reproducible summary is retained here.

## Interpretation and limitations

- Both idle production processes are comfortably below the 400 MB p95 and 460 MB peak guardrails.
- The historical production observation above remains the only evidence for the failing heavy-load state; this smoke run does not invalidate it.
- The Next production build itself reached approximately 400 MB RSS while compiling. Build-time memory is separate from the runtime service budget but may require a larger CI/build container.
- The legacy iFood, Mercado Pago, Point and retention schedules are now role-gated. A compiled `APP_ROLE=api` runtime logged `ifood.poll.scheduler status=disabled reason=runtime_role`; job discovery and consumption remain owned by `worker`/`all`.
- Report, export, image and integration workloads are not represented yet. Their before/after comparison is deferred to T089 after the corresponding bounded implementations exist.

## Post-optimization local development smoke

On 2026-08-13, `scripts/start-local.ps1` started the API and web development servers successfully after migrations. `/api/health` returned `role=all`, `pressure=NORMAL`, and `/login` returned HTTP 200. A 30-second external RSS capture after the first Next page compilation produced:

| Mode | Process | Samples | RSS p95/peak | 512 MiB result |
|---|---|---:|---:|---|
| Development (`ts-node`, `APP_ROLE=all`) | API | 5 | 681.32 MiB | Fail |
| Development (`next dev`) | Web | 5 | 541.79 MiB | Fail |

Raw evidence is in ignored files `tmp/memory-soak/post-optimization-smoke.json` and `.csv`. Development-mode compilers, source maps, caches and the combined API/worker role make this intentionally different from the production architecture. The result confirms that acceptance must use built standalone artifacts with `APP_ROLE=api` and `APP_ROLE=worker` separated; local `npm run dev` cannot operate within a 512 MiB budget.

This development smoke did not satisfy T089; the representative production-build result is recorded below.

The initial production-build attempt was blocked by OneDrive filesystem behavior: Next did not finish within the validation window and Nest received `EPERM` while cleaning a read-only reparse point under `dist`. Copying the same source revision to a non-synchronized temporary staging directory resolved the issue: both production builds completed, the API and web health probes passed, and the representative measurements below used that staging approach.

## Representative five-cycle acceptance (2026-08-14)

The production API, isolated worker and standalone web build ran against the dedicated PostgreSQL schema `memory_validation_20260814`, populated with 5,000 orders and 15,000 order items. Each cycle authenticated a seeded administrator and exercised web navigation, notification summary, public menu, real order creation, KDS, public queue, 31-day sales/management reports, durable CSV export and an accepted 2 MiB/4096 px image upload. Provider handler behavior used the deterministic focused suites recorded in `validation.md`, avoiding external production calls.

Each workload cycle was followed by the required 15-minute stabilization. External RSS came from the operating-system PIDs; API heap, external and array-buffer values came from `resource.process.sample` telemetry.

| Cycle | API RSS | Web RSS | API heap used | External | Array buffers | Failed steps |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 103.82 MiB | 64.15 MiB | 39.94 MiB | 2.64 MiB | 0.09 MiB | 0 |
| 2 | 112.75 MiB | 72.38 MiB | 39.91 MiB | 2.63 MiB | 0.09 MiB | 0 |
| 3 | 110.78 MiB | 59.04 MiB | 40.60 MiB | 2.64 MiB | 0.09 MiB | 0 |
| 4 | 106.58 MiB | 51.93 MiB | 40.08 MiB | 2.63 MiB | 0.09 MiB | 0 |
| 5 | 108.71 MiB | 49.89 MiB | 40.61 MiB | 2.64 MiB | 0.09 MiB | 0 |

- API RSS peak: **112.75 MiB** (limit 460 MiB).
- Web RSS peak: **72.38 MiB** (limit 460 MiB).
- Stabilized API heap growth, cycle 1 to cycle 5: **1.68%** (limit 10%).
- API health after completion: `role=api`, `pressure=NORMAL`; web login returned HTTP 200.
- Overall result: **PASS**.

Raw ignored evidence: `tmp/memory-soak/representative-cycles.json`. The committed scripts `memory:seed` and `memory:cycles` reproduce the seed and workload without storing credentials in the result.
