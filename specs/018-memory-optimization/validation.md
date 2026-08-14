# Validation Record

**Date**: 2026-08-13
**Environment**: Windows, Node.js 20.20.2, local PostgreSQL/Prisma configuration

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| OpenAPI YAML syntax | PASS | Parsed with Python `yaml.safe_load` |
| Prisma schema | PASS | `prisma validate` |
| API typecheck | PASS | `npm.cmd run typecheck --workspace @burgoos/api` |
| Web typecheck | PASS | `npm.cmd run typecheck --workspace @burgoos/web` |
| API focused operational suite | PASS | 23 tests: tenant/redaction/flags, 100-job worker, assets and exports |
| Web focused operational suite | PASS | 12 tests: adaptive polling, notifications, branding and catalog |
| Resource alert fixture | PASS | 1 root Vitest test |
| Diff whitespace validation | PASS | `git diff --check` |
| API lint | PASS | `npm.cmd run lint --workspace @burgoos/api` |
| Web lint | PASS | `npm.cmd run lint --workspace @burgoos/web` |
| Legacy scheduler role isolation | PASS | 5 focused files / 20 tests plus compiled `APP_ROLE=api` health and log check |
| Production builds outside OneDrive | PASS | Nest and Next standalone builds completed from temporary staging |
| 2026-08-14 focused API quickstart suite | PASS | 12 files / 51 tests: lease, recovery, 100 jobs, security, reports, exports, assets and integration guards |
| 2026-08-14 focused web quickstart suite | PASS | 8 files / 19 tests using the web workspace jsdom configuration |

All previously reported lint findings were corrected with type-safe, behavior-preserving cleanup.

## Security and isolation

- Unsafe asset traversal is rejected and valid stored keys remain tenant-prefixed.
- Export retrieval and notification deltas are scoped by tenant and requesting user.
- Active job/export fingerprints prevent duplicate scheduling.
- Handler flags accept only explicit `true`/`false`, preserving exclusive durable/legacy rollback.
- Tokens, credentials, card values and raw payloads are redacted before resource telemetry persistence.

## Memory evidence

The reproducible idle production-build evidence remains recorded in `baseline.md`. The latest non-synchronized staging run measured API p95/peak 88.96 MiB and standalone web p95/peak 60.05 MiB over 60 seconds. This proves startup/runtime headroom only; it does not satisfy the representative five-cycle acceptance gate.

T089 remains open until a seeded production-like environment executes all five workload cycles with 15-minute stabilization and records heap/RSS/external/array-buffer deltas. Rollout must not treat unit/integration tests as substitute evidence.

## Eight-hour soak ownership (T090)

- **Owner**: release operator responsible for the first production-like release candidate.
- **Environment**: isolated production builds for `APP_ROLE=api`, `APP_ROLE=worker`, and Next standalone, with representative tenant data and fixture-controlled providers.
- **Command**: documented in `quickstart.md` with 30-second sampling for 28,800,000 ms.
- **Required evidence**: raw JSON/CSV, platform memory graphs, restart/OOM count, job latency, handler failures and POS/KDS/payment health.
- **Acceptance**: RSS p95 <= 400 MiB and peak <= 460 MiB per web/API process; fifth stabilized heap <= 110% of the first cycle.

## Quickstart status

Automated static, contract, lease/recovery, polling, reports, exports, image and rollback-flag scenarios passed. Manual multi-role startup, browser hidden-tab measurement, worker kill/recovery drill, five-cycle representative load and eight-hour soak remain release-environment gates. T092 remains open until those manual steps are attached to the release record.

The local combined-role development startup also passed (`/api/health` 200 and `/login` 200). Its memory smoke exceeded 512 MiB for both processes and is recorded in `baseline.md`; it is explicitly not release evidence because it uses `ts-node`, `next dev` and `APP_ROLE=all`.

## Production-build workspace workaround

A production-build validation was attempted on 2026-08-13. The Next build remained active for more than five minutes without producing a new `BUILD_ID` and was stopped together with only its child process. The isolated Nest build then failed while cleaning `apps/api/dist/src/config` with `EPERM`; the generated directory is a read-only OneDrive reparse point.

This was confirmed as a workspace/filesystem limitation rather than a TypeScript or lint failure. The same source was staged under the local temporary volume with the repository dependencies linked in; Nest and Next production builds then completed successfully. The compiled API returned `role=api` and `pressure=NORMAL`, and its iFood scheduler reported `status=disabled reason=runtime_role`.

Release validation and T089/T092 must therefore run in CI, a container build stage, or a clone/staging directory on a non-synchronized volume. Do not use `next dev` RSS as a production proxy and do not mutate OneDrive attributes as part of deployment validation.

## Final local gate review (2026-08-14)

Typecheck, lint, Prisma validation/generation, 51 focused API tests and 19 focused web tests passed. The compiled `worker` role remained active until a controlled stop. The local database is healthy and contains seeded credentials, but it is not a representative high-volume fixture environment: it does not provide thousands of dated orders, deterministic iFood/MP/Point provider responses, the accepted boundary upload cycle or a release browser/network capture.

At that review point T089 and T092 remained open. The subsequent five-cycle execution completed T089; the browser and two-worker manual evidence for T092 remains outstanding.

## Five-cycle acceptance result (2026-08-14)

T089 passed against the isolated high-volume schema after five identical workloads and five 15-minute stabilization windows. API RSS peaked at 112.75 MiB, web RSS at 72.38 MiB, and stabilized API heap grew 1.68%; external and array buffers remained stable. All workload steps passed, API pressure remained `NORMAL`, and neither process restarted or produced an OOM.

T092 remains a release gate only for the manual browser Network-panel capture and the two-process worker kill/lease-expiry drill listed in `quickstart.md`. Its automated polling and recovery equivalents pass, but are not represented as manual evidence.
