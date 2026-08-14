import { describe, expect, it } from "vitest";
import { validateEnvironment } from "../src/config/env.validation";
import { redactResourceValue } from "../src/common/observability/resource-redaction";
import { assertSafeAssetKey } from "../src/common/storage/asset-storage";

describe("resource control security and rollback", () => {
  it("rejects unsafe asset paths and keeps tenant identity in valid keys", () => {
    expect(() => assertSafeAssetKey("tenants/tenant-1/../tenant-2/image.png")).toThrow();
    expect(() => assertSafeAssetKey("tenants/tenant-1/images/product/image.png")).not.toThrow();
  });

  it("redacts sensitive fields while retaining safe job correlation", () => {
    expect(redactResourceValue({ jobId: "job-1", token: "secret", rawPayload: { card: "4111111111111111" } }))
      .toEqual({ jobId: "job-1", token: "[REDACTED]", rawPayload: "[REDACTED]" });
  });

  it("requires every durable/legacy selector to be an explicit boolean", () => {
    expect(() => validateEnvironment({ DATABASE_URL: "postgresql://localhost/test", IFOOD_DURABLE_JOBS_ENABLED: "both" }))
      .toThrow(/IFOOD_DURABLE_JOBS_ENABLED/);
    expect(validateEnvironment({ DATABASE_URL: "postgresql://localhost/test", IFOOD_DURABLE_JOBS_ENABLED: "false" }))
      .toEqual(expect.objectContaining({ IFOOD_DURABLE_JOBS_ENABLED: "false" }));
  });
});
