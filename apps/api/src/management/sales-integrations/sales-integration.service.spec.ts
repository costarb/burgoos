import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SalesIntegrationService } from "./sales-integration.service";

describe("SalesIntegrationService", () => {
  it("scopes reads by tenant and never serializes ciphertext", async () => {
    const findFirst = vi.fn(async () => ({
      id: "integration",
      tenantId: "tenant",
      provider: "PAGBANK",
      channel: "API",
      status: "DRAFT",
      displayName: "PagBank",
      externalMerchantId: "user",
      settings: {},
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [{ status: "ACTIVE", fingerprint: "abc", secretCiphertext: "secret" }],
    }));
    const service = new SalesIntegrationService(
      { salesIntegration: { findFirst } } as never,
      {} as never
    );
    const result = await service.get("tenant", "integration");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "integration", tenantId: "tenant" } })
    );
    expect(result).toMatchObject({ hasCredential: true, credentialFingerprint: "abc" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rotates credentials in one transaction", async () => {
    const updateMany = vi.fn();
    const create = vi.fn();
    const prisma = {
      salesIntegration: { findFirst: vi.fn(async () => ({ id: "integration", credentials: [] })) },
      $transaction: (callback: (tx: unknown) => unknown) =>
        callback({ salesIntegrationCredential: { updateMany, create } }),
    };
    const service = new SalesIntegrationService(
      prisma as never,
      { encryptEnvelope: vi.fn(() => "cipher"), fingerprint: vi.fn(() => "fingerprint") } as never
    );
    await service.rotateCredential("tenant", "user", "integration", { token: "token" });
    expect(updateMany).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ secretCiphertext: "cipher", fingerprint: "fingerprint" }),
      })
    );
  });

  it("creates integrations with the authenticated tenant and actor", async () => {
    const created = {
      id: "integration",
      tenantId: "tenant",
      provider: "PAGBANK",
      channel: "API",
      status: "DRAFT",
      displayName: "PagBank",
      externalMerchantId: "user",
      settings: {},
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [],
    };
    const create = vi.fn().mockResolvedValue(created);
    const service = new SalesIntegrationService(
      { salesIntegration: { create } } as never,
      {} as never
    );
    await service.create("tenant", "actor", {
      provider: "PAGBANK",
      channel: "API",
      displayName: "PagBank",
      externalMerchantId: "user",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant",
          createdByUserId: "actor",
          updatedByUserId: "actor",
        }),
      })
    );
  });

  it("requires USER and active TOKEN before activation", async () => {
    const findFirst = vi.fn().mockResolvedValue({ externalMerchantId: null, credentials: [] });
    const service = new SalesIntegrationService(
      { salesIntegration: { findFirst } } as never,
      {} as never
    );
    await expect(
      service.setStatus("tenant", "actor", "integration", { status: "ACTIVE" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns not found instead of exposing another tenant integration", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new SalesIntegrationService(
      { salesIntegration: { findFirst } } as never,
      {} as never
    );
    await expect(service.get("other-tenant", "integration")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "integration", tenantId: "other-tenant" } })
    );
  });

  it.each([
    "PENDING_AUTHORIZATION",
    "ACTIVE",
    "TOKEN_EXPIRING",
    "REFRESHING",
    "REAUTHORIZATION_REQUIRED",
    "ERROR",
    "DISABLED",
  ] as const)("serializes %s safely for OAuth and fixed-token connections", async (status) => {
    const row = {
      id: "integration",
      tenantId: "tenant",
      provider: "MERCADO_PAGO",
      channel: "API",
      environment: "PRODUCTION",
      credentialMode: status === "DISABLED" ? "FIXED_TOKEN" : "OAUTH",
      status,
      displayName: "Mercado Pago",
      externalMerchantId: null,
      providerUserId: "123",
      settings: {},
      scopes: ["read"],
      tokenExpiresAt: new Date("2027-01-01T00:00:00Z"),
      connectedAt: new Date(),
      lastSyncAt: null,
      disconnectedAt: null,
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      credentials: [
        { status: "ACTIVE", fingerprint: "safe", secretCiphertext: "APP_USR-never-return" },
      ],
    };
    const service = new SalesIntegrationService(
      { salesIntegration: { findFirst: vi.fn().mockResolvedValue(row) } } as never,
      {} as never
    );
    const result = await service.get("tenant", "integration");
    expect(result.publicStatus).toBe(
      status === "ACTIVE" ? "CONNECTED" : status === "DISABLED" ? "DISCONNECTED" : status
    );
    expect(result).toMatchObject({
      providerUserId: "123",
      hasCredential: true,
      credentialMode: row.credentialMode,
    });
    expect(JSON.stringify(result)).not.toContain("APP_USR");
    expect(JSON.stringify(result)).not.toContain("secretCiphertext");
  });
});
