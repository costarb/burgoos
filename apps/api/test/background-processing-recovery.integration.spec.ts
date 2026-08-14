import type { BackgroundJob } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { SalesImportRunProcessor } from "../src/management/sales-integrations/sales-import-run.processor";
import { MercadoPagoWebhookService } from "../src/management/sales-integrations/mercado-pago/mercado-pago-webhook.service";
import { PaymentProviderEventProcessor } from "../src/payments/webhooks/payment-provider-event.processor";

const enabled = { get: vi.fn().mockReturnValue("true") };

describe("durable background processing recovery", () => {
  it("discovers recoverable imports in bounded pages and enqueues them sequentially", async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({
      id: `run-${String(index).padStart(2, "0")}`,
      tenantId: "tenant-a",
      status: index === 24 ? "IMPORTING" : "PENDING",
    }));
    const lastPage = [{ id: "run-25", tenantId: "tenant-b", status: "FETCHING" }];
    const findMany = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(lastPage);
    let active = 0;
    let peakActive = 0;
    const enqueue = vi.fn(async () => {
      active += 1;
      peakActive = Math.max(peakActive, active);
      await Promise.resolve();
      active -= 1;
      return {};
    });
    const register = vi.fn();
    const processor = new SalesImportRunProcessor(
      { salesImportRun: { findMany } } as never,
      {} as never,
      {} as never,
      { enqueue } as never,
      { register } as never,
      enabled as never,
    );

    await processor.onModuleInit();

    expect(register).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 25 }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      take: 25,
      cursor: { id: "run-24" },
      skip: 1,
    }));
    expect(enqueue).toHaveBeenCalledTimes(26);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "SALES_IMPORT_CONFIRM",
      targetId: "run-24",
      dedupeKey: "run-24",
    }));
    expect(peakActive).toBe(1);
  });

  it("persists and enqueues a provider webhook before acknowledgement and resumes by target id", async () => {
    const order: string[] = [];
    const create = vi.fn(async () => {
      order.push("persisted");
      return { id: "notification-a" };
    });
    const enqueue = vi.fn(async () => {
      order.push("enqueued");
      return {};
    });
    const service = new MercadoPagoWebhookService(
      { providerNotification: { create } } as never,
      { redact: vi.fn().mockReturnValue({}) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueue } as never,
      { register: vi.fn() } as never,
      enabled as never,
    );

    const result = await service.accept({
      eventKey: "event-a",
      payload: { id: 1, type: "payment", live_mode: true, data: { id: "payment-a" } },
    });

    expect(order).toEqual(["persisted", "enqueued"]);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "PROVIDER_WEBHOOK",
      priority: "CRITICAL",
      targetId: "notification-a",
      dedupeKey: "notification-a",
      payload: {},
    }));
    expect(result).toEqual({ accepted: true, duplicate: false });

    const recoveryEnqueue = vi.fn().mockResolvedValue({});
    const restarted = new MercadoPagoWebhookService(
      {
        providerNotification: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "notification-a", tenantId: null }]),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueue: recoveryEnqueue } as never,
      { register: vi.fn() } as never,
      enabled as never,
    );
    await restarted.onModuleInit();
    expect(recoveryEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "PROVIDER_WEBHOOK",
      targetId: "notification-a",
    }));
    const process = vi.spyOn(restarted, "process").mockResolvedValue();
    await restarted.execute({ targetId: "notification-a" } as BackgroundJob);
    expect(process).toHaveBeenCalledWith("notification-a", true);
  });

  it("persists and enqueues a payment webhook before acknowledgement", async () => {
    const order: string[] = [];
    const processor = new PaymentProviderEventProcessor(
      {
        paymentProviderEvent: {
          create: vi.fn(async () => {
            order.push("persisted");
            return { id: "payment-event-a" };
          }),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueue: vi.fn(async () => { order.push("enqueued"); return {}; }) } as never,
      { register: vi.fn() } as never,
      enabled as never,
    );

    await processor.accept({
      eventId: "event-a",
      resourceId: "order-a",
      topic: "order.updated",
      payload: { data: { id: "order-a" } },
    });

    expect(order).toEqual(["persisted", "enqueued"]);

    const recoveryEnqueue = vi.fn().mockResolvedValue({});
    const restarted = new PaymentProviderEventProcessor(
      {
        paymentProviderEvent: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "payment-event-a", tenantId: null }]),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { enqueue: recoveryEnqueue } as never,
      { register: vi.fn() } as never,
      enabled as never,
    );
    await restarted.onModuleInit();
    expect(recoveryEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      type: "PAYMENT_WEBHOOK",
      targetId: "payment-event-a",
    }));
  });
});
