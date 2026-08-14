# Tasks: Controle de Memória e Processamento em Segundo Plano

**Input**: Design documents from `/specs/018-memory-optimization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by FR-028, SC-001 through SC-010 and the project constitution. Write focused tests before each implementation group and retain baseline evidence.

**Organization**: Tasks are grouped by user story so each increment can be implemented and validated independently. All paths are repository-relative.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no dependency on an incomplete task in the same phase.
- **[Story]**: Maps the task to a user story in `spec.md`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish configuration, scripts and module boundaries without changing runtime behavior.

- [X] T001 Add memory, role, polling, job concurrency, batch, lease and asset limit variables with safe defaults to apps/api/.env.example
- [X] T002 [P] Add web polling and direct-upload configuration variables to .env.example
- [X] T003 [P] Configure Next.js standalone production output in apps/web/next.config.mjs
- [X] T004 [P] Add API worker-role start scripts, memory-load scripts and the selected streaming XLSX writer dependency to apps/api/package.json and package.json
- [X] T005 Create background-jobs, observability and storage module directories with module entry points in apps/api/src/common/background-jobs/background-jobs.module.ts, apps/api/src/common/observability/observability.module.ts and apps/api/src/common/storage/storage.module.ts
- [X] T006 [P] Create the shared adaptive polling directory and public exports in apps/web/lib/adaptive-polling/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add validated configuration, deploy roles and storage abstractions used across the stories.

**Critical**: Complete this phase before user-story implementation.

- [X] T007 Add strict environment parsing for APP_ROLE, memory thresholds, body limit, connection guidance, polling limits and worker defaults in apps/api/src/config/env.validation.ts
- [X] T008 [P] Add unit tests for accepted roles, safe defaults and rejected resource-limit combinations in apps/api/src/config/env.validation.spec.ts
- [X] T009 Implement role-aware application bootstrap that conditionally enables HTTP controllers and background consumers in apps/api/src/main.ts and apps/api/src/app.module.ts
- [X] T010 [P] Add bootstrap tests covering api, worker and all roles plus production Swagger disablement in apps/api/src/main.spec.ts
- [X] T011 Define stream-oriented AssetStorage interfaces, S3-compatible production adapter, authenticated local development adapter and bounded metadata types in apps/api/src/common/storage/asset-storage.ts, apps/api/src/common/storage/s3-asset-storage.service.ts and apps/api/src/common/storage/local-asset-storage.service.ts
- [X] T012 [P] Add shared storage contract tests for streaming write/read/delete, signed intent, size enforcement and tenant path isolation in apps/api/src/common/storage/asset-storage.contract.spec.ts
- [X] T013 Register common resource-control modules and role configuration in apps/api/src/app.module.ts
- [X] T014 Document production heap, connection pool, APP_ROLE and storage deployment settings in specs/018-memory-optimization/runbook.md

**Checkpoint**: API roles and shared resource abstractions are ready; no business workflow has been migrated.

---

## Phase 3: User Story 1 - Operação estável sob limite de memória (Priority: P1) MVP

**Goal**: Measure memory pressure, enforce admission guardrails and establish a reproducible baseline without interrupting critical flows.

**Independent Test**: Run five representative cycles and the reduced smoke soak; verify process metrics, pressure transitions, low-priority admission blocking and continued POS/KDS/payment health.

### Tests for User Story 1

- [X] T015 [P] [US1] Add unit tests for two-sample normal, warning, high-pressure and recovery hysteresis transitions in apps/api/src/common/observability/memory-pressure.service.spec.ts
- [X] T016 [P] [US1] Add integration tests proving critical work remains admissible while normal/low work is paused under pressure in apps/api/test/resource-admission.integration.spec.ts
- [X] T017 [P] [US1] Create deterministic five-cycle and soak workload fixtures for reports, POS, KDS, polling and jobs in scripts/memory-load/scenarios.ts

### Implementation for User Story 1

- [X] T018 [US1] Implement periodic process.memoryUsage and event-loop lag sampling with unref cleanup in apps/api/src/common/observability/process-resource-monitor.service.ts
- [X] T019 [US1] Implement threshold hysteresis and priority-aware admission decisions in apps/api/src/common/observability/memory-pressure.service.ts
- [X] T020 [P] [US1] Add request/job correlation context types that exclude payloads and secrets in apps/api/src/common/observability/resource-correlation.ts
- [X] T021 [US1] Emit structured start/end resource snapshots for heavy operations through apps/api/src/common/observability/resource-operation.service.ts
- [X] T022 [US1] Reduce the default API body limit, support route-specific exceptions and disable Swagger document generation in production in apps/api/src/main.ts
- [X] T023 [P] [US1] Implement web/API PID-or-container RSS sampling, API detailed metric collection and CSV/JSON workload output in scripts/memory-load/run-memory-soak.mjs
- [X] T024 [US1] Capture the pre-optimization baseline and acceptance thresholds in specs/018-memory-optimization/baseline.md

**Checkpoint**: Memory pressure is observable and low-priority admission can be controlled; MVP can be deployed without migrating jobs.

---

## Phase 4: User Story 2 - Jobs e integrações com carga controlada (Priority: P2)

**Goal**: Make existing jobs durable, bounded, recoverable and safe across multiple instances.

**Independent Test**: Start two workers with 100 recoverable jobs, kill one after claim and verify bounded concurrency, one recovery, no duplicate domain effects and continued critical API availability.

### Tests for User Story 2

- [X] T025 [P] [US2] Add database integration tests for active-key dedupe, atomic lease, heartbeat, stale-owner rejection and expired-lease recovery in apps/api/test/background-job-lease.integration.spec.ts
- [X] T026 [P] [US2] Add unit tests for retry backoff, jitter, max attempts, priority and per-tenant fairness in apps/api/src/common/background-jobs/background-job-policy.spec.ts
- [X] T027 [P] [US2] Add two-worker recovery and 100-job startup tests in apps/api/test/background-job-worker.e2e.spec.ts
- [X] T028 [P] [US2] Add iFood paging, per-integration exclusion and sequential event tests in apps/api/src/management/integrations/ifood/ifood-event-poller.service.spec.ts
- [X] T029 [P] [US2] Add Mercado Pago short/daily overlap and bounded connection concurrency tests in apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-reconciliation.service.spec.ts and apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-refresh.scheduler.spec.ts
- [X] T030 [P] [US2] Add Point distributed-claim and preserved batch-25 tests in apps/api/src/payments/mercado-pago-point/point-reconciliation.service.spec.ts
- [X] T031 [P] [US2] Add restart-safe webhook and bounded import-recovery integration tests in apps/api/test/background-processing-recovery.integration.spec.ts

### Data model and core worker

- [X] T032 [US2] Add BackgroundJob with leaseVersion, BackgroundJobAttempt, enums, tenant relations and ExportJob orchestration/retention fields to packages/database/prisma/schema.prisma
- [X] T033 [US2] Create additive SQL migration with partial active-key uniqueness and claim indexes in packages/database/prisma/migrations/20260807090000_background_job_resource_control/migration.sql
- [X] T034 [P] [US2] Add shared background-job types and safe handler contracts in packages/types/src/background-jobs.ts and packages/types/src/index.ts
- [X] T035 [US2] Implement durable enqueue, fingerprint dedupe and tenant scoping in apps/api/src/common/background-jobs/background-job.service.ts
- [X] T036 [US2] Implement atomic ordered lease, heartbeat, progress, completion, retry and lease recovery in apps/api/src/common/background-jobs/background-job.repository.ts
- [X] T037 [US2] Implement concurrency-1 worker loop with admission checks, per-handler policies and graceful shutdown in apps/api/src/common/background-jobs/background-job.worker.ts
- [X] T038 [US2] Implement handler registry with duplicate-handler validation and role-based consumer enablement in apps/api/src/common/background-jobs/background-job.registry.ts
- [X] T039 [US2] Register worker, repository, recovery scheduler and policies in apps/api/src/common/background-jobs/background-jobs.module.ts

### Existing job migrations

- [X] T040 [US2] Replace in-process export fire-and-forget dispatch with durable enqueue and active fingerprint reuse in apps/api/src/management/exports/export-job.service.ts and apps/api/src/management/exports/export-job.worker.ts
- [X] T041 [US2] Replace startup-wide sales import dispatch with paged durable recovery jobs in apps/api/src/management/sales-integrations/sales-import-run.processor.ts
- [X] T042 [US2] Persist and enqueue provider/payment webhook processing instead of volatile setImmediate dispatch in apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-webhook.service.ts and apps/api/src/payments/webhooks/payment-provider-event.processor.ts
- [X] T043 [US2] Page due iFood integrations and enqueue one fair, deduplicated job per integration in apps/api/src/management/integrations/ifood/ifood-event-poller.service.ts
- [X] T044 [US2] Migrate Mercado Pago reconciliation and token refresh discovery to paged jobs with shared per-integration exclusion in apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-reconciliation.scheduler.ts and apps/api/src/management/sales-integrations/mercado-pago/mercado-pago-refresh.scheduler.ts
- [X] T045 [US2] Add distributed stale-charge claim and durable Point reconciliation handler in apps/api/src/payments/mercado-pago-point/point-reconciliation.service.ts and apps/api/src/payments/mercado-pago-point/point-reconciliation.scheduler.ts
- [X] T046 [US2] Convert retention into bounded delete batches with deadline and continuation jobs in apps/api/src/management/sales-integrations/sales-import-retention.service.ts
- [X] T047 [US2] Add per-handler feature flags that prevent legacy and durable consumers from running together in apps/api/src/config/env.validation.ts and specs/018-memory-optimization/runbook.md

**Checkpoint**: All inventoried server jobs are durable or bounded and coordinate across instances.

---

## Phase 5: User Story 3 - Atualizações periódicas eficientes (Priority: P2)

**Goal**: Reduce periodic request and allocation volume without violating notification, KDS, payment or queue freshness.

**Independent Test**: Simulate 20 users with two tabs, hide half the tabs and verify no overlap, at least 70% hidden-tab reduction, backoff after failures and notification visibility within 30 seconds p95.

### Tests for User Story 3

- [X] T048 [P] [US3] Add fake-timer tests for no-overlap, abort, visibility intervals, immediate resume, backoff and jitter in apps/web/lib/adaptive-polling/use-adaptive-polling.spec.tsx
- [X] T049 [P] [US3] Add notification summary/delta service and controller tests including ETag/304 and tenant/user isolation in apps/api/src/management/notifications/notifications.service.spec.ts and apps/api/src/management/notifications/notifications.controller.spec.ts
- [X] T050 [P] [US3] Add component tests proving badge summary polling and bounded incremental notification list updates in apps/web/components/admin/notification-center-button.spec.tsx and apps/web/app/admin/notifications/notifications-client.spec.tsx
- [X] T051 [P] [US3] Add KDS, Point and public queue visibility/no-overlap tests in apps/web/app/admin/orders/use-kds-orders.spec.tsx, apps/web/app/admin/pos/use-payment-charge.spec.ts and apps/web/app/(public-menu)/fila/public-order-queue.spec.tsx

### Implementation for User Story 3

- [X] T052 [US3] Implement shared abortable adaptive polling controller and React hook in apps/web/lib/adaptive-polling/adaptive-poller.ts and apps/web/lib/adaptive-polling/use-adaptive-polling.ts
- [X] T053 [P] [US3] Add notification summary and cursor/delta contract types in packages/types/src/notifications.ts
- [X] T054 [US3] Implement summary count/version, ETag and cursor/delta queries in apps/api/src/management/notifications/notifications.service.ts and apps/api/src/management/notifications/notifications.controller.ts
- [X] T055 [US3] Add notification summary/delta client calls with conditional requests in apps/web/lib/api.ts
- [X] T056 [US3] Migrate the global badge and notification page to adaptive polling and a 50-item bound in apps/web/components/admin/notification-center-button.tsx and apps/web/app/admin/notifications/notifications-client.tsx
- [X] T057 [P] [US3] Migrate admin session refresh to the shared polling lifecycle in apps/web/components/admin/admin-shell.tsx
- [X] T058 [US3] Make Socket.io the KDS primary path and use adaptive recovery polling without overlap in apps/web/app/admin/orders/use-kds-orders.ts
- [X] T059 [P] [US3] Migrate active Point charge tracking to abortable polling that stops on terminal state in apps/web/app/admin/pos/use-payment-charge.ts
- [X] T060 [P] [US3] Migrate public queue polling to visibility-aware refresh and remove unnecessary permanent one-second rendering in apps/web/app/(public-menu)/fila/public-order-queue.tsx

**Checkpoint**: Browser polling load scales with visible active work rather than total open tabs.

---

## Phase 6: User Story 4 - Relatórios, exportações e imagens com volume limitado (Priority: P2)

**Goal**: Eliminate full-history and full-file materialization from interactive and background flows.

**Independent Test**: Query thousands of orders, generate bounded CSV/XLSX/PDF and upload boundary images while verifying database pagination, streaming backpressure, early rejection and memory thresholds.

### Tests for User Story 4

- [X] T061 [P] [US4] Add integration fixtures comparing database aggregates with current sales calculations across payment/channel/date dimensions in apps/api/test/sales-report-memory.integration.spec.ts
- [X] T062 [P] [US4] Add management report and payables pagination tests proving bounded row loading in apps/api/test/management-report-memory.integration.spec.ts
- [X] T063 [P] [US4] Add export streaming, cursor batches, format limits, active dedupe and object-storage recovery tests in apps/api/src/management/exports/export-job.worker.spec.ts
- [X] T064 [P] [US4] Add upload intent validation tests for MIME signature, 2 MiB, 4096 dimensions, tenant paths and expiry in apps/api/test/asset-upload.integration.spec.ts
- [X] T065 [P] [US4] Add web tests that reject oversized images before arrayBuffer/base64 creation in apps/web/app/admin/branding/branding.spec.tsx and apps/web/app/admin/catalog/catalog-client.spec.tsx

### Reports and exports

- [X] T066 [US4] Replace full sales order loading with database aggregate queries plus true analytical pagination in apps/api/src/management/reports/sales-report.service.ts
- [X] T067 [US4] Replace concurrent full collections in management reporting with bounded aggregates and staged execution in apps/api/src/management/reports/management-report.service.ts
- [X] T068 [P] [US4] Add query pagination and separate summary aggregation for payables in apps/api/src/management/financial/accounts-payable/accounts-payable.service.ts and apps/api/src/management/financial/dto/payable.dto.ts
- [X] T069 [US4] Enforce 31-day default and 92-day interactive report limits with actionable validation responses in apps/api/src/management/reports/sales-report.types.ts and apps/api/src/management/reports/management-report.types.ts
- [X] T070 [US4] Refactor export providers to expose count and cursor-batch iteration instead of ExportDataset rows in apps/api/src/management/exports/export-provider.registry.ts and apps/api/src/management/exports/providers/payables-export.provider.ts
- [X] T071 [US4] Replace the custom ZIP/buffer XLSX builder with the selected streaming writer and implement backpressure-aware CSV plus bounded PDF generation in apps/api/src/management/exports/export-job.worker.ts
- [X] T072 [US4] Stream generated files into AssetStorage, persist progress/storage metadata and stream downloads in apps/api/src/management/exports/export-job.worker.ts and apps/api/src/management/exports/export-job.controller.ts
- [X] T073 [P] [US4] Expose additive export progress fields from the resource-control contract in packages/types/src/exports.ts and apps/web/components/admin/async-export-menu.tsx

### Images and assets

- [X] T074 [US4] Implement tenant-scoped S3 signed intents, authenticated local PUT fallback, streaming size enforcement and signature/dimension confirmation in apps/api/src/common/storage/asset-upload.controller.ts and apps/api/src/common/storage/asset-upload.service.ts
- [X] T075 [US4] Replace branding Server Action base64 conversion with bounded direct upload and asset key submission in apps/web/app/admin/branding/page.tsx
- [X] T076 [US4] Replace catalog product image Data URL conversion with bounded direct upload in apps/web/app/admin/catalog/catalog-client.tsx
- [X] T077 [US4] Read object-storage assets by stream while retaining legacy URL/base64 compatibility in apps/api/src/catalog/controllers/public-menu.controller.ts and apps/api/src/catalog/catalog.service.ts

**Checkpoint**: Reports, exports and accepted images remain bounded independently of historical row count or file representation.

---

## Phase 7: User Story 5 - Diagnóstico operacional de memória e jobs (Priority: P2)

**Goal**: Make memory growth and delayed/failed jobs diagnosable within ten minutes without exposing sensitive data.

**Independent Test**: Trigger a known heavy job and a memory alert, then identify role, handler, tenant-safe correlation, duration, processed volume and outcome from emitted telemetry.

### Tests for User Story 5

- [X] T078 [P] [US5] Add redaction tests covering tokens, credentials, card fields and raw provider payloads in apps/api/src/common/observability/resource-redaction.spec.ts
- [X] T079 [P] [US5] Add job-attempt resource snapshot and abandoned-attempt retention tests in apps/api/test/background-job-observability.integration.spec.ts
- [X] T080 [P] [US5] Add alert-threshold and correlation fixture assertions to scripts/memory-load/resource-alerts.spec.ts

### Implementation for User Story 5

- [X] T081 [US5] Persist bounded start/end resource snapshots and safe attempt outcomes in apps/api/src/common/background-jobs/background-job.repository.ts
- [X] T082 [US5] Emit process-role, pressure-level, active handler, queue lag, duration and processed-count metrics in apps/api/src/common/observability/resource-metrics.service.ts
- [X] T083 [US5] Implement centralized resource/job redaction and bounded error messages in apps/api/src/common/observability/resource-redaction.ts
- [X] T084 [US5] Add health detail for role and pressure state without tenant or payload data in apps/api/src/platform/health.controller.ts
- [X] T085 [US5] Document metric names, alert thresholds, triage queries and ten-minute diagnosis procedure in specs/018-memory-optimization/runbook.md

**Checkpoint**: Operators can distinguish stable heap, recoverable buffers, native RSS growth and job-associated pressure.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature, rollout safety and documentation.

- [X] T086 [P] Add a machine-readable inventory of every server job and browser polling flow with owner, interval, batch, concurrency, lease, retry, priority, expected memory impact and feature flag in specs/018-memory-optimization/job-inventory.md
- [X] T087 Validate OpenAPI syntax and synchronize notification, export and upload behavior with specs/018-memory-optimization/contracts/resource-control.openapi.yaml
- [X] T088 Run API/web typecheck, lint and focused unit/integration suites and record commands/results in specs/018-memory-optimization/validation.md
- [X] T089 Run the five-cycle comparison and update before/after RSS, heap, external and arrayBuffers evidence in specs/018-memory-optimization/baseline.md
- [X] T090 Run the 8-hour representative soak or document the production-like execution owner and acceptance evidence in specs/018-memory-optimization/validation.md
- [X] T091 Validate tenant isolation, redaction, duplicate scheduling and rollback flags across all migrated handlers in apps/api/test/resource-control-security.e2e.spec.ts
- [ ] T092 Execute every quickstart scenario and finalize rollout/rollback checklist in specs/018-memory-optimization/quickstart.md and specs/018-memory-optimization/runbook.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks every user story.
- **US1 (Phase 3)**: Starts after Foundational and establishes the baseline/admission MVP.
- **US2 (Phase 4)**: Starts after Foundational; consumes US1 admission telemetry for pressure-aware claims, but its durable lease tests can begin in parallel with late US1 work.
- **US3 (Phase 5)**: Starts after Foundational and is independent of US2 except for shared final soak testing.
- **US4 (Phase 6)**: Report and image work starts after Foundational; durable export execution T070-T073 depends on US2 core tasks T032-T040.
- **US5 (Phase 7)**: Base redaction/metric work starts after US1; persisted attempt telemetry depends on US2 core tasks.
- **Polish (Phase 8)**: Depends on all stories selected for release.

### User Story Completion Order

```text
Setup -> Foundation -> US1 MVP
                     |-> US2 jobs -----------|
                     |-> US3 polling --------|-> US5 diagnostics -> Polish
                     `-> US4 reports/assets -|
                            `-> export portion depends on US2 core
