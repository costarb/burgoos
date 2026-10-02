import { Inject, Injectable } from "@nestjs/common";
import { DreExpenseClass, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { toMoneyString } from "../financial/money";
import { calculateDreSummary } from "./dre-calculator";
import { parseCompetence } from "./dre-competence";

interface ExpenseRow {
  categoryId: string;
  categoryName: string;
  dreClass: DreExpenseClass;
  amount: Prisma.Decimal;
  count: bigint | number;
}

@Injectable()
export class DreService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * DRE of one competence month: delivered-order snapshots of the month (store time zone) plus
   * the payables launched for that competence (or due in it, without competence), by DRE class.
   */
  async getMonthlySummary(tenantId: string, competenceValue?: string, now = new Date()) {
    const competence = parseCompetence(competenceValue, now);
    const [configuration, snapshots, expenses] = await Promise.all([
      this.prisma.financialConfiguration.upsert({
        where: { tenantId },
        update: {},
        create: { tenantId },
      }),
      this.prisma.orderProfitabilitySnapshot.findMany({
        where: {
          tenantId,
          createdAt: { gte: competence.salesStart, lte: competence.salesEnd },
          order: { status: OrderStatus.DELIVERED, deletedAt: null },
        },
        include: { order: { select: { paymentNetAmount: true } } },
      }),
      this.prisma.$queryRaw<ExpenseRow[]>(Prisma.sql`
        SELECT c.id::text AS "categoryId", c.name AS "categoryName",
               COALESCE(p.dre_class_override, c.dre_class) AS "dreClass",
               COALESCE(SUM(p.expected_amount), 0) AS amount,
               COUNT(*) AS count
        FROM payables p
        JOIN financial_categories c ON c.id = p.category_id
        WHERE p.tenant_id = ${tenantId}::uuid
          AND p.cancelled_at IS NULL
          AND COALESCE(p.competence_date, p.due_date) >= ${competence.expenseStart}
          AND COALESCE(p.competence_date, p.due_date) < ${competence.expenseEnd}
          AND COALESCE(p.dre_class_override, c.dre_class) <> 'EXCLUDED'
        GROUP BY c.id, c.name, COALESCE(p.dre_class_override, c.dre_class)
        ORDER BY amount DESC`),
    ]);

    const sumOf = (dreClass: DreExpenseClass) =>
      expenses
        .filter((row) => row.dreClass === dreClass)
        .reduce((total, row) => total.add(new Prisma.Decimal(row.amount)), new Prisma.Decimal(0));

    const summary = calculateDreSummary({
      snapshots,
      variableExpenses: sumOf(DreExpenseClass.VARIABLE_EXPENSE),
      fixedExpenses: sumOf(DreExpenseClass.FIXED_COST),
      plannedFixedCost: configuration.monthlyFixedCost,
    });
    const acquiredNetRevenue = snapshots.reduce(
      (total, snapshot) => total.add(snapshot.order.paymentNetAmount ?? snapshot.grossRevenue),
      new Prisma.Decimal(0)
    );

    return {
      competence: competence.competence,
      periodStart: competence.firstDay,
      periodEnd: competence.lastDay,
      grossRevenue: toMoneyString(summary.grossRevenue),
      discounts: toMoneyString(summary.discounts),
      netRevenue: toMoneyString(summary.netRevenue),
      acquiredNetRevenue: toMoneyString(acquiredNetRevenue),
      cmv: toMoneyString(summary.cmv),
      feesAndTaxes: toMoneyString(summary.feesAndTaxes),
      grossProfit: toMoneyString(summary.grossProfit),
      contributionMarginRate: summary.contributionMarginRate.toDecimalPlaces(4).toNumber(),
      variableExpenses: toMoneyString(summary.variableExpenses),
      fixedExpenses: toMoneyString(summary.fixedExpenses),
      estimatedNetProfit: toMoneyString(summary.estimatedNetProfit),
      netMarginRate: summary.netMarginRate.toDecimalPlaces(4).toNumber(),
      breakEvenRevenue: summary.breakEvenRevenue ? toMoneyString(summary.breakEvenRevenue) : null,
      plannedFixedCost: toMoneyString(summary.plannedFixedCost),
      fixedCostVariance: toMoneyString(summary.fixedCostVariance),
      expensesByCategory: expenses.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        dreClass: row.dreClass as Exclude<DreExpenseClass, "EXCLUDED">,
        amount: toMoneyString(new Prisma.Decimal(row.amount)),
        count: Number(row.count),
      })),
    };
  }
}
