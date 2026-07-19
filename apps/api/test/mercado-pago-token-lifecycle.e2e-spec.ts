/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoConnectionService } from "../src/management/sales-integrations/mercado-pago/mercado-pago-connection.service";

describe("Mercado Pago connection lifecycle", () => {
  it("disconnects and reconnects without deleting imported or canonical history", async () => {
    const txCalls: unknown[] = [];
    const prisma: any = {
      salesIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "integration", environment: "PRODUCTION" }),
        update: vi.fn().mockReturnValue("integration-update"),
      },
      salesIntegrationCredential: { updateMany: vi.fn().mockReturnValue("credential-update") },
      providerTransactionState: { deleteMany: vi.fn() },
      externalSalesMovement: { deleteMany: vi.fn() },
      $transaction: vi.fn(async (value) => {
        if (Array.isArray(value)) txCalls.push(...value);
        else
          await value({
            salesIntegration: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
            salesIntegrationCredential: { updateMany: vi.fn(), create: vi.fn() },
          });
      }),
    };
    const secrets: any = {
      encryptEnvelope: vi.fn().mockReturnValue("cipher"),
      fingerprint: vi.fn().mockReturnValue("fingerprint"),
    };
    const client: any = { validateAccessToken: vi.fn().mockResolvedValue({ id: 123 }) };
    const service = new MercadoPagoConnectionService(
      prisma,
      secrets,
      client,
      {} as any,
      { record: vi.fn() } as any
    );
    await service.disconnect("tenant", "integration", "admin");
    await service.connectFixedToken({
      tenantId: "tenant",
      integrationId: "integration",
      userId: "admin",
      accessToken: "new-token",
    });
    expect(txCalls).toHaveLength(2);
    expect(prisma.providerTransactionState.deleteMany).not.toHaveBeenCalled();
    expect(prisma.externalSalesMovement.deleteMany).not.toHaveBeenCalled();
  });
});
