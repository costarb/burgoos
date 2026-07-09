CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "payment_institution_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "payment_institution" "PaymentInstitution",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_institution_configurations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "financial_accounts"
    ADD COLUMN "payment_institution_id" UUID;

INSERT INTO "payment_institution_configurations" (
    "tenant_id",
    "name",
    "code",
    "payment_institution"
)
SELECT DISTINCT
    "tenant_id",
    CASE "payment_institution"
        WHEN 'PAGBANK' THEN 'PagBank'
        WHEN 'MERCADO_PAGO' THEN 'Mercado Pago'
        WHEN 'DINHEIRO' THEN 'Dinheiro'
        WHEN 'CAIXA_LOCAL' THEN 'Caixa Local'
        ELSE "payment_institution"::TEXT
    END,
    "payment_institution"::TEXT,
    "payment_institution"
FROM "financial_accounts"
WHERE "payment_institution" IS NOT NULL;

UPDATE "financial_accounts" account
SET "payment_institution_id" = institution."id"
FROM "payment_institution_configurations" institution
WHERE institution."tenant_id" = account."tenant_id"
  AND institution."payment_institution" = account."payment_institution";

CREATE UNIQUE INDEX "payment_institution_configurations_tenant_id_name_key"
    ON "payment_institution_configurations"("tenant_id", "name");

CREATE UNIQUE INDEX "payment_institution_configurations_tenant_id_code_key"
    ON "payment_institution_configurations"("tenant_id", "code");

CREATE UNIQUE INDEX "payment_institution_configurations_tenant_id_payment_institution_key"
    ON "payment_institution_configurations"("tenant_id", "payment_institution");

CREATE INDEX "payment_institution_configurations_tenant_id_active_idx"
    ON "payment_institution_configurations"("tenant_id", "active");

CREATE INDEX "financial_accounts_tenant_id_payment_institution_id_idx"
    ON "financial_accounts"("tenant_id", "payment_institution_id");

ALTER TABLE "payment_institution_configurations"
    ADD CONSTRAINT "payment_institution_configurations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_accounts"
    ADD CONSTRAINT "financial_accounts_payment_institution_id_fkey"
    FOREIGN KEY ("payment_institution_id") REFERENCES "payment_institution_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
