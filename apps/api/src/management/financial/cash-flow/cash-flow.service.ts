import { Injectable } from "@nestjs/common";
import { CashMovementType, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { toMoneyString } from "../money";
import { calculateRemainingAmount } from "../accounts-payable/payable-rules";
import { mapOrderReceipts } from "./order-receipt-source";

interface LedgerAccumulatorEntry {
  sourceType: "OPENING_BALANCE" | "ORDER_RECEIPT" | "PAYABLE_PAYMENT" | "CASH_MOVEMENT";
  sourceId: string;
  financialAccountId: string | null;
  financialAccountName: string;
  occurredAt: Date;
  description: string;
  inflowAmount: Prisma.Decimal;
  outflowAmount: Prisma.Decimal;
  realizationStatus: "REALIZED" | "PROJECTED";
}

interface ProjectionAccumulatorEntry {
  sourceType: "ORDER_RECEIPT" | "PAYABLE";
  sourceId: string;
  financialAccountId: string | null;
  financialAccountName: string;
  occurredAt: Date;
  description: string;
  inflowAmount: Prisma.Decimal;
  outflowAmount: Prisma.Decimal;
}

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditHistory(tenantId: string, entityType: "cash_movement", entityId: string) {
    const records = await this.prisma.financialAudit.findMany({
      where: { tenantId, entityType, entityId },
      include: { actorUser: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => ({
      id: record.id,
      entityType: record.entityType,
      entityId: record.entityId,
      action: record.action,
      actorName: record.actorUser.name,
      actorEmail: record.actorUser.email,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async getPosition(tenantId: string, asOf: Date, projectionEnd: Date, financialAccountId?: string) {
    const [accounts, orders, payables, payments, movements] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where: { tenantId, ...(financialAccountId ? { id: financialAccountId } : {}) },
        orderBy: { name: "asc" },
      }),
      this.prisma.order.findMany({
        where: {
          tenantId,
          status: OrderStatus.DELIVERED,
          deletedAt: null,
          OR: [{ paymentReleaseExpectedAt: null }, { paymentReleaseExpectedAt: { lte: projectionEnd } }],
        },
        select: {
          id: true,
          status: true,
          customerName: true,
          total: true,
          paymentInstitution: true,
          paymentGrossAmount: true,
          paymentNetAmount: true,
          paymentReleaseExpectedAt: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      this.prisma.payable.findMany({
        where: {
          tenantId,
          cancelledAt: null,
          dueDate: { lte: projectionEnd },
        },
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          payments: true,
        },
      }),
      this.prisma.payablePayment.findMany({
        where: {
          tenantId,
          reversedAt: null,
          paidAt: { lte: asOf },
          ...(financialAccountId ? { financialAccountId } : {}),
        },
        include: {
          payable: { select: { description: true } },
          financialAccount: { select: { name: true } },
        },
      }),
      this.prisma.cashMovement.findMany({
        where: {
          tenantId,
          reversedAt: null,
          occurredAt: { lte: asOf },
          ...(financialAccountId ? { OR: [{ financialAccountId }, { destinationAccountId: financialAccountId }] } : {}),
        },
        include: {
          financialAccount: { select: { name: true } },
          destinationAccount: { select: { name: true } },
        },
      }),
    ]);

    const accountMap = new Map(
      accounts
        .filter((account) => account.paymentInstitution)
        .map((account) => [account.paymentInstitution!, account.id])
    );
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const orderReceipts = mapOrderReceipts(orders, accountMap, asOf).filter(
      (receipt) => !financialAccountId || receipt.financialAccountId === financialAccountId
    );
    const movementEntries = movementLedgerEntries(movements).filter(
      (entry) => !financialAccountId || entry.financialAccountId === financialAccountId
    );

    const ledger = [
      ...accounts.map(
        (account): LedgerAccumulatorEntry => ({
          sourceType: "OPENING_BALANCE",
          sourceId: account.id,
          financialAccountId: account.id,
          financialAccountName: account.name,
          occurredAt: account.openingBalanceAt,
          description: `Saldo inicial ${account.name}`,
          inflowAmount: account.openingBalance,
          outflowAmount: new Prisma.Decimal(0),
          realizationStatus: "REALIZED",
        })
      ),
      ...orderReceipts
        .filter((receipt) => receipt.realizationStatus === "REALIZED")
        .map(
          (receipt): LedgerAccumulatorEntry => ({
            sourceType: "ORDER_RECEIPT",
            sourceId: receipt.sourceId,
            financialAccountId: receipt.financialAccountId,
            financialAccountName: accountNameFor(receipt.financialAccountId, accountNames),
            occurredAt: receipt.occurredAt,
            description: receipt.description,
            inflowAmount: receipt.amount,
            outflowAmount: new Prisma.Decimal(0),
            realizationStatus: "REALIZED",
          })
        ),
      ...payments.map(
        (payment): LedgerAccumulatorEntry => ({
          sourceType: "PAYABLE_PAYMENT",
          sourceId: payment.id,
          financialAccountId: payment.financialAccountId,
          financialAccountName: payment.financialAccount.name,
          occurredAt: payment.paidAt,
          description: `Pagamento ${payment.payable.description}`,
          inflowAmount: new Prisma.Decimal(0),
          outflowAmount: payment.amount,
          realizationStatus: "REALIZED",
        })
      ),
      ...movementEntries,
    ]
      .filter((entry) => entry.occurredAt <= asOf)
      .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

    const projection = [
      ...orderReceipts
        .filter((receipt) => receipt.realizationStatus === "PROJECTED")
        .map(
          (receipt): ProjectionAccumulatorEntry => ({
            sourceType: "ORDER_RECEIPT",
            sourceId: receipt.sourceId,
            financialAccountId: receipt.financialAccountId,
            financialAccountName: accountNameFor(receipt.financialAccountId, accountNames),
            occurredAt: receipt.occurredAt,
            description: receipt.description,
            inflowAmount: receipt.amount,
            outflowAmount: new Prisma.Decimal(0),
          })
        ),
      ...payables
        .map((payable): ProjectionAccumulatorEntry | null => {
          const paidAmount = payable.payments
            .filter((payment) => !payment.reversedAt)
            .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));
          const remainingAmount = calculateRemainingAmount(payable.expectedAmount, paidAmount);

          if (remainingAmount.isZero()) {
            return null;
          }

          const occurredAt = payable.dueDate <= asOf ? asOf : payable.dueDate;

          return {
            sourceType: "PAYABLE",
            sourceId: payable.id,
            financialAccountId: null,
            financialAccountName: "A definir",
            occurredAt,
            description: payable.supplier?.name
              ? `${payable.description} - ${payable.supplier.name}`
              : payable.description,
            inflowAmount: new Prisma.Decimal(0),
            outflowAmount: remainingAmount,
          };
        })
        .filter((entry): entry is ProjectionAccumulatorEntry => Boolean(entry)),
    ].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

    const currentBalance = ledger.reduce(
      (total, entry) => total.plus(entry.inflowAmount).minus(entry.outflowAmount),
      new Prisma.Decimal(0)
    );
    const receivableAmount = projection.reduce(
      (total, entry) => total.plus(entry.inflowAmount),
      new Prisma.Decimal(0)
    );
    const payableAmount = projection.reduce(
      (total, entry) => total.plus(entry.outflowAmount),
      new Prisma.Decimal(0)
    );
    const projectedBalance = currentBalance.plus(receivableAmount).minus(payableAmount);
    const projectedEntries = formatProjection(projection, currentBalance);

    return {
      asOf: toDateOnly(asOf),
      projectionEnd: toDateOnly(projectionEnd),
      currentBalance: toMoneyString(currentBalance),
      receivableAmount: toMoneyString(receivableAmount),
      payableAmount: toMoneyString(payableAmount),
      projectedBalance: toMoneyString(projectedBalance),
      negativeBalanceDetected: projectedEntries.some((entry) => new Prisma.Decimal(entry.projectedBalance).lessThan(0)),
      accounts: formatAccountBalances(accounts, ledger),
      ledger: formatLedger(ledger),
      projection: projectedEntries,
      timeline: formatTimeline(projection),
    };
  }

  async getStatement(tenantId: string, start: Date, end: Date, financialAccountId?: string) {
    const position = await this.getPosition(tenantId, end, end, financialAccountId);
    const startKey = toDateOnly(start);
    const endKey = toDateOnly(end);
    const priorEntries = position.ledger.filter((entry) => entry.occurredAt < startKey);
    const periodEntries = position.ledger.filter(
      (entry) => entry.occurredAt >= startKey && entry.occurredAt <= endKey
    );
    const openingBalance = priorEntries[priorEntries.length - 1]?.runningBalance ?? "0.00";

    return formatStatement({
      start: startKey,
      end: endKey,
      financialAccountId: financialAccountId ?? null,
      openingBalance: new Prisma.Decimal(openingBalance),
      entries: periodEntries,
    });
  }
}

type FormattedLedgerEntry = ReturnType<typeof formatLedger>[number];

function movementLedgerEntries(
  movements: Array<
    Prisma.CashMovementGetPayload<{
      include: {
        financialAccount: { select: { name: true } };
        destinationAccount: { select: { name: true } };
      };
    }>
  >
): LedgerAccumulatorEntry[] {
  return movements.flatMap((movement) => {
    if (movement.type === CashMovementType.TRANSFER) {
      return [
        {
          sourceType: "CASH_MOVEMENT" as const,
          sourceId: `${movement.id}:out`,
          financialAccountId: movement.financialAccountId,
          financialAccountName: movement.financialAccount.name,
          occurredAt: movement.occurredAt,
          description: movement.description,
          inflowAmount: new Prisma.Decimal(0),
          outflowAmount: movement.amount,
          realizationStatus: "REALIZED" as const,
        },
        {
          sourceType: "CASH_MOVEMENT" as const,
          sourceId: `${movement.id}:in`,
          financialAccountId: movement.destinationAccountId,
          financialAccountName: movement.destinationAccount?.name ?? "Conta destino",
          occurredAt: movement.occurredAt,
          description: movement.description,
          inflowAmount: movement.amount,
          outflowAmount: new Prisma.Decimal(0),
          realizationStatus: "REALIZED" as const,
        },
      ];
    }

    const isInflow = movement.type === CashMovementType.MANUAL_INFLOW || movement.type === CashMovementType.ADJUSTMENT;

    return [
      {
        sourceType: "CASH_MOVEMENT" as const,
        sourceId: movement.id,
        financialAccountId: movement.financialAccountId,
        financialAccountName: movement.financialAccount.name,
        occurredAt: movement.occurredAt,
        description: movement.description,
        inflowAmount: isInflow ? movement.amount : new Prisma.Decimal(0),
        outflowAmount: isInflow ? new Prisma.Decimal(0) : movement.amount,
        realizationStatus: "REALIZED" as const,
      },
    ];
  });
}

function formatLedger(entries: LedgerAccumulatorEntry[]) {
  let runningBalance = new Prisma.Decimal(0);

  return entries.map((entry) => {
    runningBalance = runningBalance.plus(entry.inflowAmount).minus(entry.outflowAmount);

    return {
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      financialAccountId: entry.financialAccountId,
      financialAccountName: entry.financialAccountName,
      occurredAt: toDateOnly(entry.occurredAt),
      description: entry.description,
      inflowAmount: toMoneyString(entry.inflowAmount),
      outflowAmount: toMoneyString(entry.outflowAmount),
      runningBalance: toMoneyString(runningBalance),
      realizationStatus: entry.realizationStatus,
    };
  });
}

function formatStatement({
  start,
  end,
  financialAccountId,
  openingBalance,
  entries,
}: {
  start: string;
  end: string;
  financialAccountId: string | null;
  openingBalance: Prisma.Decimal;
  entries: FormattedLedgerEntry[];
}) {
  const buckets = new Map<
    string,
    {
      creditAmount: Prisma.Decimal;
      debitAmount: Prisma.Decimal;
      entries: Array<FormattedLedgerEntry & { entryType: "CREDIT" | "DEBIT"; amount: string }>;
    }
  >();
  let totalCredit = new Prisma.Decimal(0);
  let totalDebit = new Prisma.Decimal(0);
  let runningBalance = openingBalance;

  entries.forEach((entry) => {
    const creditAmount = new Prisma.Decimal(entry.inflowAmount);
    const debitAmount = new Prisma.Decimal(entry.outflowAmount);
    const entryType = creditAmount.greaterThan(0) ? "CREDIT" : "DEBIT";
    const amount = entryType === "CREDIT" ? creditAmount : debitAmount;
    const bucket = buckets.get(entry.occurredAt) ?? {
      creditAmount: new Prisma.Decimal(0),
      debitAmount: new Prisma.Decimal(0),
      entries: [],
    };

    bucket.creditAmount = bucket.creditAmount.plus(creditAmount);
    bucket.debitAmount = bucket.debitAmount.plus(debitAmount);
    bucket.entries.push({ ...entry, entryType, amount: toMoneyString(amount) });
    buckets.set(entry.occurredAt, bucket);

    totalCredit = totalCredit.plus(creditAmount);
    totalDebit = totalDebit.plus(debitAmount);
  });

  const days = [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => {
      const netAmount = bucket.creditAmount.minus(bucket.debitAmount);
      runningBalance = runningBalance.plus(netAmount);

      return {
        date,
        creditAmount: toMoneyString(bucket.creditAmount),
        debitAmount: toMoneyString(bucket.debitAmount),
        netAmount: toMoneyString(netAmount),
        runningBalance: toMoneyString(runningBalance),
        entries: bucket.entries,
      };
    });

  const netAmount = totalCredit.minus(totalDebit);

  return {
    start,
    end,
    financialAccountId,
    openingBalance: toMoneyString(openingBalance),
    closingBalance: toMoneyString(openingBalance.plus(netAmount)),
    totalCredit: toMoneyString(totalCredit),
    totalDebit: toMoneyString(totalDebit),
    netAmount: toMoneyString(netAmount),
    days,
  };
}

function formatProjection(entries: ProjectionAccumulatorEntry[], currentBalance: Prisma.Decimal) {
  let projectedBalance = currentBalance;

  return entries.map((entry) => {
    projectedBalance = projectedBalance.plus(entry.inflowAmount).minus(entry.outflowAmount);

    return {
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      financialAccountId: entry.financialAccountId,
      financialAccountName: entry.financialAccountName,
      occurredAt: toDateOnly(entry.occurredAt),
      description: entry.description,
      inflowAmount: toMoneyString(entry.inflowAmount),
      outflowAmount: toMoneyString(entry.outflowAmount),
      projectedBalance: toMoneyString(projectedBalance),
    };
  });
}

function formatTimeline(entries: ProjectionAccumulatorEntry[]) {
  const buckets = new Map<string, { inflowAmount: Prisma.Decimal; outflowAmount: Prisma.Decimal }>();

  entries.forEach((entry) => {
    const date = toDateOnly(entry.occurredAt);
    const bucket = buckets.get(date) ?? {
      inflowAmount: new Prisma.Decimal(0),
      outflowAmount: new Prisma.Decimal(0),
    };
    bucket.inflowAmount = bucket.inflowAmount.plus(entry.inflowAmount);
    bucket.outflowAmount = bucket.outflowAmount.plus(entry.outflowAmount);
    buckets.set(date, bucket);
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      inflowAmount: toMoneyString(bucket.inflowAmount),
      outflowAmount: toMoneyString(bucket.outflowAmount),
      netAmount: toMoneyString(bucket.inflowAmount.minus(bucket.outflowAmount)),
    }));
}

function formatAccountBalances(accounts: { id: string; name: string }[], entries: LedgerAccumulatorEntry[]) {
  const accountBalances = new Map<string | null, Prisma.Decimal>();

  entries.forEach((entry) => {
    const current = accountBalances.get(entry.financialAccountId) ?? new Prisma.Decimal(0);
    accountBalances.set(entry.financialAccountId, current.plus(entry.inflowAmount).minus(entry.outflowAmount));
  });

  const balances: Array<{
    financialAccountId: string | null;
    financialAccountName: string;
    balance: string;
    unallocated: boolean;
  }> = accounts.map((account) => ({
    financialAccountId: account.id,
    financialAccountName: account.name,
    balance: toMoneyString(accountBalances.get(account.id) ?? new Prisma.Decimal(0)),
    unallocated: false,
  }));

  const unallocated = accountBalances.get(null);
  if (unallocated && !unallocated.isZero()) {
    balances.push({
      financialAccountId: null,
      financialAccountName: "Nao alocado",
      balance: toMoneyString(unallocated),
      unallocated: true,
    });
  }

  return balances;
}

function accountNameFor(accountId: string | null, accountNames: Map<string, string>): string {
  if (!accountId) {
    return "Nao alocado";
  }

  return accountNames.get(accountId) ?? "Conta financeira";
}

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
