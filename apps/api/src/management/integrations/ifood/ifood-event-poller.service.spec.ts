import { afterEach, describe, expect, it, vi } from "vitest";
import { IfoodEventPollerService } from "./ifood-event-poller.service";

describe("IfoodEventPollerService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("records order patch events as operator exceptions without recreating the order", async () => {
    const event = {
      id: "event-db-2",
      tenantId: "tenant-1",
      integrationId: "integration-1",
      provider: "IFOOD",
      externalEventId: "event-2",
      externalOrderId: "order-2",
      eventCode: "ORDER_PATCHED",
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
    const updateEvent = vi.fn(async () => event);
    const updateLink = vi.fn();
    const ingest = vi.fn();
    const service = new IfoodEventPollerService(
      {
        deliveryPlatformEvent: {
          upsert: vi.fn(async () => event),
          update: updateEvent,
        },
        deliveryIntegration: { update: vi.fn() },
        platformOrderLink: {
          findFirst: vi.fn(async () => ({ id: "link-1" })),
          update: updateLink,
        },
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      {
        pollEvents: vi.fn(async () => [
          { id: "event-2", code: "ORDER_PATCHED", orderId: "order-2", raw: {} },
        ]),
        getOrderDetails: vi.fn(async () => ({ id: "order-2", total: { orderAmount: 20 } })),
        acknowledgeEvents: vi.fn(),
      } as never,
      { ingest } as never,
      { record: vi.fn() } as never
    );

    await service.pollIntegration({
      id: "integration-1",
      tenantId: "tenant-1",
      provider: "IFOOD",
      orderPlatformId: "platform-1",
      externalMerchantId: "merchant-1",
    } as never);

    expect(ingest).not.toHaveBeenCalled();
    expect(updateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "link-1" },
        data: expect.objectContaining({
          externalStatus: "ORDER_PATCHED",
          rawOrderSnapshot: expect.objectContaining({ id: "order-2" }),
        }),
      })
    );
    expect(updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedSummary: expect.objectContaining({
            exceptionType: "ORDER_MODIFIED",
            requiresOperatorReview: true,
          }),
        }),
      })
    );
  });

  it("updates platform order link for cancellation result events", async () => {
    const event = {
      id: "event-db-3",
      tenantId: "tenant-1",
      integrationId: "integration-1",
      provider: "IFOOD",
      externalEventId: "event-3",
      externalOrderId: "order-3",
      eventCode: "CANCELLATION_ACCEPTED",
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
    const updateLink = vi.fn();
    const service = new IfoodEventPollerService(
      {
        deliveryPlatformEvent: {
          upsert: vi.fn(async () => event),
          update: vi.fn(async () => event),
        },
        deliveryIntegration: { update: vi.fn() },
        platformOrderLink: {
          findFirst: vi.fn(async () => ({ id: "link-3" })),
          update: updateLink,
        },
      } as never,
      { getActiveCredentialSecret: vi.fn(async () => ({ accessToken: "token" })) } as never,
      {
        pollEvents: vi.fn(async () => [
          { id: "event-3", code: "CANCELLATION_ACCEPTED", orderId: "order-3", raw: {} },
        ]),
        acknowledgeEvents: vi.fn(),
      } as never,
      { ingest: vi.fn() } as never,
      { record: vi.fn() } as never
    );

    await service.pollIntegration({
      id: "integration-1",
      tenantId: "tenant-1",
      provider: "IFOOD",
      orderPlatformId: "platform-1",
      externalMerchantId: "merchant-1",
    } as never);

    expect(updateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "link-3" },
        data: expect.objectContaining({
          externalStatus: "CANCELLATION_ACCEPTED",
        }),
      })
    );
  });

  it("starts scheduled polling with a minimum 30 second interval", () => {
    vi.useFakeTimers();
    const findMany = vi.fn(async () => []);
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const service = new IfoodEventPollerService(
      { deliveryIntegration: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      { get: vi.fn(() => "5") } as never
    );

    service.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    service.onModuleDestroy();
  });
});
