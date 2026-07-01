import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ManagementReportService } from "./management-report.service";
import { parseManagementReportQuery } from "./management-report.types";

describe("ManagementReportService", () => {
  it("maps cash, sales and payables source totals into a consolidated report", async () => {
    const service = new ManagementReportService(
      cashFlowMock() as never,
      salesReportMock() as never,
      accountsPayableMock() as never
    );

    const report = await service.getReport("tenant-1", parseManagementReportQuery(period()));

    expect(report.period).toEqual({ start: "2026-06-01", end: "2026-06-30" });
    expect(report.executiveSummary).toEqual(
      expect.objectContaining({
        grossRevenue: "1000.00",
        netRevenue: "920.00",
        cashNet: "600.00",
        finalBalance: "1600.00",
        payablesOpen: "300.00",
        payablesOverdue: "100.00",
        receivableAmount: "120.00",
      })
    );
    expect(report.cashFlow.balancesByAccount).toEqual([
      { accountId: "account-1", accountName: "Caixa", balance: "1600.00" },
    ]);
    expect(report.sales.daily[0]).toEqual({
      date: "2026-06-01",
      orders: 2,
      grossRevenue: "1000.00",
      netRevenue: "920.00",
    });
    expect(report.sales.byInstitution[0]).toEqual(
      expect.objectContaining({
        key: "MERCADO_PAGO",
        label: "Mercado Pago",
        orders: 2,
      })
    );
    expect(report.payables).toEqual(
      expect.objectContaining({
        expected: "500.00",
        paid: "200.00",
        open: "300.00",
        overdue: "100.00",
        openCount: 2,
        overdueCount: 1,
      })
    );
  });

  it("groups payable expenses by category and calculates share of expected amount", async () => {
    const service = new ManagementReportService(
      cashFlowMock() as never,
      salesReportMock() as never,
      accountsPayableMock() as never
    );

    const report = await service.getReport("tenant-1", parseManagementReportQuery(period()));

    expect(report.payables.byCategory).toEqual([
      {
        categoryId: "category-tax",
        categoryName: "Taxas",
        expected: "300.00",
        paid: "200.00",
        open: "100.00",
        overdue: "100.00",
        shareOfExpected: 0.6,
      },
      {
        categoryId: "category-rent",
        categoryName: "Aluguel",
        expected: "200.00",
        paid: "0.00",
        open: "200.00",
        overdue: "0.00",
        shareOfExpected: 0.4,
      },
    ]);
  });

  it("rejects invalid periods", () => {
    expect(() => parseManagementReportQuery({ start: "2026-06-30", end: "2026-06-01" })).toThrow(
      BadRequestException
    );
  });
});

function period() {
  return { start: "2026-06-01", end: "2026-06-30" };
}

function cashFlowMock() {
  return {
    getStatement: vi.fn().mockResolvedValue({
      start: "2026-06-01",
      end: "2026-06-30",
      financialAccountId: null,
      openingBalance: "1000.00",
      closingBalance: "1600.00",
      totalCredit: "800.00",
      totalDebit: "200.00",
      netAmount: "600.00",
      days: [],
    }),
    getPosition: vi.fn().mockResolvedValue({
      accounts: [
        {
          financialAccountId: "account-1",
          financialAccountName: "Caixa",
          balance: "1600.00",
        },
      ],
    }),
  };
}

function salesReportMock() {
  return {
    getReport: vi.fn().mockResolvedValue({
      summary: {
        orderCount: 2,
        grossRevenue: "1000.00",
        acquiredNetRevenue: "920.00",
        releasedNetRevenue: "800.00",
        receivableNetAmount: "120.00",
        paymentFeeAmount: "80.00",
        averageTicket: "500.00",
      },
      daily: [
        {
          date: "2026-06-01",
          orderCount: 2,
          grossRevenue: "1000.00",
          acquiredNetRevenue: "920.00",
        },
      ],
      byPaymentInstitution: [
        {
          dimensionKey: "MERCADO_PAGO",
          dimensionLabel: "Mercado Pago",
          orderCount: 2,
          grossRevenue: "1000.00",
          acquiredNetRevenue: "920.00",
          shareOfGrossRevenue: 1,
        },
      ],
      byPaymentMethod: [
        {
          dimensionKey: "PIX",
          dimensionLabel: "Pix",
          orderCount: 2,
          grossRevenue: "1000.00",
          acquiredNetRevenue: "920.00",
          shareOfGrossRevenue: 1,
        },
      ],
      byChannel: [
        {
          orderPlatformId: "channel-1",
          orderPlatformName: "Balcao",
          orderCount: 2,
          grossRevenue: "1000.00",
          acquiredNetRevenue: "920.00",
        },
      ],
    }),
  };
}

function accountsPayableMock() {
  return {
    list: vi.fn().mockResolvedValue({
      summary: {
        totalExpected: "500.00",
        totalPaid: "200.00",
        totalRemaining: "300.00",
        overdueAmount: "100.00",
        openCount: 2,
        overdueCount: 1,
      },
      items: [
        payable({
          categoryId: "category-tax",
          categoryName: "Taxas",
          expectedAmount: "300.00",
          paidAmount: "200.00",
          remainingAmount: "100.00",
          status: "OVERDUE",
        }),
        payable({
          categoryId: "category-rent",
          categoryName: "Aluguel",
          expectedAmount: "200.00",
          paidAmount: "0.00",
          remainingAmount: "200.00",
          status: "OPEN",
        }),
        payable({
          categoryId: "category-cancelled",
          categoryName: "Canceladas",
          expectedAmount: "900.00",
          paidAmount: "0.00",
          remainingAmount: "900.00",
          status: "CANCELLED",
          cancelledAt: "2026-06-10T00:00:00.000Z",
        }),
      ],
    }),
  };
}

function payable(overrides: Record<string, unknown>) {
  return {
    id: "payable-1",
    categoryId: "category-tax",
    categoryName: "Taxas",
    supplierId: null,
    supplierName: null,
    recurrenceGroupId: null,
    description: "Despesa",
    documentReference: null,
    competenceDate: "2026-06-01",
    dueDate: "2026-06-30",
    expectedAmount: "300.00",
    paidAmount: "200.00",
    remainingAmount: "100.00",
    status: "OPEN",
    notes: null,
    cancelledAt: null,
    cancellationReason: null,
    payments: [],
    ...overrides,
  };
}
