ALTER TYPE "SalesProvider" ADD VALUE IF NOT EXISTS 'MERCADO_PAGO';
ALTER TYPE "SalesIntegrationStatus" ADD VALUE IF NOT EXISTS 'PENDING_AUTHORIZATION';
ALTER TYPE "SalesIntegrationStatus" ADD VALUE IF NOT EXISTS 'TOKEN_EXPIRING';
ALTER TYPE "SalesIntegrationStatus" ADD VALUE IF NOT EXISTS 'REFRESHING';
ALTER TYPE "SalesIntegrationStatus" ADD VALUE IF NOT EXISTS 'REAUTHORIZATION_REQUIRED';
ALTER TYPE "SalesIntegrationStatus" ADD VALUE IF NOT EXISTS 'ERROR';

CREATE TYPE "SalesIntegrationEnvironment" AS ENUM ('TEST', 'PRODUCTION');
CREATE TYPE "SalesCredentialMode" AS ENUM ('PROVIDER_TOKEN', 'OAUTH', 'FIXED_TOKEN');
CREATE TYPE "SalesRunTrigger" AS ENUM ('MANUAL', 'INITIAL_LOAD', 'WEBHOOK', 'RECONCILIATION_SHORT', 'RECONCILIATION_DAILY');
CREATE TYPE "OAuthAuthorizationAttemptStatus" AS ENUM ('PENDING', 'CONSUMING', 'COMPLETED', 'EXPIRED', 'FAILED');
CREATE TYPE "ProviderResourceType" AS ENUM ('PAYMENT', 'ORDER', 'CLAIM', 'CHARGEBACK');
CREATE TYPE "ProviderNotificationSignatureStatus" AS ENUM ('VALID', 'INVALID');
CREATE TYPE "ProviderNotificationStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

DROP INDEX "sales_integrations_tenant_id_provider_channel_key";
ALTER TABLE "sales_integrations"
  ADD COLUMN "environment" "SalesIntegrationEnvironment" NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN "credential_mode" "SalesCredentialMode" NOT NULL DEFAULT 'PROVIDER_TOKEN',
  ADD COLUMN "provider_user_id" TEXT,
  ADD COLUMN "token_expires_at" TIMESTAMP(3),
  ADD COLUMN "scopes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "connected_at" TIMESTAMP(3),
  ADD COLUMN "last_sync_at" TIMESTAMP(3),
  ADD COLUMN "disconnected_at" TIMESTAMP(3),
  ADD COLUMN "operation_lock_owner" TEXT,
  ADD COLUMN "operation_lock_until" TIMESTAMP(3);

CREATE UNIQUE INDEX "sales_integrations_tenant_id_provider_channel_environment_key"
  ON "sales_integrations"("tenant_id", "provider", "channel", "environment");
CREATE UNIQUE INDEX "sales_integrations_provider_provider_user_id_environment_key"
  ON "sales_integrations"("provider", "provider_user_id", "environment");
CREATE INDEX "sales_integrations_provider_credential_mode_token_expires_at_idx"
  ON "sales_integrations"("provider", "credential_mode", "token_expires_at");

ALTER TABLE "sales_integration_credentials"
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "scopes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "validated_provider_user_id" TEXT,
  ADD COLUMN "validation_status" TEXT;

ALTER TABLE "sales_import_runs"
  ALTER COLUMN "requested_by_user_id" DROP NOT NULL,
  ADD COLUMN "trigger" "SalesRunTrigger" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "sales_import_runs" DROP CONSTRAINT "sales_import_runs_requested_by_user_id_fkey";
ALTER TABLE "sales_import_runs" ADD CONSTRAINT "sales_import_runs_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "external_sale_identities"
  ADD COLUMN "integration_id" UUID,
  ADD COLUMN "environment" "SalesIntegrationEnvironment" NOT NULL DEFAULT 'PRODUCTION';

UPDATE "external_sale_identities" identity
SET "integration_id" = source."integration_id"
FROM (
  SELECT DISTINCT ON ("tenant_id", "provider", "external_sale_id")
    "tenant_id", "provider", "external_sale_id", "integration_id"
  FROM "external_sales_movements"
  WHERE "external_sale_id" IS NOT NULL
  ORDER BY "tenant_id", "provider", "external_sale_id", "created_at" ASC
) source
WHERE identity."tenant_id" = source."tenant_id"
  AND identity."provider" = source."provider"
  AND identity."external_sale_id" = source."external_sale_id";

DROP INDEX "external_sale_identities_tenant_id_provider_external_sale_id_key";
CREATE UNIQUE INDEX "external_sale_identities_tenant_id_provider_environment_external_sale_id_key"
  ON "external_sale_identities"("tenant_id", "provider", "environment", "external_sale_id");
