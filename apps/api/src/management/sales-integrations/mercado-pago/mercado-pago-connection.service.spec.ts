/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoConnectionService } from "./mercado-pago-connection.service";

describe("MercadoPagoConnectionService", () => {
  it("validates a fixed token before atomically rotating it and never echoes the secret", async () => {
    const tx: any = {
      salesIntegration: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
      salesIntegrationCredential: { updateMany: vi.fn(), create: vi.fn() },
    };
    const prisma: any = {
      salesIntegration: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: "integration", environment: "PRODUCTION" })
          .mockResolvedValueOnce({
            id: "integration",
            provider: "MERCADO_PAGO",
            environment: "PRODUCTION",
            credentialMode: "FIXED_TOKEN",
            status: "ACTIVE",
            providerUserId: "123",
          }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };
    const secrets: any = {
      encryptEnvelope: vi.fn().mockReturnValue("ciphertext"),
      fingerprint: vi.fn().mockReturnValue("fingerprint"),
    };
    const client: any = { validateAccessToken: vi.fn().mockResolvedValue({ id: 123 }) };
    const audit: any = { record: vi.fn() };
    const service = new MercadoPagoConnectionService(prisma, secrets, client, {} as any, audit);
    const result = await service.connectFixedToken({
      tenantId: "tenant",
      integrationId: "integration",
      userId: "user",
      accessToken: "APP_USR-secret",
    });
    expect(client.validateAccessToken).toHaveBeenCalledWith("APP_USR-secret");
    expect(tx.salesIntegrationCredential.create).toHaveBeenCalled();
    expect(tx.salesIntegration.update).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("APP_USR-secret");
  });

  it("does not persist a candidate token when remote validation fails", async () => {
    const prisma: any = {
      salesIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "integration", environment: "PRODUCTION" }),
      },
      $transaction: vi.fn(),
    };
    const client: any = { validateAccessToken: vi.fn().mockRejectedValue(new Error("invalid")) };
    const service = new MercadoPagoConnectionService(
      prisma,
      {} as any,
      client,
      {} as any,
      { record: vi.fn() } as any
    );
    await expect(
      service.connectFixedToken({
        tenantId: "tenant",
        integrationId: "integration",
        userId: "user",
        accessToken: "invalid",
      })
    ).rejects.toThrow("invalid");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
