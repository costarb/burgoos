-- Spec 029 revision: the fiscal identity belongs to the store registration.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "legal_name" VARCHAR(120),
ADD COLUMN     "trade_name" VARCHAR(120),
ADD COLUMN     "cnpj" VARCHAR(14),
ADD COLUMN     "state_registration" VARCHAR(20),
ADD COLUMN     "tax_regime" "FiscalTaxRegime",
ADD COLUMN     "municipality_ibge_code" CHAR(7),
ADD COLUMN     "municipality_ibge_source" VARCHAR(10);

-- Keep data entered while the fiscal identity lived in its own table
UPDATE "tenants" AS t
SET "legal_name" = fi."legal_name",
    "trade_name" = fi."trade_name",
    "cnpj" = fi."cnpj",
    "state_registration" = fi."state_registration",
    "tax_regime" = fi."tax_regime",
    "municipality_ibge_code" = fi."municipality_ibge_code",
    "municipality_ibge_source" = fi."municipality_ibge_source"
FROM "fiscal_issuers" AS fi
WHERE fi."tenant_id" = t."id";

-- DropTable
DROP TABLE "fiscal_issuers";
