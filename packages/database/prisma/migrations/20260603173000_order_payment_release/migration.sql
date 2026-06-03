CREATE TYPE "PaymentReleaseSource" AS ENUM ('EXTRACT', 'D_PLUS_30_FALLBACK', 'IMMEDIATE');

ALTER TABLE "orders"
ADD COLUMN "payment_release_expected_at" TIMESTAMP(3),
ADD COLUMN "payment_release_source" "PaymentReleaseSource";

CREATE INDEX "orders_tenant_payment_release_expected_at_idx"
ON "orders"("tenant_id", "payment_release_expected_at");
