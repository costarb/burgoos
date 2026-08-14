CREATE TYPE "BackgroundJobType" AS ENUM ('EXPORT', 'SALES_IMPORT_PREVIEW', 'SALES_IMPORT_CONFIRM', 'PROVIDER_WEBHOOK', 'PAYMENT_WEBHOOK', 'IFOOD_POLL', 'MP_RECONCILIATION', 'MP_TOKEN_REFRESH', 'POINT_RECONCILIATION', 'RETENTION');
CREATE TYPE "BackgroundJobPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "BackgroundJobAttemptOutcome" AS ENUM ('RUNNING', 'SUCCEEDED', 'RETRY', 'FAILED', 'ABANDONED', 'CANCELLED');
CREATE TYPE "AssetStorageProvider" AS ENUM ('LOCAL', 'OBJECT_STORAGE');

CREATE TABLE "background_jobs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "type" "BackgroundJobType" NOT NULL,
  "priority" "BackgroundJobPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "active_key" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leased_by" TEXT,
  "lease_expires_at" TIMESTAMP(3),
  "lease_version" INTEGER NOT NULL DEFAULT 0,
  "heartbeat_at" TIMESTAMP(3),
  "progress_current" INTEGER,
  "progress_total" INTEGER,
  "progress_message" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "background_jobs_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" > 0),
  CONSTRAINT "background_jobs_progress_check" CHECK ("progress_current" IS NULL OR ("progress_current" >= 0 AND ("progress_total" IS NULL OR "progress_total" >= "progress_current")))
);

CREATE TABLE "background_job_attempts" (
  "id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "attempt" INTEGER NOT NULL,
  "worker_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "outcome" "BackgroundJobAttemptOutcome" NOT NULL DEFAULT 'RUNNING',
  "duration_ms" INTEGER,
  "processed_count" INTEGER,
  "error_code" TEXT,
  "memory_start" JSONB,
  "memory_end" JSONB,
  CONSTRAINT "background_job_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "background_job_attempts_values_check" CHECK (("duration_ms" IS NULL OR "duration_ms" >= 0) AND ("processed_count" IS NULL OR "processed_count" >= 0))
);

ALTER TABLE "export_jobs"
  ADD COLUMN "background_job_id" UUID,
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "processed_rows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total_rows" INTEGER,
  ADD COLUMN "storage_provider" "AssetStorageProvider" NOT NULL DEFAULT 'LOCAL',
  ADD CONSTRAINT "export_jobs_progress_check" CHECK ("processed_rows" >= 0 AND ("total_rows" IS NULL OR "total_rows" >= "processed_rows"));

CREATE INDEX "background_jobs_status_available_at_priority_created_at_idx" ON "background_jobs"("status", "available_at", "priority", "created_at");
CREATE INDEX "background_jobs_tenant_id_status_created_at_idx" ON "background_jobs"("tenant_id", "status", "created_at");
CREATE INDEX "background_jobs_target_type_target_id_created_at_idx" ON "background_jobs"("target_type", "target_id", "created_at");
CREATE INDEX "background_jobs_active_key_idx" ON "background_jobs"("active_key");
CREATE UNIQUE INDEX "background_jobs_active_key_active_unique" ON "background_jobs"("active_key") WHERE "active_key" IS NOT NULL AND "status" IN ('PENDING', 'RUNNING', 'RETRY_WAIT');
CREATE UNIQUE INDEX "background_job_attempts_job_id_attempt_key" ON "background_job_attempts"("job_id", "attempt");
CREATE INDEX "background_job_attempts_finished_at_outcome_idx" ON "background_job_attempts"("finished_at", "outcome");
CREATE UNIQUE INDEX "export_jobs_background_job_id_key" ON "export_jobs"("background_job_id");
CREATE INDEX "export_jobs_tenant_id_fingerprint_status_idx" ON "export_jobs"("tenant_id", "fingerprint", "status");

ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "background_job_attempts" ADD CONSTRAINT "background_job_attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "background_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_background_job_id_fkey" FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
