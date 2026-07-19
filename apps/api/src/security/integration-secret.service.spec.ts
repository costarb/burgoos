import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { IntegrationSecretService } from "./integration-secret.service";

describe("IntegrationSecretService", () => {
  const service = new IntegrationSecretService(
    new ConfigService({ INTEGRATION_SECRET_KEY: Buffer.alloc(32, 7).toString("base64") })
  );

  it("encrypts, decrypts and fingerprints without exposing the secret", () => {
    const encrypted = service.encrypt("edi-token");
    expect(encrypted).not.toContain("edi-token");
    expect(service.decrypt(encrypted)).toBe("edi-token");
    expect(service.fingerprint("edi-token")).toHaveLength(16);
  });

  it("redacts nested secret fields", () => {
    expect(service.redact({ token: "x", nested: { authorization: "y", ok: 1 } })).toEqual({
      token: "********",
      nested: { authorization: "********", ok: 1 },
    });
  });
});
