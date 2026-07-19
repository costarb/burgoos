/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, GoneException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoOAuthService } from "./mercado-pago-oauth.service";

function setup() {
  const prisma: any = {
    salesIntegration: {
      findFirst: vi.fn().mockResolvedValue({ id: "integration", environment: "PRODUCTION" }),
      update: vi.fn().mockReturnValue("update"),
    },
    oAuthAuthorizationAttempt: {
      create: vi.fn().mockReturnValue("create"),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    user: { findFirst: vi.fn().mockResolvedValue({ id: "user" }) },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const secrets: any = {
    encrypt: vi.fn((value) => `encrypted:${value}`),
    decrypt: vi.fn((value) => value.replace("encrypted:", "")),
  };
  const values: Record<string, string> = {
    clientId: "app",
    redirectUri: "https://example.test/callback",
  };
  const config: any = { required: vi.fn(async (key: string) => values[key]) };
  return { prisma, secrets, service: new MercadoPagoOAuthService(prisma, secrets, config) };
}

describe("MercadoPagoOAuthService", () => {
  it("creates a random state stored only as SHA-256 and a valid S256 PKCE challenge", async () => {
    const { prisma, secrets, service } = setup();
    const result = await service.start({
      tenantId: "tenant",
      integrationId: "integration",
      userId: "user",
      initialLoadDays: 30,
    });
    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get("state")!;
    const create = prisma.oAuthAuthorizationAttempt.create.mock.calls[0][0].data;
    expect(create.stateHash).toBe(service.hashState(state));
    expect(JSON.stringify(create)).not.toContain(state);
    const verifier = secrets.encrypt.mock.calls[0][0];
    expect(url.searchParams.get("code_challenge")).toBe(
      (await import("crypto")).createHash("sha256").update(verifier).digest("base64url")
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("rejects expired and replayed states", async () => {
    const expired = setup();
    expired.prisma.oAuthAuthorizationAttempt.findUnique.mockResolvedValue({
      id: "a",
      expiresAt: new Date(0),
      status: "PENDING",
    });
    expired.prisma.oAuthAuthorizationAttempt.updateMany.mockResolvedValue({ count: 1 });
    await expect(expired.service.claim("state")).rejects.toBeInstanceOf(GoneException);

    const replay = setup();
    replay.prisma.oAuthAuthorizationAttempt.findUnique.mockResolvedValue({
      id: "a",
      tenantId: "t",
      requestedByUserId: "u",
      expiresAt: new Date(Date.now() + 10000),
      status: "COMPLETED",
      codeVerifierCiphertext: "encrypted:v",
    });
    replay.prisma.oAuthAuthorizationAttempt.updateMany.mockResolvedValue({ count: 0 });
    await expect(replay.service.claim("state")).rejects.toBeInstanceOf(ConflictException);
  });
});
