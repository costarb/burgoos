/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoRefreshService } from "./mercado-pago-refresh.service";

describe("MercadoPagoRefreshService", () => {
  it("claims the connection and atomically rotates access and refresh tokens", async () => {
    const tx: any = {
      salesIntegrationCredential: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      salesIntegration: { update: vi.fn() },
    };
    const prisma: any = {
      salesIntegration: {
        findFirst: vi.fn().mockResolvedValue({
          id: "i",
          credentials: [{ id: "old", secretCiphertext: "cipher", createdByUserId: "u" }],
        }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const secrets: any = {
      decryptEnvelope: vi.fn().mockReturnValue({
        kind: "MERCADO_PAGO_OAUTH",
        accessToken: "old-access",
        refreshToken: "old-refresh",
      }),
      encryptEnvelope: vi.fn().mockReturnValue("new-cipher"),
      fingerprint: vi.fn().mockReturnValue("fingerprint"),
    };
    const client: any = {
      refreshAuthorization: vi.fn().mockResolvedValue({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 1000,
        user_id: 123,
        scope: "offline_access read",
      }),
    };
    const locks: any = { acquire: vi.fn().mockResolvedValue(true), release: vi.fn() };
    const service = new MercadoPagoRefreshService(prisma, secrets, client, locks, {
      record: vi.fn(),
    } as any);
    await expect(service.refresh("tenant", "i")).resolves.toBe(true);
    expect(client.refreshAuthorization).toHaveBeenCalledWith("old-refresh");
    expect(tx.salesIntegrationCredential.create.mock.calls[0][0].data.secretCiphertext).toBe(
      "new-cipher"
    );
    expect(tx.salesIntegrationCredential.updateMany).toHaveBeenCalled();
    expect(tx.salesIntegration.update).toHaveBeenCalled();
  });
  it("does not call the provider when another worker owns the claim", async () => {
    const client: any = { refreshAuthorization: vi.fn() };
    const service = new MercadoPagoRefreshService(
      {} as any,
      {} as any,
      client,
      { acquire: vi.fn().mockResolvedValue(false) } as any,
      {} as any
    );
    await expect(service.refresh("tenant", "i")).resolves.toBe(false);
    expect(client.refreshAuthorization).not.toHaveBeenCalled();
  });
});
