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

  it("round-trips typed credential envelopes", () => {
    const envelopes = [
      { version: 1, kind: "PAGBANK_EDI", ediToken: "edi-token" } as const,
      {
        version: 1,
        kind: "MERCADO_PAGO_OAUTH",
        accessToken: "access-token",
        refreshToken: "refresh-token",
      } as const,
      { version: 1, kind: "MERCADO_PAGO_FIXED", accessToken: "fixed-token" } as const,
    ];

    for (const envelope of envelopes) {
      const encrypted = service.encryptEnvelope(envelope);
      expect(encrypted).not.toContain("token");
      expect(service.decryptEnvelope(encrypted)).toEqual(envelope);
    }
  });

  it("rejects legacy or malformed data as a typed envelope", () => {
    expect(() => service.decryptEnvelope(service.encrypt("edi-token"))).toThrow(
      "Envelope de credencial invalido"
    );
  });
});
