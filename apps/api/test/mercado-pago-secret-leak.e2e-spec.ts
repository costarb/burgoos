/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { IntegrationSecretService } from "../src/security/integration-secret.service";
import { SalesIntegrationService } from "../src/management/sales-integrations/sales-integration.service";

describe("Mercado Pago secret leak gate", () => {
  it("removes tokens, authorization codes, PKCE verifiers and signatures from structured metadata", () => {
    const secrets = new IntegrationSecretService({
      get: vi.fn().mockReturnValue("test-key"),
    } as any);
    const safe = secrets.redact({
      accessToken: "APP_USR-sensitive",
      refresh_token: "TG-sensitive",
      code: "TG-code",
      codeVerifier: "verifier",
      xSignature: "signature",
      nested: { authorization: "Bearer sensitive", allowed: "payment-1" },
    });
    expect(JSON.stringify(safe)).not.toMatch(
      /APP_USR-sensitive|TG-sensitive|TG-code|verifier|signature|Bearer sensitive/
    );
    expect(safe).toMatchObject({
      accessToken: "********",
      code: "********",
      nested: { allowed: "payment-1" },
    });
  });
  it("never serializes the encrypted credential in administrative DTOs", async () => {
    const row = {
      id: "i",
      tenantId: "t",
      provider: "MERCADO_PAGO",
      channel: "API",
      environment: "PRODUCTION",
      credentialMode: "OAUTH",
      status: "ACTIVE",
      displayName: "MP",
      externalMerchantId: null,
      providerUserId: "123",
      settings: {},
      scopes: [],
      tokenExpiresAt: null,
      connectedAt: new Date(),
      lastSyncAt: null,
      disconnectedAt: null,
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [
        {
          status: "ACTIVE",
          fingerprint: "safe",
          secretCiphertext: "cipher-with-token-code-verifier",
        },
      ],
    };
    const service = new SalesIntegrationService(
      { salesIntegration: { findFirst: vi.fn().mockResolvedValue(row) } } as any,
      {} as any
    );
    const response = await service.get("t", "i");
    expect(JSON.stringify(response)).not.toContain("cipher-with-token-code-verifier");
    expect(response).toHaveProperty("hasCredential", true);
  });
});
