import { CashMovementType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CashFlowService } from "./cash-flow.service";

describe("CashFlowService", () => {
  it("debits payable payments from the selected financial account balance", async () => {
    const prismaMock = {
      financialAccount: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "account-1",
            name: "Caixa Local",
            paymentInstitution: "CAIXA_LOCAL",
            openingBalance: new Prisma.Decimal(1000),
            openingBalanceAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ]),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payable: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payablePayment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "payment-1",
            financialAccountId: "account-1",
            amount: new Prisma.Decimal(250),
            paidAt: new Date("2026-06-06T00:00:00.000Z"),
            payable: { description: "Prestador de servico" },
            financialAccount: { name: "Caixa Local" },
          },
        ]),
      },
      cashMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      financialAudit: {
        findMany: vi.fn(),
      },
    };

    const service = new CashFlowService(prismaMock as never);

    const position = await service.getPosition(
      "tenant-1",
      new Date("2026-06-06T23:59:59.999Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    expect(position.currentBalance).toBe("750.00");
    expect(position.accounts).toEqual([
      {
        financialAccountId: "account-1",
        financialAccountName: "Caixa Local",
        balance: "750.00",
        unallocated: false,
      },
    ]);
    expect(position.ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "PAYABLE_PAYMENT",
          sourceId: "payment-1",
          financialAccountId: "account-1",
          financialAccountName: "Caixa Local",
          outflowAmount: "250.00",
          runningBalance: "750.00",
        }),
      ])
    );
  });

  it("groups cash statement by date and respects optional account filters", async () => {
    const prismaMock = {
      financialAccount: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "account-1",
              name: "Caixa Local",
              paymentInstitution: "CAIXA_LOCAL",
              openingBalance: new Prisma.Decimal(100),
              openingBalanceAt: new Date("2026-06-01T00:00:00.000Z"),
            },
            {
              id: "account-2",
              name: "Dinheiro",
              paymentInstitution: "DINHEIRO",
              openingBalance: new Prisma.Decimal(0),
              openingBalanceAt: new Date("2026-06-01T00:00:00.000Z"),
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "account-1",
              name: "Caixa Local",
              paymentInstitution: "CAIXA_LOCAL",
              openingBalance: new Prisma.Decimal(100),
              openingBalanceAt: new Date("2026-06-01T00:00:00.000Z"),
            },
          ]),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payable: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payablePayment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cashMovement: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "transfer-1",
            type: CashMovementType.TRANSFER,
            financialAccountId: "account-1",
            destinationAccountId: "account-2",
            amount: new Prisma.Decimal(30),
            occurredAt: new Date("2026-06-06T12:00:00.000Z"),
            description: "Transferencia para dinheiro",
            financialAccount: { name: "Caixa Local" },
            destinationAccount: { name: "Dinheiro" },
          },
        ]),
      },
      financialAudit: {
        findMany: vi.fn(),
      },
    };

    const service = new CashFlowService(prismaMock as never);
    const consolidated = await service.getStatement(
      "tenant-1",
      new Date("2026-06-05T00:00:00.000Z"),
      new Date("2026-06-06T23:59:59.999Z")
    );
    const accountStatement = await service.getStatement(
      "tenant-1",
      new Date("2026-06-05T00:00:00.000Z"),
      new Date("2026-06-06T23:59:59.999Z"),
      "account-1"
    );

    expect(consolidated).toMatchObject({
      openingBalance: "100.00",
      totalCredit: "30.00",
      totalDebit: "30.00",
      netAmount: "0.00",
      closingBalance: "100.00",
    });
    expect(consolidated.days[0]).toMatchObject({
      date: "2026-06-06",
      creditAmount: "30.00",
      debitAmount: "30.00",
      runningBalance: "100.00",
    });
    expect(accountStatement).toMatchObject({
      financialAccountId: "account-1",
      openingBalance: "100.00",
      totalCredit: "0.00",
      totalDebit: "30.00",
      netAmount: "-30.00",
      closingBalance: "70.00",
    });
    expect(accountStatement.days[0].entries).toEqual([
      expect.objectContaining({
        entryType: "DEBIT",
        amount: "30.00",
        financialAccountId: "account-1",
      }),
    ]);
  });

  it("preserves provider release dates that do not contain a time", async () => {
    const prismaMock = {
      financialAccount: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "account-pagbank",
            name: "PagBank",
            paymentInstitution: null,
            paymentInstitutionId: "institution-pagbank",
            openingBalance: new Prisma.Decimal(0),
            openingBalanceAt: new Date("2026-07-01T00:00:00.000Z"),
          },
        ]),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "order-pagbank",
            status: "DELIVERED",
            customerName: "Venda PagBank",
            total: new Prisma.Decimal(100),
            paymentInstitution: null,
            paymentInstitutionId: "institution-pagbank",
            paymentGrossAmount: new Prisma.Decimal(100),
            paymentNetAmount: new Prisma.Decimal(97),
            paymentReleaseExpectedAt: new Date("2026-07-21T00:00:00.000Z"),
            createdAt: new Date("2026-07-22T01:00:00.000Z"),
            deletedAt: null,
          },
        ]),
      },
      payable: { findMany: vi.fn().mockResolvedValue([]) },
      payablePayment: { findMany: vi.fn().mockResolvedValue([]) },
      cashMovement: { findMany: vi.fn().mockResolvedValue([]) },
      financialAudit: { findMany: vi.fn() },
    };

    const service = new CashFlowService(prismaMock as never);
    const statement = await service.getStatement(
      "tenant-1",
      new Date("2026-07-21T00:00:00.000Z"),
      new Date("2026-07-21T23:59:59.999Z")
    );

    expect(statement.days).toEqual([
      expect.objectContaining({
        date: "2026-07-21",
        creditAmount: "97.00",
      }),
    ]);
  });

  it("keeps open payables due today in the cash projection until they are paid", async () => {
    const prismaMock = {
      financialAccount: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "account-1",
            name: "Caixa Local",
            paymentInstitution: "CAIXA_LOCAL",
            openingBalance: new Prisma.Decimal(100),
            openingBalanceAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ]),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      payable: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "payable-1",
            description: "Compra de insumos",
            expectedAmount: new Prisma.Decimal(120),
            dueDate: new Date("2026-06-07T10:00:00.000Z"),
            category: { name: "Insumos" },
            supplier: null,
            payments: [],
          },
        ]),
      },
      payablePayment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cashMovement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      financialAudit: {
        findMany: vi.fn(),
      },
    };

    const service = new CashFlowService(prismaMock as never);

    const position = await service.getPosition(
      "tenant-1",
      new Date("2026-06-07T23:59:59.999Z"),
      new Date("2026-06-30T23:59:59.999Z")
    );

    expect(position.payableAmount).toBe("120.00");
    expect(position.projectedBalance).toBe("-20.00");
    expect(position.projection).toEqual([
      expect.objectContaining({
        sourceType: "PAYABLE",
        sourceId: "payable-1",
        occurredAt: "2026-06-07",
        outflowAmount: "120.00",
      }),
    ]);
    expect(position.timeline).toEqual([
      expect.objectContaining({
        date: "2026-06-07",
        outflowAmount: "120.00",
        netAmount: "-120.00",
      }),
    ]);
  });
});
