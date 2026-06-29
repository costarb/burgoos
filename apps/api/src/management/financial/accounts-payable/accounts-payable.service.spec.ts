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
});

function createPrismaMock(payables: ReturnType<typeof payable>[]) {
  return {
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
    payments: [],
  };
}
