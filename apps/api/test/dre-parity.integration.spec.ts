import { DreExpenseClass, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinancialTools } from "../src/management/mcp/tools/financial.tools";
import { DreService } from "../src/management/reports/dre.service";
import { FinancialDashboardService } from "../src/management/reports/financial-dashboard.service";
import { PrismaService } from "../src/platform/database/prisma.service";

const tenantId = "11111111-1111-4111-8111-111111111111";

describe("DRE parity (screen x dashboard x MCP)", () => {
  const prisma = {
    financialConfiguration: { upsert: vi.fn(async () => ({ tenantId, monthlyFixedCost: decimal("5000.00") })) },
    orderProfitabilitySnapshot: {
      findMany: vi.fn(async () => [
        {
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
      ]),
    },
    $queryRaw: vi.fn(async () => [
      { categoryId: "c1", categoryName: "Aluguel", dreClass: DreExpenseClass.FIXED_COST, amount: decimal("3000.00"), count: 1n },
      {
        categoryId: "c2",
        categoryName: "Prestador",
        dreClass: DreExpenseClass.VARIABLE_EXPENSE,
        amount: decimal("500.00"),
        count: 2n,
      },
    ]),
    productCostSnapshot: { count: vi.fn(async () => 0) },
    ingredient: { findMany: vi.fn(async () => []) },
    order: { count: vi.fn(async () => 1) },
  };
  let dre: DreService;
  let dashboard: FinancialDashboardService;
  let tools: FinancialTools;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
    dre = new DreService(prisma as unknown as PrismaService);
    dashboard = new FinancialDashboardService(prisma as unknown as PrismaService, dre);
    tools = new FinancialTools(dre, dashboard);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the same current-month result everywhere", async () => {
    const screen = await dre.getMonthlySummary(tenantId);
    const indicators = await dashboard.getIndicators(tenantId);
    const dreTool = tools.definitions().find((tool) => tool.name === "dre")!;
    const mcp = (await dreTool.handler({ tenantId } as never, {})) as Record<string, unknown>;

    expect(screen.competence).toBe("2026-10");
    expect(indicators).toMatchObject({
      periodStart: screen.periodStart,
      periodEnd: screen.periodEnd,
      grossRevenue: screen.grossRevenue,
      grossProfit: screen.grossProfit,
      variableExpenses: screen.variableExpenses,
      fixedExpenses: screen.fixedExpenses,
      estimatedNetProfit: screen.estimatedNetProfit,
      netMarginRate: screen.netMarginRate,
    });
    expect(mcp).toMatchObject({
      mesCompetencia: screen.competence,
      receitaBrutaReais: Number(screen.grossRevenue),
      despesasVariaveisReais: Number(screen.variableExpenses),
      custosFixosReais: Number(screen.fixedExpenses),
      lucroLiquidoEstimadoReais: Number(screen.estimatedNetProfit),
      pontoEquilibrioReais: Number(screen.breakEvenRevenue),
      custoFixoPrevistoReais: Number(screen.plannedFixedCost),
      diferencaCustoFixoReais: Number(screen.fixedCostVariance),
    });
    expect(screen.estimatedNetProfit).toBe("5320.00");
  });
});

function decimal(value: string) {
  return new Prisma.Decimal(value);
}
