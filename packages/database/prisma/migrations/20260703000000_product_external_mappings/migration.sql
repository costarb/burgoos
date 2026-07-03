CREATE TABLE "product_external_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "provider" "DeliveryProvider" NOT NULL,
    "external_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_external_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_external_mappings_tenant_id_provider_external_product_id_key"
ON "product_external_mappings"("tenant_id", "provider", "external_product_id");

CREATE UNIQUE INDEX "product_external_mappings_product_id_provider_key"
ON "product_external_mappings"("product_id", "provider");

CREATE INDEX "product_external_mappings_tenant_id_product_id_idx"
ON "product_external_mappings"("tenant_id", "product_id");

ALTER TABLE "product_external_mappings"
ADD CONSTRAINT "product_external_mappings_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_external_mappings"
ADD CONSTRAINT "product_external_mappings_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
