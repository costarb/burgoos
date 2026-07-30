import {
  ChargeMode,
  ChargeStatus,
  PaymentInstitution,
  PaymentMethod,
  PaymentTargetType,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentChargeService } from "../src/payments/application/payment-charge.service";

const providerStates: Array<{
  status: string;
  transaction?: string;
  detail?: string;
  expected: ChargeStatus;
}> = [
  { status: "processed", transaction: "accredited", expected: ChargeStatus.APPROVED },
  { status: "failed", transaction: "declined", expected: ChargeStatus.DECLINED },
  { status: "expired", transaction: "expired", expected: ChargeStatus.EXPIRED },
  { status: "action_required", detail: "check_on_terminal", expected: ChargeStatus.UNKNOWN },
] as const;

describe("Mercado Pago Point charge lifecycle", () => {
  for (const scenario of providerStates) {
    it(`maps ${scenario.status} to ${scenario.expected}`, async () => {
      let status: ChargeStatus = ChargeStatus.PROCESSING;
      const base = {
        id: "charge-a",
        tenantId: "tenant-a",
        targetType: PaymentTargetType.ORDER,
        orderId: "order-a",
        serviceTabId: null,
        institution: PaymentInstitution.MERCADO_PAGO,
        method: PaymentMethod.DEBIT_CARD,
        mode: ChargeMode.AUTOMATIC,
        amount: new Prisma.Decimal("20.00"),
        providerStatus: null,
        providerStatusDetail: null,
        terminalId: "terminal-a",
        createdAt: new Date("2026-07-28T12:00:00.000Z"),
        expiresAt: null,
        finalizedAt: null,
      };
      const prisma = {
        paymentCharge: {
          findUnique: vi.fn(async () => ({ status })),
          updateMany: vi.fn(async ({ data }: { data: { status: ChargeStatus } }) => {
            status = data.status;
            return { count: 1 };
          }),
          findUniqueOrThrow: vi.fn(async () => ({
            ...base,
            status,
            providerStatus: scenario.status,
            providerStatusDetail: scenario.detail ?? null,
          })),
        },
      };
      const settleApproved = vi.fn();
      const service = new PaymentChargeService(
        prisma as never,
        {} as never,
        {} as never,
        { settleApproved } as never,
      );

      const result = await service.applyProviderOrder("charge-a", {
        id: "provider-order-a",
        status: scenario.status,
        status_detail: scenario.detail,
        transactions: {
          payments: [{
            id: "payment-a",
            status: scenario.transaction,
          }],
        },
      });

      expect(result.status).toBe(scenario.expected);
      expect(prisma.paymentCharge.updateMany).toHaveBeenCalledTimes(1);
      expect(settleApproved).toHaveBeenCalledTimes(1);
    });
  }

  it("does not regress an approved charge when an older processing event arrives", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "charge-a",
      tenantId: "tenant-a",
      targetType: PaymentTargetType.ORDER,
      orderId: "order-a",
      serviceTabId: null,
      institution: PaymentInstitution.MERCADO_PAGO,
      method: PaymentMethod.DEBIT_CARD,
      mode: ChargeMode.AUTOMATIC,
      status: ChargeStatus.APPROVED,
      amount: new Prisma.Decimal("20.00"),
      providerStatus: "processed",
      providerStatusDetail: "accredited",
      terminalId: "terminal-a",
      createdAt: new Date("2026-07-28T12:00:00.000Z"),
      expiresAt: null,
      finalizedAt: new Date("2026-07-28T12:01:00.000Z"),
    });
    const service = new PaymentChargeService(
      {
        paymentCharge: {
          findUnique,
          updateMany: vi.fn(),
        },
      } as never,
      {} as never,
      {} as never,
      { settleApproved: vi.fn() } as never,
    );

    const result = await service.applyProviderOrder("charge-a", {
      id: "provider-order-a",
      status: "at_terminal",
    });

    expect(result.status).toBe(ChargeStatus.APPROVED);
  });
});
