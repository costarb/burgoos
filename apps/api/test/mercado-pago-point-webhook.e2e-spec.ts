import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoOrdersWebhookController } from "../src/payments/webhooks/mercado-pago-orders-webhook.controller";
import { PaymentProviderEventProcessor } from "../src/payments/webhooks/payment-provider-event.processor";

describe("Mercado Pago Point Orders webhook", () => {
  it("validates the signature and forwards a sanitized durable event", async () => {
    const verify = vi.fn().mockResolvedValue({ eventKey: "signed-event" });
    const accept = vi.fn().mockResolvedValue({ accepted: true, duplicate: false });
    const controller = new MercadoPagoOrdersWebhookController(
      { verify } as never,
      { accept } as never,
    );

    const result = await controller.receive(
      "ts=1,v1=signature",
      "request-a",
      undefined,
      {
        id: "event-a",
        type: "order",
        action: "order.updated",
        user_id: "seller-a",
        data: { id: "order-a" },
      },
    );

    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ dataId: "order-a" }));
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "event-a",
      resourceId: "order-a",
      topic: "order.updated",
    }));
    expect(result).toEqual({ accepted: true, duplicate: false });
  });

  it("acknowledges a duplicated provider event without processing it twice", async () => {
    const duplicated = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
    const processor = new PaymentProviderEventProcessor(
      {
        paymentProviderEvent: {
          create: vi.fn().mockRejectedValue(duplicated),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(processor.accept({
      eventId: "event-a",
      resourceId: "order-a",
      topic: "order.updated",
      payload: { data: { id: "order-a" } },
    })).resolves.toEqual({ accepted: true, duplicate: true });
  });
});
