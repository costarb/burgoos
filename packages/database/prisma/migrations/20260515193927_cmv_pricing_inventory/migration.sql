-- CreateEnum
CREATE TYPE "PurchaseUnitKind" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "ProductCostStatus" AS ENUM ('OK', 'REVIEW_PRICE', 'MISSING_TECHNICAL_SHEET');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INITIAL', 'MANUAL_ENTRY', 'MANUAL_ADJUSTMENT', 'RESERVATION', 'CONSUMPTION', 'RELEASE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "order_platform_id" UUID;

-- CreateTable
CREATE TABLE "financial_configurations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "card_fee_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "operational_loss_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "desired_margin_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.3,
    "average_packaging_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthly_fixed_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthly_revenue_goal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cmv_warning_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.35,
    "net_margin_goal_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "kind" "PurchaseUnitKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_platforms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fee_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "payment_fee_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_unit_id" UUID NOT NULL,
    "supplier_id" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purchase_quantity" DECIMAL(12,3) NOT NULL,
    "purchase_cost" DECIMAL(10,2) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL,
    "current_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minimum_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_sheets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_sheet_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "technical_sheet_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity_used" DECIMAL(12,3) NOT NULL,
    "unit_cost_snapshot" DECIMAL(12,4) NOT NULL,
    "item_cost" DECIMAL(10,2) NOT NULL,
    "is_packaging" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_sheet_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_cost_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_platform_id" UUID,
    "ingredient_cmv" DECIMAL(10,2) NOT NULL,
    "packaging_cost" DECIMAL(10,2) NOT NULL,
    "operational_loss_cost" DECIMAL(10,2) NOT NULL,
    "total_cmv" DECIMAL(10,2) NOT NULL,
    "current_price" DECIMAL(10,2) NOT NULL,
    "cmv_rate" DECIMAL(7,4) NOT NULL,
    "desired_margin_rate" DECIMAL(5,4) NOT NULL,
    "fee_rate" DECIMAL(5,4) NOT NULL,
    "ideal_price" DECIMAL(10,2) NOT NULL,
    "estimated_profit" DECIMAL(10,2) NOT NULL,
    "estimated_margin_rate" DECIMAL(7,4) NOT NULL,
    "status" "ProductCostStatus" NOT NULL DEFAULT 'MISSING_TECHNICAL_SHEET',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "order_id" UUID,
    "order_item_id" UUID,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_profitability_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID,
    "order_platform_id" UUID,
    "gross_revenue" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_revenue" DECIMAL(10,2) NOT NULL,
    "cmv" DECIMAL(10,2) NOT NULL,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "payment_fee" DECIMAL(10,2) NOT NULL,
    "gross_profit" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_profitability_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_configurations_tenant_id_key" ON "financial_configurations"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_units_tenant_id_idx" ON "purchase_units"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_units_tenant_id_name_key" ON "purchase_units"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_units_tenant_id_abbreviation_key" ON "purchase_units"("tenant_id", "abbreviation");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "order_platforms_tenant_id_idx" ON "order_platforms"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_platforms_tenant_id_name_key" ON "order_platforms"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "ingredients_tenant_id_idx" ON "ingredients"("tenant_id");

-- CreateIndex
CREATE INDEX "ingredients_purchase_unit_id_idx" ON "ingredients"("purchase_unit_id");

-- CreateIndex
CREATE INDEX "ingredients_supplier_id_idx" ON "ingredients"("supplier_id");

-- CreateIndex
CREATE INDEX "technical_sheets_tenant_id_idx" ON "technical_sheets"("tenant_id");

-- CreateIndex
CREATE INDEX "technical_sheets_product_id_idx" ON "technical_sheets"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "technical_sheets_tenant_id_product_id_active_key" ON "technical_sheets"("tenant_id", "product_id", "active");

-- CreateIndex
CREATE INDEX "technical_sheet_lines_tenant_id_idx" ON "technical_sheet_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "technical_sheet_lines_technical_sheet_id_idx" ON "technical_sheet_lines"("technical_sheet_id");

-- CreateIndex
CREATE INDEX "technical_sheet_lines_ingredient_id_idx" ON "technical_sheet_lines"("ingredient_id");

-- CreateIndex
CREATE INDEX "product_cost_snapshots_tenant_id_idx" ON "product_cost_snapshots"("tenant_id");

-- CreateIndex
CREATE INDEX "product_cost_snapshots_product_id_idx" ON "product_cost_snapshots"("product_id");

-- CreateIndex
CREATE INDEX "product_cost_snapshots_order_platform_id_idx" ON "product_cost_snapshots"("order_platform_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_idx" ON "stock_movements"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_movements_ingredient_id_idx" ON "stock_movements"("ingredient_id");

-- CreateIndex
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");

-- CreateIndex
CREATE INDEX "order_profitability_snapshots_tenant_id_idx" ON "order_profitability_snapshots"("tenant_id");

-- CreateIndex
CREATE INDEX "order_profitability_snapshots_order_id_idx" ON "order_profitability_snapshots"("order_id");

-- CreateIndex
CREATE INDEX "order_profitability_snapshots_order_platform_id_idx" ON "order_profitability_snapshots"("order_platform_id");

-- CreateIndex
CREATE INDEX "orders_order_platform_id_idx" ON "orders"("order_platform_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_platform_id_fkey" FOREIGN KEY ("order_platform_id") REFERENCES "order_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_configurations" ADD CONSTRAINT "financial_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_units" ADD CONSTRAINT "purchase_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_platforms" ADD CONSTRAINT "order_platforms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "purchase_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sheets" ADD CONSTRAINT "technical_sheets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sheets" ADD CONSTRAINT "technical_sheets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sheet_lines" ADD CONSTRAINT "technical_sheet_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sheet_lines" ADD CONSTRAINT "technical_sheet_lines_technical_sheet_id_fkey" FOREIGN KEY ("technical_sheet_id") REFERENCES "technical_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_sheet_lines" ADD CONSTRAINT "technical_sheet_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cost_snapshots" ADD CONSTRAINT "product_cost_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cost_snapshots" ADD CONSTRAINT "product_cost_snapshots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_cost_snapshots" ADD CONSTRAINT "product_cost_snapshots_order_platform_id_fkey" FOREIGN KEY ("order_platform_id") REFERENCES "order_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_profitability_snapshots" ADD CONSTRAINT "order_profitability_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_profitability_snapshots" ADD CONSTRAINT "order_profitability_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_profitability_snapshots" ADD CONSTRAINT "order_profitability_snapshots_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_profitability_snapshots" ADD CONSTRAINT "order_profitability_snapshots_order_platform_id_fkey" FOREIGN KEY ("order_platform_id") REFERENCES "order_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
