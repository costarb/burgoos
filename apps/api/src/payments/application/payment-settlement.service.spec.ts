import { describe, expect, it, vi } from "vitest";
import { PaymentSettlementService } from "./payment-settlement.service";
import type { MappedPointOrder } from "../mercado-pago-point/mercado-pago-point.mapper";

function setup() {
  const charge = {
    id: "charge-1",
    tenantId: "tenant-1",
    institution: "MERCADO_PAGO",
    method: "DEBIT_CARD",
    amount: "20.00",
    orderId: "order-1",
    serviceTabId: null,
    payment: null,
  };
  const tx = {
    paymentCharge: { findUnique: vi.fn(async () => charge) },
    payment: { create: vi.fn(async ({ data }) => ({ id: "payment-1", ...data })) },
    paymentAllocation: { create: vi.fn(async () => ({})) },
  };
  const prisma = { $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)) };
  const fiscalTrigger = { requestForOrder: vi.fn(async () => undefined), requestAutomatic: vi.fn() };
  const service = new PaymentSettlementService(prisma as never, fiscalTrigger as never);
  return { service, tx, fiscalTrigger };
}

function mapped(paymentMethod: MappedPointOrder["paymentMethod"]): MappedPointOrder {
  return {
    status: "APPROVED",
    providerStatus: "processed",
    providerStatusDetail: "accredited",
    providerTransactionId: "PAY-1",
    paidAmount: "20.00",
    refundedAmount: null,
    paymentMethodType: paymentMethod === "CREDIT_CARD" ? "credit_card" : null,
    paymentMethod,
  };
}

describe("PaymentSettlementService", () => {
  it("records the method the customer used on the terminal", async () => {
    const { service, tx, fiscalTrigger } = setup();
    await service.settleApproved("charge-1", mapped("CREDIT_CARD"));
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ method: "CREDIT_CARD", providerPaymentId: "PAY-1" }),
    });
    expect(fiscalTrigger.requestForOrder).toHaveBeenCalledWith("tenant-1", "order-1");
  });

  it("keeps the requested method when Mercado Pago does not report one", async () => {
    const { service, tx } = setup();
    await service.settleApproved("charge-1", mapped(null));
    expect(tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ method: "DEBIT_CARD" }) });
  });
});
