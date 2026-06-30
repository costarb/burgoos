-- CreateEnum
CREATE TYPE "FinancialRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('MANUAL_INFLOW', 'MANUAL_OUTFLOW', 'TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FinancialAuditAction" AS ENUM ('CREATE', 'UPDATE', 'CANCEL', 'PAY', 'REVERSE', 'ADJUST');

-- DropIndex
DROP INDEX "orders_tenant_payment_release_expected_at_idx";

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "payment_institution" "PaymentInstitution",
    "opening_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opening_balance_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_recurrences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "frequency" "FinancialRecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "starts_on" TIMESTAMP(3) NOT NULL,
    "ends_on" TIMESTAMP(3),
    "occurrence_count" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payable_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "supplier_id" UUID,
    "recurrence_group_id" UUID,
    "description" TEXT NOT NULL,
    "document_reference" TEXT,
    "competence_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3) NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "reversed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "financial_account_id" UUID NOT NULL,
    "destination_account_id" UUID,
    "category_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "reversed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_audits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "FinancialAuditAction" NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_accounts_tenant_id_active_idx" ON "financial_accounts"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_tenant_id_name_key" ON "financial_accounts"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_tenant_id_payment_institution_key" ON "financial_accounts"("tenant_id", "payment_institution");

-- CreateIndex
CREATE INDEX "financial_categories_tenant_id_active_idx" ON "financial_categories"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_tenant_id_name_key" ON "financial_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "payable_recurrences_tenant_id_active_idx" ON "payable_recurrences"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "payables_tenant_id_due_date_idx" ON "payables"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "payables_tenant_id_supplier_id_due_date_idx" ON "payables"("tenant_id", "supplier_id", "due_date");

-- CreateIndex
CREATE INDEX "payables_tenant_id_category_id_due_date_idx" ON "payables"("tenant_id", "category_id", "due_date");

-- CreateIndex
CREATE INDEX "payables_tenant_id_recurrence_group_id_idx" ON "payables"("tenant_id", "recurrence_group_id");

-- CreateIndex
CREATE INDEX "payables_created_by_user_id_idx" ON "payables"("created_by_user_id");

-- CreateIndex
CREATE INDEX "payable_payments_tenant_id_payable_id_paid_at_idx" ON "payable_payments"("tenant_id", "payable_id", "paid_at");

-- CreateIndex
CREATE INDEX "payable_payments_tenant_id_financial_account_id_paid_at_idx" ON "payable_payments"("tenant_id", "financial_account_id", "paid_at");

-- CreateIndex
CREATE INDEX "payable_payments_created_by_user_id_idx" ON "payable_payments"("created_by_user_id");

-- CreateIndex
CREATE INDEX "payable_payments_reversed_by_user_id_idx" ON "payable_payments"("reversed_by_user_id");

-- CreateIndex
CREATE INDEX "cash_movements_tenant_id_financial_account_id_occurred_at_idx" ON "cash_movements"("tenant_id", "financial_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "cash_movements_tenant_id_destination_account_id_occurred_at_idx" ON "cash_movements"("tenant_id", "destination_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "cash_movements_tenant_id_category_id_occurred_at_idx" ON "cash_movements"("tenant_id", "category_id", "occurred_at");

-- CreateIndex
CREATE INDEX "cash_movements_created_by_user_id_idx" ON "cash_movements"("created_by_user_id");

-- CreateIndex
CREATE INDEX "cash_movements_reversed_by_user_id_idx" ON "cash_movements"("reversed_by_user_id");

-- CreateIndex
CREATE INDEX "financial_audits_tenant_id_entity_type_entity_id_created_at_idx" ON "financial_audits"("tenant_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "financial_audits_tenant_id_actor_user_id_created_at_idx" ON "financial_audits"("tenant_id", "actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_recurrences" ADD CONSTRAINT "payable_recurrences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_recurrence_group_id_fkey" FOREIGN KEY ("recurrence_group_id") REFERENCES "payable_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_payments" ADD CONSTRAINT "payable_payments_reversed_by_user_id_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_reversed_by_user_id_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_audits" ADD CONSTRAINT "financial_audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_audits" ADD CONSTRAINT "financial_audits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
