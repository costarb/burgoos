-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('LEGACY', 'COUNTER', 'PUBLIC_MENU', 'IFOOD', 'IMPORT', 'API');

-- CreateEnum
CREATE TYPE "ServiceTabStatus" AS ENUM ('OPEN', 'CHECKOUT_PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('CREATED', 'WAITING_CUSTOMER', 'PROCESSING', 'APPROVED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'FAILED', 'UNKNOWN', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentTargetType" AS ENUM ('ORDER', 'SERVICE_TAB');

-- CreateEnum
CREATE TYPE "ItemModificationType" AS ENUM ('REMOVE_INGREDIENT', 'ADD_COMPLEMENT');

-- CreateEnum
CREATE TYPE "PaymentProviderEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentExceptionType" AS ENUM ('UNKNOWN_RESULT', 'POSSIBLE_DUPLICATE', 'MANUAL_DIVERGENCE', 'REFUND_AFTER_DELIVERY', 'TOKEN_ERROR');

-- CreateEnum
CREATE TYPE "PaymentExceptionStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OperationalEventSource" AS ENUM ('USER', 'PROVIDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OperationalEventType" AS ENUM ('ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'ORDER_ASSIGNED', 'ORDER_ASSIGNMENT_TRANSFERRED', 'PRICE_OVERRIDDEN', 'TAB_OPENED', 'TAB_CHECKOUT_STARTED', 'TAB_REOPENED', 'TAB_PAID', 'TAB_CANCELLED', 'CHARGE_CREATED', 'CHARGE_STATUS_CHANGED', 'PAYMENT_MANUALLY_CONFIRMED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED', 'PAYMENT_EXCEPTION_OPENED', 'PAYMENT_EXCEPTION_RESOLVED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'READY';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "base_unit_price" DECIMAL(10,2),
ADD COLUMN     "calculated_unit_price" DECIMAL(10,2),
ADD COLUMN     "charged_unit_price" DECIMAL(10,2),
ADD COLUMN     "manual_adjustment_amount" DECIMAL(10,2),
ADD COLUMN     "manual_adjustment_by_user_id" UUID,
ADD COLUMN     "manual_adjustment_reason" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assigned_user_id" UUID,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "production_started_at" TIMESTAMP(3),
ADD COLUMN     "public_code" TEXT,
ADD COLUMN     "ready_at" TIMESTAMP(3),
ADD COLUMN     "service_tab_id" UUID,
ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "service_tabs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "normalized_number" TEXT NOT NULL,
    "display_name" TEXT,
    "public_code" TEXT NOT NULL,
    "status" "ServiceTabStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_user_id" UUID,
    "opened_by_user_id" UUID NOT NULL,
    "checkout_started_by_user_id" UUID,
    "closed_by_user_id" UUID,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkout_started_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_complements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "ingredient_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "max_quantity" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_complements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_complement_assignments" (
    "product_id" UUID NOT NULL,
    "complement_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_complement_assignments_pkey" PRIMARY KEY ("product_id","complement_id")
);

-- CreateTable
CREATE TABLE "order_item_modifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "type" "ItemModificationType" NOT NULL,
    "ingredient_id" UUID,
    "complement_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_modifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_terminals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider" "PaymentInstitution" NOT NULL,
    "provider_terminal_id" TEXT NOT NULL,
    "provider_store_id" TEXT,
    "provider_pos_id" TEXT,
    "model" TEXT,
    "serial_number_masked" TEXT,
    "operating_mode" TEXT,
    "display_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_charges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_type" "PaymentTargetType" NOT NULL,
    "order_id" UUID,
    "service_tab_id" UUID,
    "institution" "PaymentInstitution" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "mode" "ChargeMode" NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DECIMAL(10,2) NOT NULL,
    "terminal_id" UUID,
    "connection_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "provider_order_id" TEXT,
    "provider_transaction_id" TEXT,
    "provider_status" TEXT,
    "provider_status_detail" TEXT,
    "external_reference" TEXT,
    "cash_received_amount" DECIMAL(10,2),
    "cash_change_amount" DECIMAL(10,2),
    "manual_reference" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "confirmed_by_user_id" UUID,
    "expires_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "institution" "PaymentInstitution" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "fee_amount" DECIMAL(10,2),
    "net_amount" DECIMAL(10,2),
    "refunded_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "provider_payment_id" TEXT,
    "approved_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID,
    "service_tab_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "provider" "PaymentInstitution" NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "provider_resource_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "payload_redacted" JSONB NOT NULL,
    "status" "PaymentProviderEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_exceptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "charge_id" UUID,
    "payment_id" UUID,
    "type" "PaymentExceptionType" NOT NULL,
    "status" "PaymentExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" UUID,

    CONSTRAINT "payment_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_operational_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID,
    "service_tab_id" UUID,
    "charge_id" UUID,
    "type" "OperationalEventType" NOT NULL,
    "actor_user_id" UUID,
    "source" "OperationalEventSource" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_operational_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "response_code" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_tabs_tenant_id_status_opened_at_idx" ON "service_tabs"("tenant_id", "status", "opened_at");

-- CreateIndex
CREATE INDEX "service_tabs_tenant_id_normalized_number_status_idx" ON "service_tabs"("tenant_id", "normalized_number", "status");

-- CreateIndex
CREATE INDEX "service_tabs_tenant_id_assigned_user_id_status_idx" ON "service_tabs"("tenant_id", "assigned_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_tabs_tenant_id_public_code_key" ON "service_tabs"("tenant_id", "public_code");

-- CreateIndex
CREATE INDEX "product_complements_tenant_id_active_sort_order_idx" ON "product_complements"("tenant_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "product_complements_tenant_id_ingredient_id_idx" ON "product_complements"("tenant_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "product_complement_assignments_complement_id_active_idx" ON "product_complement_assignments"("complement_id", "active");

-- CreateIndex
CREATE INDEX "order_item_modifications_tenant_id_order_item_id_idx" ON "order_item_modifications"("tenant_id", "order_item_id");

-- CreateIndex
CREATE INDEX "order_item_modifications_complement_id_idx" ON "order_item_modifications"("complement_id");

-- CreateIndex
CREATE INDEX "payment_terminals_tenant_id_enabled_idx" ON "payment_terminals"("tenant_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "payment_terminals_connection_id_provider_terminal_id_key" ON "payment_terminals"("connection_id", "provider_terminal_id");

-- CreateIndex
CREATE INDEX "payment_charges_tenant_id_status_created_at_idx" ON "payment_charges"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payment_charges_tenant_id_order_id_idx" ON "payment_charges"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "payment_charges_tenant_id_service_tab_id_idx" ON "payment_charges"("tenant_id", "service_tab_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_charges_tenant_id_idempotency_key_key" ON "payment_charges"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_charges_connection_id_provider_order_id_key" ON "payment_charges"("connection_id", "provider_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_charge_id_key" ON "payments"("charge_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_approved_at_idx" ON "payments"("tenant_id", "approved_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenant_id_provider_payment_id_key" ON "payments"("tenant_id", "provider_payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_order_id_idx" ON "payment_allocations"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "payment_allocations_tenant_id_service_tab_id_idx" ON "payment_allocations"("tenant_id", "service_tab_id");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_provider_events_provider_provider_resource_id_idx" ON "payment_provider_events"("provider", "provider_resource_id");

-- CreateIndex
CREATE INDEX "payment_provider_events_status_received_at_idx" ON "payment_provider_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_events_provider_provider_event_id_key" ON "payment_provider_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "payment_exceptions_tenant_id_status_opened_at_idx" ON "payment_exceptions"("tenant_id", "status", "opened_at");

-- CreateIndex
CREATE INDEX "payment_exceptions_charge_id_idx" ON "payment_exceptions"("charge_id");

-- CreateIndex
CREATE INDEX "payment_exceptions_payment_id_idx" ON "payment_exceptions"("payment_id");

-- CreateIndex
CREATE INDEX "order_operational_events_tenant_id_order_id_occurred_at_idx" ON "order_operational_events"("tenant_id", "order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "order_operational_events_tenant_id_service_tab_id_occurred__idx" ON "order_operational_events"("tenant_id", "service_tab_id", "occurred_at");

-- CreateIndex
CREATE INDEX "order_operational_events_tenant_id_charge_id_occurred_at_idx" ON "order_operational_events"("tenant_id", "charge_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idempotency_records_status_expires_at_idx" ON "idempotency_records"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_tenant_id_scope_key_key" ON "idempotency_records"("tenant_id", "scope", "key");

-- Business integrity constraints not expressible in the Prisma schema.
CREATE UNIQUE INDEX "service_tabs_one_active_number_per_tenant"
ON "service_tabs"("tenant_id", "normalized_number")
WHERE "status" IN ('OPEN', 'CHECKOUT_PENDING');

ALTER TABLE "product_complements"
ADD CONSTRAINT "product_complements_price_non_negative" CHECK ("price" >= 0),
ADD CONSTRAINT "product_complements_max_quantity_positive" CHECK ("max_quantity" > 0);

ALTER TABLE "product_complement_assignments"
ADD CONSTRAINT "product_complement_assignment_quantities_valid"
CHECK ("min_quantity" >= 0 AND "max_quantity" >= "min_quantity");

ALTER TABLE "order_item_modifications"
ADD CONSTRAINT "order_item_modifications_quantity_positive" CHECK ("quantity" > 0),
ADD CONSTRAINT "order_item_modifications_target_matches_type" CHECK (
  ("type" = 'REMOVE_INGREDIENT' AND "ingredient_id" IS NOT NULL AND "complement_id" IS NULL)
  OR
  ("type" = 'ADD_COMPLEMENT' AND "ingredient_id" IS NULL AND "complement_id" IS NOT NULL)
);

ALTER TABLE "payment_charges"
ADD CONSTRAINT "payment_charges_amount_positive" CHECK ("amount" > 0),
ADD CONSTRAINT "payment_charges_target_matches_type" CHECK (
  ("target_type" = 'ORDER' AND "order_id" IS NOT NULL AND "service_tab_id" IS NULL)
  OR
  ("target_type" = 'SERVICE_TAB' AND "order_id" IS NULL AND "service_tab_id" IS NOT NULL)
),
ADD CONSTRAINT "payment_charges_cash_values_valid" CHECK (
  "cash_received_amount" IS NULL
  OR ("cash_received_amount" >= "amount" AND "cash_change_amount" = "cash_received_amount" - "amount")
);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_amounts_valid" CHECK (
  "gross_amount" > 0
  AND ("fee_amount" IS NULL OR "fee_amount" >= 0)
  AND ("net_amount" IS NULL OR "net_amount" >= 0)
  AND "refunded_amount" >= 0
  AND "refunded_amount" <= "gross_amount"
);

ALTER TABLE "payment_allocations"
ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0),
ADD CONSTRAINT "payment_allocations_single_target" CHECK (
  ("order_id" IS NOT NULL AND "service_tab_id" IS NULL)
  OR
  ("order_id" IS NULL AND "service_tab_id" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "orders_tenant_id_source_created_at_idx" ON "orders"("tenant_id", "source", "created_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_public_code_idx" ON "orders"("tenant_id", "public_code");

-- CreateIndex
CREATE INDEX "orders_tenant_id_service_tab_id_idx" ON "orders"("tenant_id", "service_tab_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_assigned_user_id_status_idx" ON "orders"("tenant_id", "assigned_user_id", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_tab_id_fkey" FOREIGN KEY ("service_tab_id") REFERENCES "service_tabs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tabs" ADD CONSTRAINT "service_tabs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_complements" ADD CONSTRAINT "product_complements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_complement_assignments" ADD CONSTRAINT "product_complement_assignments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_complement_assignments" ADD CONSTRAINT "product_complement_assignments_complement_id_fkey" FOREIGN KEY ("complement_id") REFERENCES "product_complements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifications" ADD CONSTRAINT "order_item_modifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifications" ADD CONSTRAINT "order_item_modifications_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifications" ADD CONSTRAINT "order_item_modifications_complement_id_fkey" FOREIGN KEY ("complement_id") REFERENCES "product_complements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_terminals" ADD CONSTRAINT "payment_terminals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_service_tab_id_fkey" FOREIGN KEY ("service_tab_id") REFERENCES "service_tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "payment_terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "payment_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_service_tab_id_fkey" FOREIGN KEY ("service_tab_id") REFERENCES "service_tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "payment_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_operational_events" ADD CONSTRAINT "order_operational_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_operational_events" ADD CONSTRAINT "order_operational_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_operational_events" ADD CONSTRAINT "order_operational_events_service_tab_id_fkey" FOREIGN KEY ("service_tab_id") REFERENCES "service_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_operational_events" ADD CONSTRAINT "order_operational_events_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "payment_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
