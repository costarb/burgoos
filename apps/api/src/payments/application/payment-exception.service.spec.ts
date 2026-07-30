import { ChargeMode, ChargeStatus, OrderStatus, PaymentExceptionType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentExceptionService } from "./payment-exception.service";

function buildService(charge: Record<string, unknown>) {
  const created: Array<Record<string, unknown>> = [];
  const tx = {
    paymentException: { create: vi.fn(({ data }) => created.push(data)) },
    orderOperationalEvent: { create: vi.fn() },
  };
  const prisma = {
    paymentCharge: { findUnique: vi.fn().mockResolvedValue(charge), count: vi.fn().mockResolvedValue(0) },
    paymentException: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn((callback) => callback(tx)),
  };
  return { service: new PaymentExceptionService(prisma as never), created };
}

const base = {
  id: "charge-1",
  tenantId: "tenant-1",
  mode: ChargeMode.AUTOMATIC,
  status: ChargeStatus.APPROVED,
  orderId: "order-1",
  serviceTabId: null,
  amount: "20.00",
  providerStatusDetail: null,
  payment: { id: "payment-1", grossAmount: "20.00" },
  order: { status: OrderStatus.PENDING },
};

describe("PaymentExceptionService", () => {
  it("opens a possible duplicate approval exception", async () => {
    const { service, created } = buildService(base);
    (service as any).prisma.paymentCharge.count.mockResolvedValue(1);
    await service.detect("charge-1");
    expect(created).toEqual([expect.objectContaining({ type: PaymentExceptionType.POSSIBLE_DUPLICATE })]);
  });

  it("opens a manual divergence exception", async () => {
    const { service, created } = buildService({
      ...base,
      mode: ChargeMode.MANUAL,
      payment: { id: "payment-1", grossAmount: "19.00" },
    });
    await service.detect("charge-1");
    expect(created).toEqual([expect.objectContaining({ type: PaymentExceptionType.MANUAL_DIVERGENCE })]);
  });

  it("opens a refund-after-delivery exception", async () => {
    const { service, created } = buildService({
      ...base,
      status: ChargeStatus.REFUNDED,
      order: { status: OrderStatus.DELIVERED },
    });
    await service.detect("charge-1");
    expect(created).toEqual([expect.objectContaining({ type: PaymentExceptionType.REFUND_AFTER_DELIVERY })]);
  });
});
