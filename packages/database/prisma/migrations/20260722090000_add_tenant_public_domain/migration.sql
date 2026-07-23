ALTER TABLE "tenants" ADD COLUMN "public_domain" TEXT;

CREATE UNIQUE INDEX "tenants_public_domain_key" ON "tenants"("public_domain");
