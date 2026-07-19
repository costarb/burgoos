CREATE TYPE "SalesProvider" AS ENUM ('PAGBANK');
CREATE TYPE "SalesInputChannel" AS ENUM ('API', 'FILE', 'OTHER');
CREATE TYPE "SalesIntegrationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'REQUIRES_ATTENTION', 'DISABLED');
CREATE TYPE "SalesCredentialStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED');
CREATE TYPE "SalesImportRunStatus" AS ENUM ('PENDING', 'FETCHING', 'PREVIEW_READY', 'PARTIALLY_READY', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');
CREATE TYPE "SalesImportDayStatus" AS ENUM ('PENDING', 'FETCHING', 'READY', 'BLOCKED_NOT_VALIDATED', 'BLOCKED_DATE', 'FAILED');
CREATE TYPE "ExternalMovementKind" AS ENUM ('SALE', 'NON_SALE', 'UNKNOWN');
CREATE TYPE "ExternalMovementStatus" AS ENUM ('NEW', 'DUPLICATE', 'REJECTED', 'IMPORTING', 'IMPORTED', 'FAILED');

CREATE TABLE "sales_integrations" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "provider" "SalesProvider" NOT NULL,
  "channel" "SalesInputChannel" NOT NULL DEFAULT 'API', "status" "SalesIntegrationStatus" NOT NULL DEFAULT 'DRAFT',
  "display_name" TEXT NOT NULL, "external_merchant_id" TEXT, "settings" JSONB NOT NULL DEFAULT '{}',
  "last_validation_at" TIMESTAMP(3), "last_error_code" TEXT, "last_error_message" TEXT,
  "created_by_user_id" UUID, "updated_by_user_id" UUID, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "sales_integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_integrations_tenant_id_provider_channel_key" ON "sales_integrations"("tenant_id", "provider", "channel");
CREATE INDEX "sales_integrations_tenant_id_status_idx" ON "sales_integrations"("tenant_id", "status");

CREATE TABLE "sales_integration_credentials" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "integration_id" UUID NOT NULL,
  "status" "SalesCredentialStatus" NOT NULL DEFAULT 'ACTIVE', "credential_type" TEXT NOT NULL,
  "secret_ciphertext" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "created_by_user_id" UUID,
  "rotated_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_integration_credentials_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_integration_credentials_tenant_id_integration_id_status_idx" ON "sales_integration_credentials"("tenant_id", "integration_id", "status");

CREATE TABLE "sales_import_runs" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "integration_id" UUID NOT NULL, "provider" "SalesProvider" NOT NULL,
  "channel" "SalesInputChannel" NOT NULL, "requested_by_user_id" UUID NOT NULL, "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL, "status" "SalesImportRunStatus" NOT NULL DEFAULT 'PENDING', "strategy" TEXT NOT NULL,
  "fixed_product_id" UUID, "counts" JSONB NOT NULL DEFAULT '{}', "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3),
  "error_code" TEXT, "error_message" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "sales_import_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_import_runs_tenant_id_created_at_idx" ON "sales_import_runs"("tenant_id", "created_at");
CREATE INDEX "sales_import_runs_tenant_id_integration_id_status_idx" ON "sales_import_runs"("tenant_id", "integration_id", "status");
CREATE INDEX "sales_import_runs_tenant_id_provider_start_date_end_date_idx" ON "sales_import_runs"("tenant_id", "provider", "start_date", "end_date");

CREATE TABLE "sales_import_days" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "run_id" UUID NOT NULL, "movement_date" DATE NOT NULL,
  "status" "SalesImportDayStatus" NOT NULL DEFAULT 'PENDING', "validated" BOOLEAN, "pages_fetched" INTEGER NOT NULL DEFAULT 0,
  "total_pages" INTEGER, "total_elements" INTEGER, "error_code" TEXT, "error_message" TEXT,
  "started_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3), CONSTRAINT "sales_import_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_import_days_run_id_movement_date_key" ON "sales_import_days"("run_id", "movement_date");
CREATE INDEX "sales_import_days_tenant_id_status_idx" ON "sales_import_days"("tenant_id", "status");

CREATE TABLE "external_sales_movements" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "run_id" UUID NOT NULL, "day_id" UUID NOT NULL, "integration_id" UUID NOT NULL,
  "provider" "SalesProvider" NOT NULL, "channel" "SalesInputChannel" NOT NULL, "provider_movement_id" TEXT NOT NULL,
  "external_sale_id" TEXT, "external_event_code" TEXT, "kind" "ExternalMovementKind" NOT NULL,
  "status" "ExternalMovementStatus" NOT NULL DEFAULT 'NEW', "occurred_at" TIMESTAMP(3),
  "gross_amount" DECIMAL(12,2), "net_amount" DECIMAL(12,2), "fee_amount" DECIMAL(12,2),
  "payment_method" "PaymentMethod", "installments" INTEGER, "normalized_data" JSONB, "raw_payload" JSONB NOT NULL,
  "rejection_code" TEXT, "rejection_message" TEXT, "order_id" UUID, "imported_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_sales_movements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_sales_movements_run_id_provider_movement_id_key" ON "external_sales_movements"("run_id", "provider_movement_id");
CREATE INDEX "external_sales_movements_tenant_id_run_id_status_idx" ON "external_sales_movements"("tenant_id", "run_id", "status");
CREATE INDEX "external_sales_movements_tenant_id_provider_external_sale_id_idx" ON "external_sales_movements"("tenant_id", "provider", "external_sale_id");

CREATE TABLE "external_sale_identities" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "provider" "SalesProvider" NOT NULL, "external_sale_id" TEXT NOT NULL,
  "first_channel" "SalesInputChannel" NOT NULL, "order_id" UUID, "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "imported_at" TIMESTAMP(3), CONSTRAINT "external_sale_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_sale_identities_tenant_id_provider_external_sale_id_key" ON "external_sale_identities"("tenant_id", "provider", "external_sale_id");
CREATE INDEX "external_sale_identities_tenant_id_order_id_idx" ON "external_sale_identities"("tenant_id", "order_id");

ALTER TABLE "sales_integrations" ADD CONSTRAINT "sales_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_integrations" ADD CONSTRAINT "sales_integrations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_integrations" ADD CONSTRAINT "sales_integrations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_integration_credentials" ADD CONSTRAINT "sales_integration_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_integration_credentials" ADD CONSTRAINT "sales_integration_credentials_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_integration_credentials" ADD CONSTRAINT "sales_integration_credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_import_runs" ADD CONSTRAINT "sales_import_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_import_runs" ADD CONSTRAINT "sales_import_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_import_runs" ADD CONSTRAINT "sales_import_runs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_import_days" ADD CONSTRAINT "sales_import_days_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_import_days" ADD CONSTRAINT "sales_import_days_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "sales_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_sales_movements" ADD CONSTRAINT "external_sales_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_sales_movements" ADD CONSTRAINT "external_sales_movements_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "sales_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_sales_movements" ADD CONSTRAINT "external_sales_movements_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "sales_import_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_sales_movements" ADD CONSTRAINT "external_sales_movements_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_sales_movements" ADD CONSTRAINT "external_sales_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_sale_identities" ADD CONSTRAINT "external_sale_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_sale_identities" ADD CONSTRAINT "external_sale_identities_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
