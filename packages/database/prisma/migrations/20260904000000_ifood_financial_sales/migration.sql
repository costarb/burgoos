-- CreateEnum
CREATE TYPE "IfoodFinancialReadinessStatus" AS ENUM ('PENDING_PERMISSION', 'READY_TEST', 'READY_PRODUCTION', 'REQUIRES_ATTENTION');

-- CreateEnum
CREATE TYPE "FinancialReconciliationStatus" AS ENUM ('PENDING', 'FETCHING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "FinancialReconciliationTrigger" AS ENUM ('MANUAL', 'DAILY', 'HOMOLOGATION');

-- CreateEnum
CREATE TYPE "ExternalSettlementReconciliationStatus" AS ENUM ('MATCHED', 'DIVERGENT', 'PENDING', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ExternalReconciliationFileStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'READY', 'EXPIRED', 'FAILED');

-- AlterEnum
ALTER TYPE "PaymentInstitution" ADD VALUE 'IFOOD';

-- AlterEnum
ALTER TYPE "SalesProvider" ADD VALUE 'IFOOD';

-- AlterEnum
ALTER TYPE "BackgroundJobType" ADD VALUE 'IFOOD_FINANCIAL_RECONCILIATION';

-- AlterTable
ALTER TABLE "delivery_integrations" ADD COLUMN "environment" "SalesIntegrationEnvironment";

-- Legacy operational connections are production connections. Keep the explicit
-- backfill before replacing uniqueness so the migration remains safe if the
-- column default changes in a future schema revision.
UPDATE "delivery_integrations" SET "environment" = 'PRODUCTION' WHERE "environment" IS NULL;

ALTER TABLE "delivery_integrations"
ALTER COLUMN "environment" SET DEFAULT 'PRODUCTION',
ALTER COLUMN "environment" SET NOT NULL;

-- DropIndex
DROP INDEX "delivery_integrations_tenant_id_provider_key";

-- AlterTable
ALTER TABLE "sales_integrations" ADD COLUMN     "delivery_integration_id" UUID,
ADD COLUMN     "financial_readiness" "IfoodFinancialReadinessStatus",
ADD COLUMN     "homologation_evidence" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "external_financial_sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "environment" "SalesIntegrationEnvironment" NOT NULL,
    "provider" "SalesProvider" NOT NULL,
    "external_sale_id" TEXT NOT NULL,
    "external_merchant_id" TEXT NOT NULL,
    "short_id" TEXT,
    "order_id" UUID,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "sales_channel" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "merchant_timezone" TEXT NOT NULL,
    "bag_amount" DECIMAL(12,2) NOT NULL,
    "delivery_fee_amount" DECIMAL(12,2) NOT NULL,
    "service_fee_amount" DECIMAL(12,2) NOT NULL,
    "benefits_amount" DECIMAL(12,2) NOT NULL,
    "customer_paid_amount" DECIMAL(12,2) NOT NULL,
    "sale_balance_amount" DECIMAL(12,2) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "provider_updated_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_financial_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sale_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "provider_payment_key" TEXT NOT NULL,
    "provider_method" TEXT NOT NULL,
    "mapped_method" "PaymentMethod",
    "payment_type" TEXT,
    "liability" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "brand" TEXT,
    "nsu" TEXT,
    "acquirer_document_masked" TEXT,
    "installment_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sale_installments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "sequence" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "expected_payment_date" DATE,
    "status" TEXT,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "external_sale_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_financial_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "sale_id" UUID,
    "provider_event_key" TEXT NOT NULL,
    "external_order_id" TEXT,
    "name" TEXT NOT NULL,
    "trigger" TEXT,
    "description" TEXT,
    "competence" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "has_transfer_impact" BOOLEAN NOT NULL,
    "base_amount" DECIMAL(12,2),
    "fee_percentage" DECIMAL(8,4),
    "expected_payment_date" DATE,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "settlement_external_id" TEXT,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_financial_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_settlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "external_settlement_id" TEXT NOT NULL,
    "product" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "calculation_start" DATE,
    "calculation_end" DATE,
    "expected_payment_date" DATE,
    "paid_at" TIMESTAMP(3),
    "gross_amount" DECIMAL(12,2),
    "net_amount" DECIMAL(12,2) NOT NULL,
    "reconciliation_status" "ExternalSettlementReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "divergence_amount" DECIMAL(12,2),
    "raw_payload" JSONB NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_reconciliation_files" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "competence" TEXT NOT NULL,
    "provider_request_id" TEXT NOT NULL,
    "status" "ExternalReconciliationFileStatus" NOT NULL DEFAULT 'REQUESTED',
    "order_count" INTEGER,
    "line_count" INTEGER,
    "download_url_ciphertext" TEXT,
    "expires_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "external_reconciliation_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_reconciliation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "requested_by_user_id" UUID,
    "trigger" "FinancialReconciliationTrigger" NOT NULL DEFAULT 'MANUAL',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "FinancialReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "sales_count" INTEGER NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "settlement_count" INTEGER NOT NULL DEFAULT 0,
    "divergent_count" INTEGER NOT NULL DEFAULT 0,
    "cursor" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_financial_sales_tenant_id_occurred_at_idx" ON "external_financial_sales"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "external_financial_sales_tenant_id_integration_id_status_idx" ON "external_financial_sales"("tenant_id", "integration_id", "status");

-- CreateIndex
CREATE INDEX "external_financial_sales_tenant_id_order_id_idx" ON "external_financial_sales"("tenant_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_financial_sales_tenant_id_provider_environment_ext_key" ON "external_financial_sales"("tenant_id", "provider", "environment", "external_sale_id");

-- CreateIndex
CREATE INDEX "external_sale_payments_tenant_id_mapped_method_liability_idx" ON "external_sale_payments"("tenant_id", "mapped_method", "liability");

-- CreateIndex
CREATE UNIQUE INDEX "external_sale_payments_sale_id_provider_payment_key_key" ON "external_sale_payments"("sale_id", "provider_payment_key");

-- CreateIndex
CREATE INDEX "external_sale_installments_tenant_id_expected_payment_date_idx" ON "external_sale_installments"("tenant_id", "expected_payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "external_sale_installments_payment_id_reference_key" ON "external_sale_installments"("payment_id", "reference");

-- CreateIndex
CREATE INDEX "external_financial_events_tenant_id_sale_id_idx" ON "external_financial_events"("tenant_id", "sale_id");

-- CreateIndex
CREATE INDEX "external_financial_events_tenant_id_competence_idx" ON "external_financial_events"("tenant_id", "competence");

-- CreateIndex
CREATE INDEX "external_financial_events_tenant_id_expected_payment_date_idx" ON "external_financial_events"("tenant_id", "expected_payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "external_financial_events_tenant_id_integration_id_provider_key" ON "external_financial_events"("tenant_id", "integration_id", "provider_event_key");

-- CreateIndex
CREATE INDEX "external_settlements_tenant_id_expected_payment_date_idx" ON "external_settlements"("tenant_id", "expected_payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "external_settlements_tenant_id_integration_id_external_sett_key" ON "external_settlements"("tenant_id", "integration_id", "external_settlement_id");

-- CreateIndex
CREATE INDEX "external_reconciliation_files_tenant_id_integration_id_comp_idx" ON "external_reconciliation_files"("tenant_id", "integration_id", "competence", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_reconciliation_files_tenant_id_integration_id_prov_key" ON "external_reconciliation_files"("tenant_id", "integration_id", "provider_request_id");

-- CreateIndex
CREATE INDEX "financial_reconciliation_runs_tenant_id_integration_id_stat_idx" ON "financial_reconciliation_runs"("tenant_id", "integration_id", "status");

-- CreateIndex
CREATE INDEX "financial_reconciliation_runs_tenant_id_created_at_idx" ON "financial_reconciliation_runs"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_integrations_tenant_id_provider_environment_key" ON "delivery_integrations"("tenant_id", "provider", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "sales_integrations_delivery_integration_id_key" ON "sales_integrations"("delivery_integration_id");

-- AddForeignKey
ALTER TABLE "sales_integrations" ADD CONSTRAINT "sales_integrations_delivery_integration_id_fkey" FOREIGN KEY ("delivery_integration_id") REFERENCES "delivery_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_financial_sales" ADD CONSTRAINT "external_financial_sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_financial_sales" ADD CONSTRAINT "external_financial_sales_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_financial_sales" ADD CONSTRAINT "external_financial_sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sale_payments" ADD CONSTRAINT "external_sale_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sale_payments" ADD CONSTRAINT "external_sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "external_financial_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sale_installments" ADD CONSTRAINT "external_sale_installments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sale_installments" ADD CONSTRAINT "external_sale_installments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "external_sale_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_financial_events" ADD CONSTRAINT "external_financial_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_financial_events" ADD CONSTRAINT "external_financial_events_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_financial_events" ADD CONSTRAINT "external_financial_events_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "external_financial_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_settlements" ADD CONSTRAINT "external_settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_settlements" ADD CONSTRAINT "external_settlements_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reconciliation_files" ADD CONSTRAINT "external_reconciliation_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reconciliation_files" ADD CONSTRAINT "external_reconciliation_files_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliation_runs" ADD CONSTRAINT "financial_reconciliation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliation_runs" ADD CONSTRAINT "financial_reconciliation_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliation_runs" ADD CONSTRAINT "financial_reconciliation_runs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