CREATE INDEX "external_sale_identities_integration_id_idx" ON "external_sale_identities"("integration_id");
ALTER TABLE "external_sale_identities" ADD CONSTRAINT "external_sale_identities_integration_id_fkey"
  FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "oauth_authorization_attempts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "environment" "SalesIntegrationEnvironment" NOT NULL,
  "initial_load_days" INTEGER NOT NULL DEFAULT 30,
  "state_hash" TEXT NOT NULL,
  "code_verifier_ciphertext" TEXT,
  "status" "OAuthAuthorizationAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "oauth_authorization_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "oauth_authorization_attempts_initial_load_days_check" CHECK ("initial_load_days" IN (30, 60, 90))
);
CREATE UNIQUE INDEX "oauth_authorization_attempts_state_hash_key" ON "oauth_authorization_attempts"("state_hash");
CREATE INDEX "oauth_authorization_attempts_tenant_id_integration_id_status_idx" ON "oauth_authorization_attempts"("tenant_id", "integration_id", "status");
CREATE INDEX "oauth_authorization_attempts_status_expires_at_idx" ON "oauth_authorization_attempts"("status", "expires_at");

CREATE TABLE "provider_transaction_states" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "provider" "SalesProvider" NOT NULL,
  "resource_type" "ProviderResourceType" NOT NULL,
  "provider_resource_id" TEXT NOT NULL,
  "external_sale_id" TEXT,
  "status" TEXT NOT NULL,
  "status_detail" TEXT,
  "gross_amount" DECIMAL(12,2),
  "fee_amount" DECIMAL(12,2),
  "net_amount" DECIMAL(12,2),
  "created_at_provider" TIMESTAMP(3),
  "approved_at_provider" TIMESTAMP(3),
  "updated_at_provider" TIMESTAMP(3),
  "normalized_data" JSONB NOT NULL DEFAULT '{}',
  "raw_payload" JSONB NOT NULL,
  "last_synchronized_at" TIMESTAMP(3) NOT NULL,
  "order_id" UUID,
  "attention_required" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_transaction_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_transaction_states_integration_id_resource_type_provider_resource_id_key"
  ON "provider_transaction_states"("integration_id", "resource_type", "provider_resource_id");
CREATE INDEX "provider_transaction_states_tenant_id_provider_updated_at_provider_idx"
  ON "provider_transaction_states"("tenant_id", "provider", "updated_at_provider");
CREATE INDEX "provider_transaction_states_tenant_id_attention_required_idx"
  ON "provider_transaction_states"("tenant_id", "attention_required");
CREATE INDEX "provider_transaction_states_order_id_idx" ON "provider_transaction_states"("order_id");

ALTER TABLE "external_sales_movements" ADD COLUMN "provider_transaction_state_id" UUID;
CREATE INDEX "external_sales_movements_provider_transaction_state_id_idx" ON "external_sales_movements"("provider_transaction_state_id");
ALTER TABLE "external_sales_movements" ADD CONSTRAINT "external_sales_movements_provider_transaction_state_id_fkey"
  FOREIGN KEY ("provider_transaction_state_id") REFERENCES "provider_transaction_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "provider_notifications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "integration_id" UUID,
  "provider" "SalesProvider" NOT NULL,
  "environment" "SalesIntegrationEnvironment" NOT NULL,
  "event_key" TEXT NOT NULL,
  "provider_event_id" TEXT,
  "provider_user_id" TEXT,
  "resource_type" "ProviderResourceType" NOT NULL,
  "provider_resource_id" TEXT NOT NULL,
  "action" TEXT,
  "signature_status" "ProviderNotificationSignatureStatus" NOT NULL,
  "status" "ProviderNotificationStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3),
  "payload" JSONB NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "provider_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_notifications_provider_environment_event_key_key" ON "provider_notifications"("provider", "environment", "event_key");
CREATE INDEX "provider_notifications_status_next_attempt_at_idx" ON "provider_notifications"("status", "next_attempt_at");
CREATE INDEX "provider_notifications_provider_provider_user_id_environment_idx" ON "provider_notifications"("provider", "provider_user_id", "environment");
CREATE INDEX "provider_notifications_tenant_id_received_at_idx" ON "provider_notifications"("tenant_id", "received_at");

CREATE TABLE "integration_audit_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "integration_audit_events_tenant_id_integration_id_created_at_idx" ON "integration_audit_events"("tenant_id", "integration_id", "created_at");
CREATE INDEX "integration_audit_events_actor_user_id_idx" ON "integration_audit_events"("actor_user_id");

ALTER TABLE "oauth_authorization_attempts" ADD CONSTRAINT "oauth_authorization_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_authorization_attempts" ADD CONSTRAINT "oauth_authorization_attempts_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_authorization_attempts" ADD CONSTRAINT "oauth_authorization_attempts_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_transaction_states" ADD CONSTRAINT "provider_transaction_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_transaction_states" ADD CONSTRAINT "provider_transaction_states_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_transaction_states" ADD CONSTRAINT "provider_transaction_states_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_notifications" ADD CONSTRAINT "provider_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_notifications" ADD CONSTRAINT "provider_notifications_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_audit_events" ADD CONSTRAINT "integration_audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_audit_events" ADD CONSTRAINT "integration_audit_events_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "sales_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_audit_events" ADD CONSTRAINT "integration_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
