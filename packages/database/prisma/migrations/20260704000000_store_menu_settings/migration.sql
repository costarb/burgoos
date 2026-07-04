CREATE TYPE "StoreOpenMode" AS ENUM ('SCHEDULE', 'FORCE_OPEN', 'FORCE_CLOSED');

ALTER TABLE "tenants"
  ADD COLUMN "open_mode" "StoreOpenMode" NOT NULL DEFAULT 'FORCE_CLOSED',
  ADD COLUMN "operating_hours" JSONB NOT NULL DEFAULT '{}';

UPDATE "tenants"
SET "open_mode" = CASE
  WHEN "is_open" = TRUE THEN 'FORCE_OPEN'::"StoreOpenMode"
  ELSE 'FORCE_CLOSED'::"StoreOpenMode"
END;

ALTER TABLE "store_visual_configurations"
  ADD COLUMN "show_product_images" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "show_product_descriptions" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "ordering_enabled" BOOLEAN NOT NULL DEFAULT TRUE;
