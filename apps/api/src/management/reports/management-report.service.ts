import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AccountsPayableService } from "../financial/accounts-payable/accounts-payable.service";
import { CashFlowService } from "../financial/cash-flow/cash-flow.service";
import { ParsedManagementReportQuery } from "./management-report.types";
import { SalesReportService } from "./sales-report.service";

@Injectable()
export class ManagementReportService {
  constructor(
    @Inject(CashFlowService) private readonly cashFlowService: CashFlowService,
    @Inject(SalesReportService) private readonly salesReportService: SalesReportService,
    @Inject(AccountsPayableService)
    private readonly accountsPayableService: AccountsPayableService
  ) {}

  async getReport(tenantId: string, query: ParsedManagementReportQuery) {
    const [cashStatement, cashPosition] = await Promise.all([
      this.cashFlowService.getStatement(tenantId, query.periodStart, query.periodEnd),
      this.cashFlowService.getPosition(tenantId, query.periodEnd, query.periodEnd),
    ]);
    const salesReport = await this.salesReportService.getReport(tenantId, {
        start: query.start,
        end: query.end,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
        page: 1,
        pageSize: 50,
      });
    const [payables, payableCategories] = await Promise.all([
      this.accountsPayableService.list(tenantId, {
        start: query.start,
        end: query.end,
        page: 1,
        pageSize: 1,
      }),
      this.accountsPayableService.summarizeByCategory(tenantId, {
        start: query.start,
        end: query.end,
      }),
    ]);

    const totalExpected = new Prisma.Decimal(payables.summary.totalExpected);
    const payablesByCategory = payableCategories.map((category) => ({
      ...category,
      shareOfExpected: totalExpected.isZero()
        ? 0
        : new Prisma.Decimal(category.expected).div(totalExpected).toDecimalPlaces(4).toNumber(),
    }));

    return {
      period: {
        start: query.start,
        end: query.end,
      },
      executiveSummary: {
        grossRevenue: salesReport.summary.grossRevenue,
        netRevenue: salesReport.summary.acquiredNetRevenue,
        cashNet: cashStatement.netAmount,
        finalBalance: cashStatement.closingBalance,
        payablesOpen: payables.summary.totalRemaining,
        payablesOverdue: payables.summary.overdueAmount,
        receivableAmount: salesReport.summary.receivableNetAmount,
        periodNarrative: buildNarrative({
          start: query.start,
          end: query.end,
          netRevenue: salesReport.summary.acquiredNetRevenue,
          cashNet: cashStatement.netAmount,
          payablesOpen: payables.summary.totalRemaining,
        }),
      },
      cashFlow: {
        credits: cashStatement.totalCredit,
        debits: cashStatement.totalDebit,
        net: cashStatement.netAmount,
        finalBalance: cashStatement.closingBalance,
        balancesByAccount: cashPosition.accounts.map((account) => ({
          accountId: account.financialAccountId,
          accountName: account.financialAccountName,
          balance: account.balance,
        })),
      },
      sales: {
        orders: salesReport.summary.orderCount,
        grossRevenue: salesReport.summary.grossRevenue,
        netRevenue: salesReport.summary.acquiredNetRevenue,
        releasedAmount: salesReport.summary.releasedNetRevenue,
        receivableAmount: salesReport.summary.receivableNetAmount,
        feeAmount: salesReport.summary.paymentFeeAmount,
        averageTicket: salesReport.summary.averageTicket,
        daily: salesReport.daily.map((day) => ({
          date: day.date,
          orders: day.orderCount,
          grossRevenue: day.grossRevenue,
          netRevenue: day.acquiredNetRevenue,
        })),
        byInstitution: salesReport.byPaymentInstitution.map((row) => ({
          key: row.dimensionKey,
          label: row.dimensionLabel,
          orders: row.orderCount,
          grossRevenue: row.grossRevenue,
          netRevenue: row.acquiredNetRevenue,
          shareOfGrossRevenue: row.shareOfGrossRevenue,
        })),
        byPaymentMethod: salesReport.byPaymentMethod.map((row) => ({
          key: row.dimensionKey,
          label: row.dimensionLabel,
          orders: row.orderCount,
          grossRevenue: row.grossRevenue,
          netRevenue: row.acquiredNetRevenue,
          shareOfGrossRevenue: row.shareOfGrossRevenue,
        })),
        byChannel: salesReport.byChannel.map((row) => ({
          key: row.orderPlatformId,
          label: row.orderPlatformName,
          orders: row.orderCount,
          grossRevenue: row.grossRevenue,
          netRevenue: row.acquiredNetRevenue,
          shareOfGrossRevenue: share(row.grossRevenue, salesReport.summary.grossRevenue),
        })),
      },
      payables: {
        expected: payables.summary.totalExpected,
        paid: payables.summary.totalPaid,
        open: payables.summary.totalRemaining,
        overdue: payables.summary.overdueAmount,
        openCount: payables.summary.openCount,
        overdueCount: payables.summary.overdueCount,
        byCategory: payablesByCategory,
      },
    };
  }
}

function buildNarrative({
  start,
  end,
  netRevenue,
  cashNet,
  payablesOpen,
}: {
  start: string;
  end: string;
  netRevenue: string;
  cashNet: string;
  payablesOpen: string;
}) {
  return `No periodo de ${start} a ${end}, a operacao registrou receita liquida de R$ ${netRevenue}, movimento liquido de caixa de R$ ${cashNet} e contas em aberto de R$ ${payablesOpen}.`;
}

function share(value: string, total: string): number {
  const totalAmount = new Prisma.Decimal(total);
  if (totalAmount.isZero()) {
    return 0;
  }

  return new Prisma.Decimal(value).div(totalAmount).toDecimalPlaces(4).toNumber();
}
