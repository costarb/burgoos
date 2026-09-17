import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(__dirname, "schema.prisma"), "utf8");
const migration = readFileSync(
  join(__dirname, "migrations/20260904000000_ifood_financial_sales/migration.sql"),
  "utf8"
);

describe("iFood financial persistence schema", () => {
  it("keeps canonical identities tenant and environment scoped", () => {
    expect(schema).toContain("@@unique([tenantId, provider, environment, externalSaleId])");
    expect(schema).toContain("@@unique([tenantId, provider, environment])");
    expect(schema).toContain("deliveryIntegrationId");
    expect(schema).toContain('@unique @map("delivery_integration_id")');
  });

  it.each([
    "ExternalFinancialSale",
    "ExternalSalePayment",
    "ExternalSaleInstallment",
    "ExternalFinancialEvent",
    "ExternalSettlement",
    "ExternalReconciliationFile",
    "FinancialReconciliationRun",
  ])("declares tenant ownership for %s", (model) => {
    const body = schema.split(`model ${model} {`)[1]?.split("\n}")[0] ?? "";
    expect(body).toContain("tenantId");
    expect(body).toContain("Tenant");
  });

  it("backfills the operational environment before replacing uniqueness", () => {
    const backfill = migration.indexOf(
      `UPDATE "delivery_integrations" SET "environment" = 'PRODUCTION'`
    );
    const dropUnique = migration.indexOf(
      `DROP INDEX "delivery_integrations_tenant_id_provider_key"`
    );
    expect(backfill).toBeGreaterThan(-1);
    expect(dropUnique).toBeGreaterThan(backfill);
  });

  it("keeps rollout links and readiness nullable", () => {
    expect(schema).toMatch(/deliveryIntegrationId\s+String\?/);
    expect(schema).toMatch(/financialReadiness\s+IfoodFinancialReadinessStatus\?/);
  });
});
