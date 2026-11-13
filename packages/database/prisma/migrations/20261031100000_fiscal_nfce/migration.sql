-- CreateEnum
CREATE TYPE "FiscalProvider" AS ENUM ('BLING');

-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOGATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "FiscalEmissionMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "FiscalTaxRegime" AS ENUM ('SIMPLES_NACIONAL');

-- CreateEnum
CREATE TYPE "FiscalConnectionStatus" AS ENUM ('DRAFT', 'CONNECTED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "FiscalCertificateStatus" AS ENUM ('ACTIVE', 'REPLACED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'ERROR', 'CANCEL_PENDING', 'CANCELLED', 'CANCEL_FAILED');

-- CreateEnum
CREATE TYPE "FiscalDocumentEventType" AS ENUM ('CREATED', 'SUBMITTED', 'AUTHORIZED', 'REJECTED', 'ERROR', 'RETRY_SCHEDULED', 'SYNCED', 'CANCEL_REQUESTED', 'CANCEL_MANUAL_REQUIRED', 'CANCELLED', 'CANCEL_FAILED', 'DOCUMENTS_STORED', 'RETROACTIVE_CONFIRMED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessAuditEventType" ADD VALUE 'FISCAL_CONFIGURATION_CHANGED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'FISCAL_CONNECTION_CHANGED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'FISCAL_CERTIFICATE_CHANGED';
ALTER TYPE "AccessAuditEventType" ADD VALUE 'FISCAL_PROFILE_CHANGED';

-- AlterEnum
ALTER TYPE "SalesRunTrigger" ADD VALUE 'AUTOMATIC';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BackgroundJobType" ADD VALUE 'FISCAL_EMISSION';
ALTER TYPE "BackgroundJobType" ADD VALUE 'FISCAL_SYNC';
ALTER TYPE "BackgroundJobType" ADD VALUE 'FISCAL_CANCELLATION';
ALTER TYPE "BackgroundJobType" ADD VALUE 'SALES_AUTO_IMPORT';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "fiscal_profile_id" UUID;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "fiscal_profile_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "consumer_document" VARCHAR(14);

-- AlterTable
ALTER TABLE "sales_integrations" ADD COLUMN     "auto_import_consecutive_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "auto_import_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_import_fixed_product_id" UUID,
ADD COLUMN     "auto_import_last_alert_at" TIMESTAMP(3),
ADD COLUMN     "auto_import_last_attempt_at" TIMESTAMP(3),
ADD COLUMN     "auto_import_last_error_code" VARCHAR(40),
ADD COLUMN     "auto_import_last_lag_seconds" INTEGER,
ADD COLUMN     "auto_import_last_success_at" TIMESTAMP(3),
ADD COLUMN     "auto_import_strategy" VARCHAR(20);

-- AlterTable
ALTER TABLE "service_tabs" ADD COLUMN     "consumer_document" VARCHAR(14);

-- AlterTable
ALTER TABLE "product_complements" ADD COLUMN     "fiscal_profile_id" UUID;

-- CreateTable
CREATE TABLE "fiscal_configurations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "FiscalProvider",
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOGATION',
    "series" INTEGER,
    "emission_mode" "FiscalEmissionMode" NOT NULL DEFAULT 'MANUAL',
    "eligible_sources" "OrderSource"[] DEFAULT ARRAY['COUNTER', 'IMPORT', 'API']::"OrderSource"[],
    "default_cancel_reason" VARCHAR(255) NOT NULL DEFAULT 'Venda cancelada a pedido do cliente',
    "enabled_at" TIMESTAMP(3),
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_issuers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "legal_name" VARCHAR(120) NOT NULL,
    "trade_name" VARCHAR(120),
    "cnpj" CHAR(14) NOT NULL,
    "state_registration" VARCHAR(20) NOT NULL,
    "tax_regime" "FiscalTaxRegime" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
    "municipality_ibge_code" CHAR(7),
    "municipality_ibge_source" VARCHAR(10),
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_provider_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "FiscalProvider" NOT NULL,
    "status" "FiscalConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "credential_ciphertext" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "external_account_id" VARCHAR(120),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "last_validation_at" TIMESTAMP(3),
    "last_error_code" VARCHAR(40),
    "last_error_message" VARCHAR(255),
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fiscal_provider_configurations" (
    "id" UUID NOT NULL,
    "provider" "FiscalProvider" NOT NULL,
    "configuration_ciphertext" TEXT NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_fiscal_provider_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "FiscalCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "active_key" UUID,
    "secret_ciphertext" TEXT NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "cnpj" CHAR(14),
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "fingerprint_sha256" CHAR(64) NOT NULL,
    "last_expiry_alert_days" INTEGER,
    "uploaded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_at" TIMESTAMP(3),

    CONSTRAINT "fiscal_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "ncm" CHAR(8) NOT NULL,
    "cfop" CHAR(4) NOT NULL,
    "csosn" CHAR(3) NOT NULL,
    "origin" SMALLINT NOT NULL DEFAULT 0,
    "commercial_unit" VARCHAR(6) NOT NULL DEFAULT 'UN',
    "cest" CHAR(7),
    "benefit_code" VARCHAR(10),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID,
    "service_tab_id" UUID,
    "active_key" VARCHAR(60),
    "provider" "FiscalProvider" NOT NULL,
    "environment" "FiscalEnvironment" NOT NULL,
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" VARCHAR(12) NOT NULL,
    "external_id" VARCHAR(80),
    "number" INTEGER,
    "series" INTEGER,
    "access_key" CHAR(44),
    "protocol" VARCHAR(40),
    "issued_at" TIMESTAMP(3),
    "authorized_at" TIMESTAMP(3),
    "sale_occurred_at" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "consumer_document" VARCHAR(14),
    "issuer_snapshot" JSONB NOT NULL,
    "payload_snapshot" JSONB NOT NULL,
    "rejection_code" VARCHAR(40),
    "rejection_message" VARCHAR(500),
    "xml_asset_key" VARCHAR(255),
    "danfe_asset_key" VARCHAR(255),
    "qr_code_url" VARCHAR(1000),
    "consultation_url" VARCHAR(1000),
    "danfe_url" VARCHAR(1000),
    "cancel_reason" VARCHAR(255),
    "cancel_requested_at" TIMESTAMP(3),
    "cancel_deadline_at" TIMESTAMP(3),
    "cancel_reminder_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_protocol" VARCHAR(40),
    "cancel_xml_asset_key" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_sync_at" TIMESTAMP(3),
    "requested_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_document_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "type" "FiscalDocumentEventType" NOT NULL,
    "actor_user_id" UUID,
    "provider_status" VARCHAR(40),
    "code" VARCHAR(40),
    "message" VARCHAR(500),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_document_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_configurations_tenant_id_key" ON "fiscal_configurations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_issuers_tenant_id_key" ON "fiscal_issuers"("tenant_id");

-- CreateIndex
CREATE INDEX "fiscal_provider_connections_provider_status_token_expires_a_idx" ON "fiscal_provider_connections"("provider", "status", "token_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_provider_connections_tenant_id_provider_key" ON "fiscal_provider_connections"("tenant_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "platform_fiscal_provider_configurations_provider_key" ON "platform_fiscal_provider_configurations"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_certificates_active_key_key" ON "fiscal_certificates"("active_key");

-- CreateIndex
CREATE INDEX "fiscal_certificates_tenant_id_status_idx" ON "fiscal_certificates"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "fiscal_certificates_status_valid_to_idx" ON "fiscal_certificates"("status", "valid_to");

-- CreateIndex
CREATE INDEX "fiscal_profiles_tenant_id_active_idx" ON "fiscal_profiles"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_profiles_tenant_id_name_key" ON "fiscal_profiles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documents_active_key_key" ON "fiscal_documents"("active_key");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documents_access_key_key" ON "fiscal_documents"("access_key");

-- CreateIndex
CREATE INDEX "fiscal_documents_tenant_id_status_idx" ON "fiscal_documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "fiscal_documents_tenant_id_order_id_idx" ON "fiscal_documents"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "fiscal_documents_tenant_id_service_tab_id_idx" ON "fiscal_documents"("tenant_id", "service_tab_id");

-- CreateIndex
CREATE INDEX "fiscal_documents_tenant_id_sale_occurred_at_idx" ON "fiscal_documents"("tenant_id", "sale_occurred_at");

-- CreateIndex
CREATE INDEX "fiscal_documents_status_next_sync_at_idx" ON "fiscal_documents"("status", "next_sync_at");

-- CreateIndex
CREATE INDEX "fiscal_document_events_tenant_id_document_id_created_at_idx" ON "fiscal_document_events"("tenant_id", "document_id", "created_at");

-- CreateIndex
CREATE INDEX "categories_fiscal_profile_id_idx" ON "categories"("fiscal_profile_id");

-- CreateIndex
CREATE INDEX "products_fiscal_profile_id_idx" ON "products"("fiscal_profile_id");

-- CreateIndex
CREATE INDEX "sales_integrations_auto_import_enabled_status_idx" ON "sales_integrations"("auto_import_enabled", "status");

-- CreateIndex
CREATE INDEX "product_complements_fiscal_profile_id_idx" ON "product_complements"("fiscal_profile_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_fiscal_profile_id_fkey" FOREIGN KEY ("fiscal_profile_id") REFERENCES "fiscal_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_fiscal_profile_id_fkey" FOREIGN KEY ("fiscal_profile_id") REFERENCES "fiscal_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_complements" ADD CONSTRAINT "product_complements_fiscal_profile_id_fkey" FOREIGN KEY ("fiscal_profile_id") REFERENCES "fiscal_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_configurations" ADD CONSTRAINT "fiscal_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_issuers" ADD CONSTRAINT "fiscal_issuers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_provider_connections" ADD CONSTRAINT "fiscal_provider_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_certificates" ADD CONSTRAINT "fiscal_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_profiles" ADD CONSTRAINT "fiscal_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_service_tab_id_fkey" FOREIGN KEY ("service_tab_id") REFERENCES "service_tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document_events" ADD CONSTRAINT "fiscal_document_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document_events" ADD CONSTRAINT "fiscal_document_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "fiscal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One fiscal sale target per document
ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_target_check" CHECK ((("order_id" IS NOT NULL)::int + ("service_tab_id" IS NOT NULL)::int) = 1);
