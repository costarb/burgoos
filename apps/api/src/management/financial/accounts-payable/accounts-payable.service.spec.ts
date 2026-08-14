import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AccountsPayableService } from "./accounts-payable.service";

describe("AccountsPayableService", () => {
  it("filters payables by categoryId and recalculates summary from returned items", async () => {
    const prismaMock = createPrismaMock([
      payable({ id: "payable-1", categoryId: "category-food" }),
    ]);
    const service = new AccountsPayableService(prismaMock as never, createAuditMock());

    const response = await service.list("tenant-1", { categoryId: "category-food" });

    expect(prismaMock.payable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          categoryId: "category-food",
        }),
      })
    );
    expect(response.items).toHaveLength(1);
    expect(response.summary.totalExpected).toBe("120.00");
    expect(response.summary.totalRemaining).toBe("120.00");
  });

  it("filters payables by supplierId and excludes other suppliers at query level", async () => {
    const prismaMock = createPrismaMock([payable({ id: "payable-2", supplierId: "supplier-1" })]);
    const service = new AccountsPayableService(prismaMock as never, createAuditMock());

    const response = await service.list("tenant-1", { supplierId: "supplier-1" });

    expect(prismaMock.payable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          supplierId: "supplier-1",
        }),
      })
    );
    expect(response.items).toEqual([
      expect.objectContaining({
        id: "payable-2",
        supplierId: "supplier-1",
      }),
    ]);
  });

  it("filters payables by competenceMonth using a monthly competenceDate range", async () => {
    const prismaMock = createPrismaMock([
      payable({
        id: "payable-3",
        competenceDate: new Date(2026, 5, 15),
      }),
    ]);
    const service = new AccountsPayableService(prismaMock as never, createAuditMock());

    const response = await service.list("tenant-1", { competenceMonth: "2026-06" });

    expect(prismaMock.payable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          competenceDate: {
            gte: new Date(2026, 5, 1),
            lt: new Date(2026, 6, 1),
          },
        }),
      })
    );
    expect(response.items[0]).toMatchObject({
      id: "payable-3",
      competenceDate: "2026-06-15",
    });
  });

  it("summarizes expected, paid, remaining and overdue values from the returned items", async () => {
    const prismaMock = createPrismaMock([
      payable({
        id: "payable-paid",
        dueDate: new Date(2020, 0, 10),
        expectedAmount: new Prisma.Decimal(100),
        payments: [
          payment({
            id: "payment-paid",
            amount: new Prisma.Decimal(100),
          }),
        ],
      }),
      payable({
        id: "payable-overdue",
        dueDate: new Date(2020, 0, 11),
        expectedAmount: new Prisma.Decimal(120),
      }),
      payable({
        id: "payable-cancelled",
        dueDate: new Date(2020, 0, 12),
        expectedAmount: new Prisma.Decimal(80),
        cancelledAt: new Date(2020, 0, 1) as never,
      }),
    ]);
    const service = new AccountsPayableService(prismaMock as never, createAuditMock());

    const response = await service.list("tenant-1", {});

    expect(response.summary).toEqual({
      totalExpected: "220.00",
      totalPaid: "100.00",
      totalRemaining: "120.00",
      overdueAmount: "120.00",
      openCount: 1,
      overdueCount: 1,
    });
  });
});

function createPrismaMock(payables: ReturnType<typeof payable>[]) {
  const items = payables.map((item) => {
    const paid = item.payments.filter((payment) => !payment.reversedAt)
      .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    return { item, paid };
  });
  const active = items.filter(({ item }) => !item.cancelledAt);
  const overdue = active.filter(({ item, paid }) => item.dueDate < new Date() && paid.lessThan(item.expectedAmount));
  return {
    $queryRaw: vi.fn().mockResolvedValue([{
      total: BigInt(payables.length),
      totalExpected: active.reduce((sum, { item }) => sum.plus(item.expectedAmount), new Prisma.Decimal(0)),
      totalPaid: active.reduce((sum, { paid }) => sum.plus(paid), new Prisma.Decimal(0)),
      totalRemaining: active.reduce((sum, { item, paid }) => sum.plus(item.expectedAmount.minus(paid)), new Prisma.Decimal(0)),
      overdueAmount: overdue.reduce((sum, { item, paid }) => sum.plus(item.expectedAmount.minus(paid)), new Prisma.Decimal(0)),
      openCount: BigInt(active.filter(({ item, paid }) => paid.lessThan(item.expectedAmount)).length),
      overdueCount: BigInt(overdue.length),
    }]),
    payable: {
      findMany: vi.fn().mockResolvedValue(payables),
    },
  };
}

function createAuditMock() {
  return {
    record: vi.fn(),
  } as never;
}

function payable(overrides: Partial<ReturnType<typeof basePayable>> = {}) {
  return {
    ...basePayable(),
    ...overrides,
    category: {
      ...basePayable().category,
      id: overrides.categoryId ?? basePayable().categoryId,
    },
    supplier:
      overrides.supplierId === null
        ? null
        : {
            id: overrides.supplierId ?? basePayable().supplierId,
            name: "Fornecedor Padrao",
          },
  };
}

function basePayable() {
  return {
    id: "payable-1",
    tenantId: "tenant-1",
    categoryId: "category-1",
    supplierId: "supplier-1",
    recurrenceGroupId: null,
    description: "Compra de insumos",
    documentReference: null,
    competenceDate: new Date(2026, 5, 1),
    dueDate: new Date(2026, 5, 10),
    expectedAmount: new Prisma.Decimal(120),
    notes: null,
    cancelledAt: null,
    cancellationReason: null,
    createdByUserId: "user-1",
    createdAt: new Date(2026, 5, 1),
    updatedAt: new Date(2026, 5, 1),
    category: {
      id: "category-1",
      name: "Insumos",
    },
    supplier: {
      id: "supplier-1",
      name: "Fornecedor Padrao",
    },
    payments: [] as ReturnType<typeof basePayment>[],
  };
}

function payment(overrides: Partial<ReturnType<typeof basePayment>> = {}) {
  return { ...basePayment(), ...overrides };
}

function basePayment() {
  return {
    id: "payment-1",
    tenantId: "tenant-1",
    payableId: "payable-1",
    financialAccountId: "account-1",
    amount: new Prisma.Decimal(50),
    paidAt: new Date(2026, 5, 10),
    notes: null,
    reversedAt: null,
    reversalReason: null,
    createdByUserId: "user-1",
    reversedByUserId: null,
    createdAt: new Date(2026, 5, 10),
    updatedAt: new Date(2026, 5, 10),
    financialAccount: {
      id: "account-1",
      name: "Caixa",
    },
  };
}
