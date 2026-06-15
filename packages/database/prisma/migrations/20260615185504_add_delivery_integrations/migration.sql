-- CreateEnum
CREATE TYPE "DeliveryProvider" AS ENUM ('IFOOD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeliveryIntegrationStatus" AS ENUM ('DRAFT', 'VALIDATING', 'ACTIVE', 'PAUSED', 'REQUIRES_ATTENTION', 'DISABLED');

-- CreateEnum
CREATE TYPE "DeliveryCredentialStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ROTATED', 'REQUIRES_REAUTHORIZATION');

-- CreateEnum
CREATE TYPE "DeliveryPlatformEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED', 'ACK_PENDING', 'ACKED');

-- CreateEnum
CREATE TYPE "DeliverySyncAttemptStatus" AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'FAILED', 'RETRYABLE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryPlatformOrderAction" AS ENUM ('CONFIRM', 'REFUSE', 'START_PREPARATION', 'READY_TO_PICKUP', 'DISPATCH', 'DELIVER', 'REQUEST_CANCELLATION', 'RESPOND_DISPUTE');

-- CreateEnum
CREATE TYPE "DeliveryPlatformOrderMode" AS ENUM ('DELIVERY', 'MERCHANT_DELIVERY', 'TAKEOUT', 'DINE_IN');

-- CreateEnum
CREATE TYPE "DeliveryPlatformOrderTiming" AS ENUM ('IMMEDIATE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DeliveryIntegrationAuditAction" AS ENUM ('CONFIG_CREATED', 'CONFIG_UPDATED', 'CONFIG_ACTIVATED', 'CONFIG_PAUSED', 'CONFIG_DISABLED', 'CREDENTIAL_ROTATED', 'VALIDATION_RUN', 'EVENT_RECEIVED', 'EVENT_PROCESSED', 'EVENT_ACKED', 'ORDER_CREATED', 'ORDER_UPDATED', 'SYNC_ATTEMPTED', 'SYNC_FAILED', 'DEADLINE_ALERTED', 'DISPUTE_RECEIVED');

-- CreateTable
CREATE TABLE "delivery_integrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "DeliveryProvider" NOT NULL,
    "order_platform_id" UUID NOT NULL,
    "status" "DeliveryIntegrationStatus" NOT NULL DEFAULT 'DRAFT',
    "display_name" TEXT NOT NULL,
    "external_merchant_id" TEXT,
    "polling_enabled" BOOLEAN NOT NULL DEFAULT true,
    "webhook_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_validation_at" TIMESTAMP(3),
    "last_successful_polling_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "homologation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_integration_credentials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "status" "DeliveryCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "credential_type" TEXT NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3),
    "refresh_expires_at" TIMESTAMP(3),
    "scopes" JSONB,
    "metadata" JSONB,
    "created_by_user_id" UUID,
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_platform_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "provider" "DeliveryProvider" NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "external_order_id" TEXT,
    "event_code" TEXT NOT NULL,
    "full_event_code" TEXT,
    "status" "DeliveryPlatformEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider_created_at" TIMESTAMP(3),
    "processing_started_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "normalized_summary" JSONB,
    "error_message" TEXT,

    CONSTRAINT "delivery_platform_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_order_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_platform_id" UUID NOT NULL,
    "provider" "DeliveryProvider" NOT NULL,
    "external_merchant_id" TEXT NOT NULL,
    "external_order_id" TEXT NOT NULL,
    "mode" "DeliveryPlatformOrderMode" NOT NULL,
    "timing" "DeliveryPlatformOrderTiming" NOT NULL,
    "external_status" TEXT NOT NULL,
    "internal_status_at_last_sync" TEXT,
    "confirmation_deadline_at" TIMESTAMP(3),
    "preparation_start_at" TIMESTAMP(3),
    "delivery_tracking_available" BOOLEAN NOT NULL DEFAULT false,
    "raw_order_snapshot" JSONB NOT NULL,
    "last_provider_update_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_order_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_sync_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "platform_order_link_id" UUID,
    "action" "DeliveryPlatformOrderAction" NOT NULL,
    "status" "DeliverySyncAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "request_payload" JSONB,
    "response_payload" JSONB,
    "provider_status_code" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "next_retry_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_sync_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_cancellation_reasons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "provider_reason_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "applicable_actions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_cancellation_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_disputes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "platform_order_link_id" UUID NOT NULL,
    "external_dispute_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "proposal" JSONB NOT NULL,
    "response" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_integration_audits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID,
    "actor_user_id" UUID,
    "action" "DeliveryIntegrationAuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "result" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_integration_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_integrations_tenant_id_status_idx" ON "delivery_integrations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "delivery_integrations_tenant_id_order_platform_id_idx" ON "delivery_integrations"("tenant_id", "order_platform_id");

-- CreateIndex
CREATE INDEX "delivery_integrations_created_by_user_id_idx" ON "delivery_integrations"("created_by_user_id");

-- CreateIndex
CREATE INDEX "delivery_integrations_updated_by_user_id_idx" ON "delivery_integrations"("updated_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_integrations_tenant_id_provider_key" ON "delivery_integrations"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "delivery_integration_credentials_tenant_id_integration_id_s_idx" ON "delivery_integration_credentials"("tenant_id", "integration_id", "status");

-- CreateIndex
CREATE INDEX "delivery_integration_credentials_created_by_user_id_idx" ON "delivery_integration_credentials"("created_by_user_id");

-- CreateIndex
CREATE INDEX "delivery_platform_events_tenant_id_integration_id_status_idx" ON "delivery_platform_events"("tenant_id", "integration_id", "status");

-- CreateIndex
CREATE INDEX "delivery_platform_events_tenant_id_external_order_id_idx" ON "delivery_platform_events"("tenant_id", "external_order_id");

-- CreateIndex
CREATE INDEX "delivery_platform_events_next_retry_at_idx" ON "delivery_platform_events"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_platform_events_provider_external_event_id_key" ON "delivery_platform_events"("provider", "external_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_order_links_order_id_key" ON "platform_order_links"("order_id");

-- CreateIndex
CREATE INDEX "platform_order_links_tenant_id_integration_id_idx" ON "platform_order_links"("tenant_id", "integration_id");

-- CreateIndex
CREATE INDEX "platform_order_links_tenant_id_order_platform_id_idx" ON "platform_order_links"("tenant_id", "order_platform_id");

-- CreateIndex
CREATE INDEX "platform_order_links_tenant_id_confirmation_deadline_at_idx" ON "platform_order_links"("tenant_id", "confirmation_deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_order_links_provider_external_merchant_id_external_key" ON "platform_order_links"("provider", "external_merchant_id", "external_order_id");

-- CreateIndex
CREATE INDEX "platform_sync_attempts_tenant_id_integration_id_status_idx" ON "platform_sync_attempts"("tenant_id", "integration_id", "status");

-- CreateIndex
CREATE INDEX "platform_sync_attempts_tenant_id_platform_order_link_id_idx" ON "platform_sync_attempts"("tenant_id", "platform_order_link_id");

-- CreateIndex
CREATE INDEX "platform_sync_attempts_next_retry_at_idx" ON "platform_sync_attempts"("next_retry_at");

-- CreateIndex
CREATE INDEX "platform_sync_attempts_created_by_user_id_idx" ON "platform_sync_attempts"("created_by_user_id");

-- CreateIndex
CREATE INDEX "platform_cancellation_reasons_tenant_id_integration_id_acti_idx" ON "platform_cancellation_reasons"("tenant_id", "integration_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "platform_cancellation_reasons_integration_id_provider_reaso_key" ON "platform_cancellation_reasons"("integration_id", "provider_reason_id");

-- CreateIndex
CREATE INDEX "platform_disputes_tenant_id_status_expires_at_idx" ON "platform_disputes"("tenant_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "platform_disputes_platform_order_link_id_idx" ON "platform_disputes"("platform_order_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_disputes_integration_id_external_dispute_id_key" ON "platform_disputes"("integration_id", "external_dispute_id");

-- CreateIndex
CREATE INDEX "delivery_integration_audits_tenant_id_integration_id_create_idx" ON "delivery_integration_audits"("tenant_id", "integration_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_integration_audits_tenant_id_action_created_at_idx" ON "delivery_integration_audits"("tenant_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "delivery_integration_audits_actor_user_id_idx" ON "delivery_integration_audits"("actor_user_id");

-- AddForeignKey
ALTER TABLE "delivery_integrations" ADD CONSTRAINT "delivery_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integrations" ADD CONSTRAINT "delivery_integrations_order_platform_id_fkey" FOREIGN KEY ("order_platform_id") REFERENCES "order_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integrations" ADD CONSTRAINT "delivery_integrations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integrations" ADD CONSTRAINT "delivery_integrations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integration_credentials" ADD CONSTRAINT "delivery_integration_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integration_credentials" ADD CONSTRAINT "delivery_integration_credentials_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integration_credentials" ADD CONSTRAINT "delivery_integration_credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_platform_events" ADD CONSTRAINT "delivery_platform_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_platform_events" ADD CONSTRAINT "delivery_platform_events_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_order_links" ADD CONSTRAINT "platform_order_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_order_links" ADD CONSTRAINT "platform_order_links_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_order_links" ADD CONSTRAINT "platform_order_links_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_order_links" ADD CONSTRAINT "platform_order_links_order_platform_id_fkey" FOREIGN KEY ("order_platform_id") REFERENCES "order_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sync_attempts" ADD CONSTRAINT "platform_sync_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sync_attempts" ADD CONSTRAINT "platform_sync_attempts_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sync_attempts" ADD CONSTRAINT "platform_sync_attempts_platform_order_link_id_fkey" FOREIGN KEY ("platform_order_link_id") REFERENCES "platform_order_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sync_attempts" ADD CONSTRAINT "platform_sync_attempts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_cancellation_reasons" ADD CONSTRAINT "platform_cancellation_reasons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_cancellation_reasons" ADD CONSTRAINT "platform_cancellation_reasons_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_disputes" ADD CONSTRAINT "platform_disputes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_disputes" ADD CONSTRAINT "platform_disputes_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_disputes" ADD CONSTRAINT "platform_disputes_platform_order_link_id_fkey" FOREIGN KEY ("platform_order_link_id") REFERENCES "platform_order_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integration_audits" ADD CONSTRAINT "delivery_integration_audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integration_audits" ADD CONSTRAINT "delivery_integration_audits_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "delivery_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_integration_audits" ADD CONSTRAINT "delivery_integration_audits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
