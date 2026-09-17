import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { IfoodFinancialCredentialService } from "./ifood-financial-credential.service";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sales-1",
    tenantId: "tenant-1",
    provider: "IFOOD",
    environment: "PRODUCTION",
    externalMerchantId: "merchant-1",
    deliveryIntegration: {
      id: "delivery-1",
      tenantId: "tenant-1",
      provider: "IFOOD",
      environment: "PRODUCTION",
      externalMerchantId: "merchant-1",
      credentials: [
        {
          id: "credential-1",
          secretCiphertext: "ciphertext",
          tokenExpiresAt: new Date(Date.now() + 600_000),
          refreshExpiresAt: new Date(Date.now() + 86_400_000),
          metadata: { authMode: "DISTRIBUTED" },
        },
      ],
    },
    ...overrides,
  };
}

function setup(result: unknown = row()) {
  const prisma = {
    salesIntegration: { findFirst: vi.fn().mockResolvedValue(result) },
    deliveryIntegrationCredential: { update: vi.fn() },
  };
  const secrets = {
    decrypt: vi.fn().mockReturnValue(
      JSON.stringify({
        clientId: "client",
        clientSecret: "client-secret",
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })
    ),
    encrypt: vi.fn().mockReturnValue("new-ciphertext"),
  };
  const auth = { exchangeAuthorizationCode: vi.fn() };
  return {
    service: new IfoodFinancialCredentialService(prisma as never, secrets as never, auth as never),
    prisma,
    secrets,
    auth,
  };
}

describe("IfoodFinancialCredentialService", () => {
  it("scopes the lookup by tenant and does not expose client secrets", async () => {
    const { service, prisma } = setup();
    const result = await service.getCredential("tenant-1", "sales-1");
    expect(prisma.salesIntegration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1" }) })
    );
    expect(result).toEqual(
      expect.objectContaining({ accessToken: "access-token", merchantId: "merchant-1" })
    );
    expect(JSON.stringify(result)).not.toContain("client-secret");
    expect(JSON.stringify(result)).not.toContain("refresh-token");
  });

  it("rejects another tenant before decrypting", async () => {
    const { service, secrets } = setup(null);
    await expect(service.getCredential("tenant-2", "sales-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(secrets.decrypt).not.toHaveBeenCalled();
  });

  it("rejects a merchant mismatch", async () => {
    const mismatch = row();
    mismatch.deliveryIntegration.externalMerchantId = "merchant-2";
    const { service } = setup(mismatch);
    await expect(service.getCredential("tenant-1", "sales-1")).rejects.toBeInstanceOf(
      UnprocessableEntityException
    );
  });

  it("refreshes an expired token in the operational credential", async () => {
    const expired = row();
    expired.deliveryIntegration.credentials[0].tokenExpiresAt = new Date(Date.now() - 1);
    const { service, prisma, auth, secrets } = setup(expired);
    auth.exchangeAuthorizationCode.mockResolvedValue({
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token",
      expiresAt: new Date(Date.now() + 10_000_000),
      refreshExpiresAt: null,
      scopes: ["financial"],
    });
    const result = await service.getCredential("tenant-1", "sales-1");
    expect(auth.exchangeAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "refresh-token" })
    );
    expect(prisma.deliveryIntegrationCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "credential-1" } })
    );
    expect(secrets.encrypt).toHaveBeenCalled();
    expect(result.accessToken).toBe("fresh-access-token");
  });

  it("requires reauthorization when an expired distributed credential has no refresh token", async () => {
    const expired = row();
    expired.deliveryIntegration.credentials[0].tokenExpiresAt = new Date(Date.now() - 1);
    const { service, secrets } = setup(expired);
    secrets.decrypt.mockReturnValue(
      JSON.stringify({
        clientId: "client",
        clientSecret: "secret",
        accessToken: "expired",
        refreshToken: null,
      })
    );
    await expect(service.getCredential("tenant-1", "sales-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});
