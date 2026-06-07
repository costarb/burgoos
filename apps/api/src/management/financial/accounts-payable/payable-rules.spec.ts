import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculatePayableStatus, calculateRemainingAmount } from "./payable-rules";

describe("payable rules", () => {
  const asOf = new Date(2026, 5, 5);

  it("marks cancelled payables before any financial status", () => {
    expect(
      calculatePayableStatus(
        {
          expectedAmount: new Prisma.Decimal(100),
          paidAmount: new Prisma.Decimal(100),
          dueDate: new Date(2026, 5, 1),
          cancelledAt: new Date(2026, 5, 2),
        },
        asOf
      )
    ).toBe("CANCELLED");
  });

  it("marks paid and partially paid payables", () => {
    expect(
      calculatePayableStatus(
        { expectedAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(100), dueDate: new Date(2026, 5, 10) },
        asOf
      )
    ).toBe("PAID");

    expect(
      calculatePayableStatus(
        { expectedAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(25), dueDate: new Date(2026, 5, 10) },
        asOf
      )
    ).toBe("PARTIALLY_PAID");
  });

  it("marks unpaid payables as overdue only after the due date", () => {
    expect(
      calculatePayableStatus(
        { expectedAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(0), dueDate: new Date(2026, 5, 4) },
        asOf
      )
    ).toBe("OVERDUE");

    expect(
      calculatePayableStatus(
        { expectedAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(0), dueDate: new Date(2026, 5, 5) },
        asOf
      )
    ).toBe("OPEN");
  });

  it("never returns negative remaining amount", () => {
    expect(calculateRemainingAmount(new Prisma.Decimal(100), new Prisma.Decimal(125)).toFixed(2)).toBe("0.00");
  });
});
