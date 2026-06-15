import { describe, expect, it, vi } from "vitest";
import { IfoodEventPollerService } from "./ifood-event-poller.service";

describe("IfoodEventPollerService", () => {
  it("polls due integrations with a 30 second guard", async () => {
    const findMany = vi.fn(async () => []);
    const service = new IfoodEventPollerService(
      { deliveryIntegration: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    const now = new Date("2026-06-15T12:00:00.000Z");
    await service.pollDueIntegrations(now);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: "IFOOD",
          status: "ACTIVE",
          pollingEnabled: true,
          OR: [
            { lastSuccessfulPollingAt: null },
            { lastSuccessfulPollingAt: { lt: new Date("2026-06-15T11:59:30.000Z") } },
          ],
        }),
      })
    );
  });

  it("acknowledges an event after successful ingestion", async () => {
    const event = {
      id: "event-db-1",
      tenantId: "tenant-1",
      integrationId: "integration-1",
      provider: "IFOOD",
      externalEventId: "event-1",
      externalOrderId: "order-1",
      eventCode: "PLACED",
      fullEventCode: null,
      status: "RECEIVED",
      receivedAt: new Date(),
      providerCreatedAt: new Date(),
      processingStartedAt: null,
      processedAt: null,
      acknowledgedAt: null,
      retryCount: 0,
      nextRetryAt: null,
      payload: {},
      normalizedSummary: null,
      errorMessage: null,
    };
    const update = vi.fn(async () => event);
    const service = new IfoodEventPollerService(
      {
        deliveryPlatformEvent: {
          upsert: vi.fn(async () => event),
          update,
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
      { ingest: vi.fn(async () => ({ id: "order-internal-1" })) } as never,
      { record: vi.fn() } as never
    );

    await service.pollIntegration({
      id: "integration-1",
      tenantId: "tenant-1",
      provider: "IFOOD",
      orderPlatformId: "platform-1",
      externalMerchantId: "merchant-1",
    } as never);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACKED",
          acknowledgedAt: expect.any(Date),
        }),
      })
    );
  });
});
