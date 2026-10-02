import { BadRequestException } from "@nestjs/common";
import { DreExpenseClass, OrderStatus, Prisma, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../src/platform/database/prisma.service";
import { AuthUser } from "../src/platform/auth/auth.types";
import { DreService } from "../src/management/reports/dre.service";
import { FinancialDashboardService } from "../src/management/reports/financial-dashboard.service";
import { FinancialReportsController } from "../src/management/reports/financial-reports.controller";

const tenantId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-10-02T12:00:00.000Z");

describe("DRE by competence", () => {
  const prismaMock = {
    financialConfiguration: { upsert: vi.fn() },
    orderProfitabilitySnapshot: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  let service: DreService;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.financialConfiguration.upsert.mockResolvedValue({
      tenantId,
      monthlyFixedCost: decimal("5000.00"),
      taxRate: decimal("0.06"),
    });
    prismaMock.orderProfitabilitySnapshot.findMany.mockResolvedValue([
      {
        orderId: "order-1",
        grossRevenue: decimal("15000.00"),
        discount: decimal("300.00"),
        netRevenue: decimal("14700.00"),
        cmv: decimal("4410.00"),
        platformFee: decimal("900.00"),
        taxAmount: decimal("420.00"),
        paymentFee: decimal("150.00"),
        grossProfit: decimal("8820.00"),
        order: { paymentNetAmount: decimal("14100.00") },
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValue([
      expenseRow("Aluguel", DreExpenseClass.FIXED_COST, "3000.00", 1),
      expenseRow("Prestador de Servico", DreExpenseClass.VARIABLE_EXPENSE, "500.00", 2),
    ]);
    service = new DreService(prismaMock as unknown as PrismaService);
  });

  it("uses the competence month for sales (store time zone) and launched expenses", async () => {
    const summary = await service.getMonthlySummary(tenantId, "2026-09", now);

    expect(prismaMock.orderProfitabilitySnapshot.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        createdAt: {
          gte: new Date("2026-09-01T03:00:00.000Z"),
          lte: new Date("2026-10-01T02:59:59.999Z"),
        },
        order: { status: OrderStatus.DELIVERED, deletedAt: null },
      },
      include: { order: { select: { paymentGrossAmount: true, paymentNetAmount: true } } },
    });

    const sql = prismaMock.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain("COALESCE(p.competence_date, p.due_date)");
    expect(sql.sql).toContain("COALESCE(p.dre_class_override, c.dre_class)");
    expect(sql.sql).toContain("p.cancelled_at IS NULL");
    expect(sql.sql).toContain("<> 'EXCLUDED'");
    expect(sql.values).toEqual([tenantId, new Date(2026, 8, 1), new Date(2026, 9, 1)]);

    expect(summary).toMatchObject({
      competence: "2026-09",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      grossRevenue: "15000.00",
      netRevenue: "14700.00",
      acquiredNetRevenue: "14100.00",
      feesAndTaxes: "1470.00",
      salesFees: "1050.00",
      taxes: "420.00",
      taxRate: 0.06,
      realSalesFees: "0.00",
      estimatedSalesFees: "1050.00",
      realFeeOrderCount: 0,
      estimatedFeeOrderCount: 1,
      grossProfit: "8820.00",
      contributionMarginRate: 0.6,
      variableExpenses: "500.00",
      fixedExpenses: "3000.00",
      estimatedNetProfit: "5320.00",
      netMarginRate: 0.3619,
      breakEvenRevenue: "5300.48",
      plannedFixedCost: "5000.00",
      fixedCostVariance: "-2000.00",
      expensesByCategory: [
        { categoryName: "Aluguel", dreClass: "FIXED_COST", amount: "3000.00", count: 1 },
        { categoryName: "Prestador de Servico", dreClass: "VARIABLE_EXPENSE", amount: "500.00", count: 2 },
      ],
    });
  });

  it("uses gross - net of imported orders as their sales fee and keeps taxes estimated", async () => {
    prismaMock.orderProfitabilitySnapshot.findMany.mockResolvedValue([
      {
        orderId: "imported",
        grossRevenue: decimal("139.00"),
        discount: decimal("0.00"),
        netRevenue: decimal("139.00"),
        cmv: decimal("40.00"),
        platformFee: decimal("0.00"),
        taxAmount: decimal("8.34"),
        paymentFee: decimal("0.00"),
        grossProfit: decimal("90.66"),
        order: { paymentGrossAmount: decimal("139.00"), paymentNetAmount: decimal("134.69") },
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValue([]);

    const summary = await service.getMonthlySummary(tenantId, "2026-09", now);

    expect(summary).toMatchObject({
      salesFees: "4.31",
      realSalesFees: "4.31",
      estimatedSalesFees: "0.00",
      realFeeOrderCount: 1,
      estimatedFeeOrderCount: 0,
      taxes: "8.34",
      feesAndTaxes: "12.65",
      grossProfit: "86.35",
      acquiredNetRevenue: "134.69",
    });
  });

  it("does not subtract the planned fixed cost when nothing was launched", async () => {
    prismaMock.orderProfitabilitySnapshot.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([]);

    const summary = await service.getMonthlySummary(tenantId, "2026-08", now);

    expect(summary).toMatchObject({
      competence: "2026-08",
      periodEnd: "2026-08-31",
      fixedExpenses: "0.00",
      estimatedNetProfit: "0.00",
      breakEvenRevenue: null,
      plannedFixedCost: "5000.00",
      fixedCostVariance: "-5000.00",
      expensesByCategory: [],
    });
  });

  it("defaults to the current month in the store time zone and rejects invalid competences", async () => {
    const summary = await service.getMonthlySummary(tenantId, undefined, new Date("2026-10-01T01:00:00.000Z"));
    expect(summary.competence).toBe("2026-09");

    await expect(service.getMonthlySummary(tenantId, "2026-13", now)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("routes the competence query (and legacy start) from the controller", () => {
    const dre = { getMonthlySummary: vi.fn() };
    const controller = new FinancialReportsController(
      dre as unknown as DreService,
      {} as FinancialDashboardService
    );
    const user = { tenantId, role: UserRole.OWNER } as AuthUser;

    controller.getDre(user, "2026-07");
    controller.getDre(user, undefined, "2026-05-01");
    controller.getDre(user);

    expect(dre.getMonthlySummary.mock.calls).toEqual([
      [tenantId, "2026-07"],
      [tenantId, "2026-05"],
      [tenantId, undefined],
    ]);
  });

  function expenseRow(name: string, dreClass: DreExpenseClass, amount: string, count: number) {
    return { categoryId: `id-${name}`, categoryName: name, dreClass, amount: decimal(amount), count: BigInt(count) };
  }

  function decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }
});
