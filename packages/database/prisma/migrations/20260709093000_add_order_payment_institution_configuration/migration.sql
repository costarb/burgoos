ALTER TABLE "orders"
    ADD COLUMN "payment_institution_id" UUID;

UPDATE "orders" order_record
SET "payment_institution_id" = institution."id"
FROM "payment_institution_configurations" institution
WHERE institution."tenant_id" = order_record."tenant_id"
  AND institution."payment_institution" = order_record."payment_institution"
  AND order_record."payment_institution" IS NOT NULL;

CREATE INDEX "orders_tenant_id_payment_institution_id_idx"
    ON "orders"("tenant_id", "payment_institution_id");

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_payment_institution_id_fkey"
    FOREIGN KEY ("payment_institution_id") REFERENCES "payment_institution_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
