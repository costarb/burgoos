import { describe, expect, it, vi } from "vitest";
import { ExternalOrderIngestionService } from "./external-order-ingestion.service";

describe("ExternalOrderIngestionService", () => {
  it("returns existing linked order without duplicating platform orders", async () => {
    const existingOrder = { id: "order-1", items: [] };
    const service = new ExternalOrderIngestionService(
      {
        platformOrderLink: {
          findUnique: vi.fn(async () => ({ order: existingOrder })),
        },
      } as never,
      { emitOrderCreated: vi.fn() } as never
    );

    const result = await service.ingest({
      tenantId: "tenant-1",
      integrationId: "integration-1",
      orderPlatformId: "platform-1",
      order: {
        provider: "IFOOD",
        externalOrderId: "external-1",
        externalMerchantId: "merchant-1",
        externalStatus: "PLACED",
        mode: "DELIVERY",
        timing: "IMMEDIATE",
        customerName: "Ana",
        customerPhone: null,
        fulfillmentMethod: "DELIVERY",
        paymentMethod: "PIX",
        total: 10,
        rawOrder: {},
        items: [],
      },
    });

    expect(result).toBe(existingOrder);
  });
});
