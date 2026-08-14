import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./env.validation";

describe("validateEnvironment resource controls", () => {
  it("applies conservative defaults", () => {
    expect(validateEnvironment({})).toEqual(
      expect.objectContaining({
        APP_ROLE: "all",
        API_BODY_LIMIT: "2mb",
        ASSET_STORAGE_PROVIDER: "local",
        MEMORY_WARNING_RSS_MB: 400,
        MEMORY_HIGH_RSS_MB: 440,
        MEMORY_PEAK_RSS_MB: 460,
        BACKGROUND_JOB_CONCURRENCY: 1,
        EXPORT_DURABLE_JOBS_ENABLED: "false",
        RETENTION_DURABLE_JOBS_ENABLED: "false",
      })
    );
  });

  it("normalizes every per-handler migration flag and rejects ambiguous values", () => {
    expect(validateEnvironment({
      EXPORT_DURABLE_JOBS_ENABLED: true,
      IFOOD_DURABLE_JOBS_ENABLED: "true",
      PAYMENT_WEBHOOK_DURABLE_JOBS_ENABLED: false,
    })).toEqual(expect.objectContaining({
      EXPORT_DURABLE_JOBS_ENABLED: "true",
      IFOOD_DURABLE_JOBS_ENABLED: "true",
      PAYMENT_WEBHOOK_DURABLE_JOBS_ENABLED: "false",
    }));
    expect(() => validateEnvironment({
      POINT_RECONCILIATION_DURABLE_JOBS_ENABLED: "enabled",
    })).toThrow(/POINT_RECONCILIATION_DURABLE_JOBS_ENABLED must be true or false/);
  });

  it.each(["api", "worker", "all"])("accepts the %s role", (role) => {
    expect(validateEnvironment({ APP_ROLE: role }).APP_ROLE).toBe(role);
  });

  it("rejects unknown roles", () => {
    expect(() => validateEnvironment({ APP_ROLE: "scheduler" })).toThrow(/APP_ROLE/);
  });

  it("rejects unsafe or unordered thresholds", () => {
    expect(() =>
      validateEnvironment({ MEMORY_WARNING_RSS_MB: 450, MEMORY_HIGH_RSS_MB: 440 })
    ).toThrow(/warning < high < peak/);
    expect(() => validateEnvironment({ MEMORY_PEAK_RSS_MB: 512 })).toThrow(/peak < 512/);
  });

  it("requires S3 coordinates only for the S3 provider", () => {
    expect(() => validateEnvironment({ ASSET_STORAGE_PROVIDER: "s3" })).toThrow(/S3_REGION/);
    expect(
      validateEnvironment({
        ASSET_STORAGE_PROVIDER: "s3",
        S3_REGION: "us-east-1",
        S3_BUCKET: "burgoos-assets",
      }).ASSET_STORAGE_PROVIDER
    ).toBe("s3");
  });

  it("allows a local OAuth callback while disabled and rejects partial credentials", () => {
    expect(validateEnvironment({
      MERCADO_PAGO_REDIRECT_URI: "http://localhost:3001/api/integrations/mercadopago/callback",
    }).MERCADO_PAGO_REDIRECT_URI).toContain("localhost:3001");

    expect(() => validateEnvironment({
      MERCADO_PAGO_CLIENT_ID: "client-id",
      MERCADO_PAGO_REDIRECT_URI: "http://localhost:3001/api/integrations/mercadopago/callback",
    })).toThrow(/requires MERCADO_PAGO_CLIENT_ID/);
  });
});