```

### Within Each User Story

- Add tests first and confirm they fail for the intended behavior.
- Apply additive schema changes before repositories and workers.
- Implement bounded services before controllers/clients.
- Migrate one legacy consumer at a time and prove legacy/durable mutual exclusion.
- Complete the independent checkpoint before enabling the next handler in production.

### Parallel Opportunities

- T001-T006 contain independent configuration, web and module setup work where marked `[P]`.
- T008, T010 and T012 can run in parallel after their corresponding interface shape is agreed.
- US1 test harness, API resource monitoring and correlation types can progress in parallel.
- US2 handler-specific tests T028-T031 can run in parallel with core lease tests T025-T027.
- US3 notification API, adaptive polling core and KDS/Point/queue tests target separate files.
- US4 report, export and asset tests T061-T065 can run in parallel; image tasks T074-T077 are separate from reports T066-T073.
- US5 redaction, attempt persistence and load-alert tests can run in parallel.

## Parallel Examples

### User Story 2

```text
Track A: T025 -> T032 -> T033 -> T035 -> T036 -> T037
Track B: T028 -> T043 (iFood)
Track C: T029 -> T044 (Mercado Pago)
Track D: T030 -> T045 (Point)
Track E: T031 -> T041/T042 (imports and webhooks)
```

### User Story 3

```text
Track A: T048 -> T052 (adaptive polling core)
Track B: T049 -> T053 -> T054 (notification API)
Track C: T051 -> T058/T059/T060 (operational pollers)
After A+B: T055 -> T056 (notification clients)
```

### User Story 4

```text
Track A: T061/T062 -> T066/T067/T068/T069 (reports)
Track B: T063 -> T070/T071/T072/T073 (exports, after US2 core)
Track C: T064/T065 -> T074/T075/T076/T077 (assets)
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational.
2. Complete US1 measurement, pressure guardrails and baseline as the explicitly scoped MVP.
3. Stop and validate the five-cycle test plus critical-flow availability.
4. Deploy metrics/guardrails before changing job execution.

### Incremental Delivery

1. Deliver US1 baseline and runtime guardrails.
2. Deliver US2 core queue, then migrate export, imports, webhooks, iFood, MP, Point and retention one at a time.
3. Deliver US3 polling screen by screen, measuring request reduction.
4. Deliver US4 reports first, assets second and streaming exports after US2 queue is stable.
5. Deliver US5 dashboards/runbook and complete the 8-hour acceptance soak.

### Rollout Discipline

- Never enable legacy and durable consumers for the same handler together.
- Preserve domain idempotency and existing persisted records throughout migration.
- Keep `APP_ROLE=all` for local development; prefer isolated worker memory budgets in production.
- Stop at any checkpoint when RSS/heap targets regress and use the handler feature flag to roll back.

## Notes

- `[P]` marks tasks safe to execute concurrently only when their prerequisites are satisfied.
- Every task includes an exact repository path and produces a reviewable change or validation artifact.
- Existing unrelated untracked files are outside this feature and must remain untouched.
- Commit after each task or cohesive handler migration, not after partially switching a scheduler.
