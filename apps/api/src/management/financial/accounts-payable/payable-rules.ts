import { Prisma } from "@prisma/client";
import { toDecimal } from "../money";

export type PayableStatus = "OPEN" | "OVERDUE" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

interface PayableStatusInput {
  expectedAmount: Prisma.Decimal | number | string;
  paidAmount: Prisma.Decimal | number | string;
  dueDate: Date;
  cancelledAt?: Date | null;
}

export function calculatePayableStatus(input: PayableStatusInput, asOf = new Date()): PayableStatus {
  if (input.cancelledAt) {
    return "CANCELLED";
  }

  const expectedAmount = toDecimal(input.expectedAmount);
  const paidAmount = toDecimal(input.paidAmount);

  if (paidAmount.greaterThanOrEqualTo(expectedAmount)) {
    return "PAID";
  }

  if (paidAmount.greaterThan(0)) {
    return "PARTIALLY_PAID";
  }

  if (startOfDay(input.dueDate).getTime() < startOfDay(asOf).getTime()) {
    return "OVERDUE";
  }

  return "OPEN";
}

export function calculateRemainingAmount(
  expectedAmount: Prisma.Decimal | number | string,
  paidAmount: Prisma.Decimal | number | string
): Prisma.Decimal {
  const remaining = toDecimal(expectedAmount).minus(toDecimal(paidAmount));
  return remaining.lessThan(0) ? new Prisma.Decimal(0) : remaining;
}

export function assertPaymentWithinRemaining(
  paymentAmount: Prisma.Decimal | number | string,
  remainingAmount: Prisma.Decimal | number | string
): void {
  if (toDecimal(paymentAmount).greaterThan(toDecimal(remainingAmount))) {
    throw new Error("PAYMENT_EXCEEDS_REMAINING");
  }
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
