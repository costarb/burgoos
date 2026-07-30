import {
  ConflictException,
} from "@nestjs/common";
import {
  PaymentInstitution,
  PaymentMethod,
  PaymentTargetType,
  ChargeMode,
  ChargeStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  methodsForInstitution,
  validateManualPayment,
} from "./manual-payment.service";
import { ManualPaymentReversalService } from "./manual-payment-reversal.service";

describe("manual payments", () => {
  it("calculates cash change for Caixa local", () => {
    const result = validateManualPayment(
      PaymentInstitution.CAIXA_LOCAL,
      PaymentMethod.CASH,
      new Prisma.Decimal("73.00"),
      new Prisma.Decimal("100.00"),
    );
    expect(result.cashChangeAmount?.toFixed(2)).toBe("27.00");
  });

  it("rejects cash below the amount and cash outside Caixa local", () => {
    expect(() => validateManualPayment(
      PaymentInstitution.CAIXA_LOCAL,
      PaymentMethod.CASH,
      new Prisma.Decimal("73.00"),
      new Prisma.Decimal("50.00"),
    )).toThrow(ConflictException);
    expect(() => validateManualPayment(
      PaymentInstitution.PAGBANK,
      PaymentMethod.CASH,
      new Prisma.Decimal("73.00"),
    )).toThrow("Dinheiro deve ser registrado no Caixa local");
  });

  it("exposes cash only for Caixa local and electronic methods for PagBank", () => {
    expect(methodsForInstitution(PaymentInstitution.CAIXA_LOCAL)).toEqual([
      PaymentMethod.CASH,
    ]);
    expect(methodsForInstitution(PaymentInstitution.PAGBANK)).toContain(
      PaymentMethod.DEBIT_CARD,
    );
    expect(methodsForInstitution(PaymentInstitution.PAGBANK)).not.toContain(
      PaymentMethod.CASH,
    );
  });

  it("cancels a manual payment and reopens the tab balance", async () => {
    const charge = {
      id: "charge-a",
      tenantId: "tenant-a",
      targetType: PaymentTargetType.SERVICE_TAB,
      orderId: null,
      serviceTabId: "tab-a",
      institution: PaymentInstitution.PAGBANK,
      method: PaymentMethod.DEBIT_CARD,
      mode: ChargeMode.MANUAL,
      status: ChargeStatus.APPROVED,
      amount: new Prisma.Decimal("25.00"),
      cashReceivedAmount: null,
      cashChangeAmount: null,
      terminalId: null,
      providerStatus: null,
      providerStatusDetail: null,
      createdAt: new Date("2026-07-24T12:00:00.000Z"),
      expiresAt: null,
      finalizedAt: new Date("2026-07-24T12:00:00.000Z"),
      payment: { id: "payment-a", cancelledAt: null },
    };
    const tx = {
      paymentCharge: {
        findFirst: vi.fn().mockResolvedValue(charge),
        update: vi.fn().mockResolvedValue({ ...charge, status: ChargeStatus.CANCELLED }),
      },
      payment: { update: vi.fn().mockResolvedValue({}) },
      serviceTab: { update: vi.fn().mockResolvedValue({}) },
      orderOperationalEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new ManualPaymentReversalService({
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    } as never);

    const result = await service.cancel({
      id: "manager-a",
      tenantId: "tenant-a",
      role: UserRole.ADMIN,
      email: "manager@example.com",
      name: "Manager",
    }, "charge-a", { reason: "Pagamento lançado incorretamente" });

    expect(result.status).toBe(ChargeStatus.CANCELLED);
    expect(tx.payment.update).toHaveBeenCalled();
    expect(tx.serviceTab.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "tab-a" },
      data: expect.objectContaining({ status: "CHECKOUT_PENDING" }),
    }));
    expect(tx.orderOperationalEvent.create).toHaveBeenCalled();
  });
});
