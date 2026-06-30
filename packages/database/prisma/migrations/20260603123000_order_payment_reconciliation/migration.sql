ALTER TABLE "orders"
ADD COLUMN "external_payment_id" TEXT,
ADD COLUMN "payment_gross_amount" DECIMAL(10, 2),
ADD COLUMN "payment_fee_amount" DECIMAL(10, 2),
ADD COLUMN "payment_net_amount" DECIMAL(10, 2),
ADD COLUMN "payment_brand" TEXT;

CREATE INDEX "orders_tenant_id_external_payment_id_idx" ON "orders"("tenant_id", "external_payment_id");
