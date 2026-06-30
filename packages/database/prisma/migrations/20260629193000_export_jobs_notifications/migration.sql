CREATE TYPE "ExportContext" AS ENUM ('PAYABLES');
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'PDF', 'XLSX');
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "OperationalNotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
CREATE TYPE "OperationalNotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "context" "ExportContext" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "filters_snapshot" JSONB NOT NULL,
    "columns_snapshot" JSONB,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "file_name" TEXT,
    "file_mime_type" TEXT,
    "file_storage_key" TEXT,
    "file_size_bytes" INTEGER,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "export_job_id" UUID,
    "type" TEXT NOT NULL,
    "status" "OperationalNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "severity" "OperationalNotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action_label" TEXT,
    "action_url" TEXT,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "operational_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "export_jobs_tenant_id_context_status_idx" ON "export_jobs"("tenant_id", "context", "status");
CREATE INDEX "export_jobs_tenant_id_requested_by_user_id_requested_at_idx" ON "export_jobs"("tenant_id", "requested_by_user_id", "requested_at");
CREATE INDEX "export_jobs_status_requested_at_idx" ON "export_jobs"("status", "requested_at");
CREATE INDEX "operational_notifications_tenant_id_recipient_user_id_status_created_at_idx" ON "operational_notifications"("tenant_id", "recipient_user_id", "status", "created_at");
CREATE INDEX "operational_notifications_tenant_id_export_job_id_idx" ON "operational_notifications"("tenant_id", "export_job_id");

ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_notifications" ADD CONSTRAINT "operational_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_notifications" ADD CONSTRAINT "operational_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_notifications" ADD CONSTRAINT "operational_notifications_export_job_id_fkey" FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
