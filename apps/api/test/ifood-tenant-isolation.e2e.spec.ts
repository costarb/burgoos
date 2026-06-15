import { describe, expect, it, vi } from "vitest";
import { IfoodEventPollerService } from "../src/management/integrations/ifood/ifood-event-poller.service";

describe("iFood tenant isolation", () => {
  it("ingests orders using the tenant from the integration being polled", async () => {
    const ingest = vi.fn(async () => ({ id: "order-1" }));
    const service = new IfoodEventPollerService(
      {
        deliveryPlatformEvent: {
          upsert: vi.fn(async () => ({
            id: "event-db-1",
            tenantId: "tenant-from-integration",
            integrationId: "integration-1",
            provider: "IFOOD",
            externalEventId: "event-1",
            externalOrderId: "order-1",
            eventCode: "PLACED",
            fullEventCode: null,
            status: "RECEIVED",
            receivedAt: new Date(),
            providerCreatedAt: null,
            processingStartedAt: null,
            processedAt: null,
            acknowledgedAt: null,
            retryCount: 0,
            nextRetryAt: null,
            payload: {},
            normalizedSummary: null,
            errorMessage: null,
          })),
          update: vi.fn(),
        },
        deliveryIntegration: {
          update: vi.fn(),
        },
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      {
        pollEvents: vi.fn(async () => [
          { id: "event-1", code: "PLACED", orderId: "order-1", raw: {} },
        ]),
        getOrderDetails: vi.fn(async () => ({
          id: "order-1",
          merchant: { id: "merchant-1" },
          customer: { name: "Ana" },
          total: { orderAmount: 10 },
          items: [],
          payments: { methods: [{ method: "PIX" }] },
          createdAt: "2026-06-15T12:00:00.000Z",
        })),
        acknowledgeEvents: vi.fn(),
      } as never,
      { ingest } as never,
      { record: vi.fn() } as never
    );

    await service.pollIntegration({
      id: "integration-1",
      tenantId: "tenant-from-integration",
      provider: "IFOOD",
      orderPlatformId: "platform-1",
      externalMerchantId: "merchant-1",
    } as never);

    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-from-integration",
        integrationId: "integration-1",
      })
    );
  });
});
