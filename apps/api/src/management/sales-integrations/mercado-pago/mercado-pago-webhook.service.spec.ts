/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { mercadoPagoApprovedPaymentFixture } from "./__fixtures__/mercado-pago.fixtures";
import { MercadoPagoWebhookService } from "./mercado-pago-webhook.service";

describe("MercadoPagoWebhookService", () => {
  it("claims once, resolves by provider user ID and fetches the canonical payment with that connection", async () => {
    const notification = {
      id: "n",
      providerUserId: "123456789",
      environment: "PRODUCTION",
      resourceType: "PAYMENT",
      providerResourceId: "987654321",
      attempts: 1,
    };
    const prisma: any = {
      providerNotification: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(notification),
        update: vi.fn().mockReturnValue("notification-update"),
      },
      salesIntegration: {
        findFirst: vi.fn().mockResolvedValue({ id: "integration", tenantId: "tenant" }),
        update: vi.fn().mockReturnValue("integration-update"),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const authenticated: any = { execute: vi.fn(async ({ request }) => request("account-token")) };
    const client: any = {
      getPayment: vi.fn().mockResolvedValue(mercadoPagoApprovedPaymentFixture),
    };
    const states: any = { upsertFromMovement: vi.fn().mockResolvedValue("state") };
    const service = new MercadoPagoWebhookService(
      prisma,
      { redact: vi.fn() } as any,
      authenticated,
      client,
      states,
      { record: vi.fn() } as any
    );
    await service.process("n");
    expect(prisma.salesIntegration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ providerUserId: "123456789" }) })
    );
    expect(client.getPayment).toHaveBeenCalledWith("account-token", "987654321");
    expect(states.upsertFromMovement).toHaveBeenCalled();
  });
  it("ignores a second worker after the notification claim is consumed", async () => {
    const prisma: any = {
      providerNotification: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
    };
    const service = new MercadoPagoWebhookService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    await service.process("n");
    expect(prisma.providerNotification.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
