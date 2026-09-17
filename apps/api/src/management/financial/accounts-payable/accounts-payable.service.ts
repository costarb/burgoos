import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { FinancialAuditAction, Prisma } from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import {
  PayableCancellationDto,
  PayableDto,
  PayablePaymentDto,
  PayablePaymentReversalDto,
  PayablesQueryDto,
} from "../dto/payable.dto";
import { FinancialAuditService } from "../financial-audit.service";
import { toDecimal, toMoneyString } from "../money";
import { buildPayableOccurrences } from "./payable-recurrence";
import { calculatePayableStatus, calculateRemainingAmount } from "./payable-rules";

const payableInclude = {
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  payments: {
    orderBy: { paidAt: "asc" },
    include: { financialAccount: { select: { id: true, name: true } } },
  },
} satisfies Prisma.PayableInclude;

type PayableWithDetails = Prisma.PayableGetPayload<{ include: typeof payableInclude }>;

interface PayableSummaryRow {
  total: bigint | number;
  totalExpected: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  totalRemaining: Prisma.Decimal;
  overdueAmount: Prisma.Decimal;
  openCount: bigint | number;
  overdueCount: bigint | number;
}

export interface PayableCategoryAggregate {
  categoryId: string | null;
  categoryName: string;
  expected: string;
  paid: string;
  open: string;
  overdue: string;
}

@Injectable()
export class AccountsPayableService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinancialAuditService) private readonly auditService: FinancialAuditService
  ) {}

  async list(tenantId: string, query: PayablesQueryDto) {
    const where = this.buildWhere(tenantId, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const statuses = queryValues(query.status).map((status) => status.toUpperCase());
    const statusIds = statuses.length
      ? await this.queryStatusPageIds(tenantId, query, page, pageSize)
      : null;
    const [payables, summaryRows] = await Promise.all([
      this.prisma.payable.findMany({
        where: statusIds ? { ...where, id: { in: statusIds } } : where,
        include: payableInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        skip: statusIds ? undefined : (page - 1) * pageSize,
        take: statusIds ? undefined : pageSize,
      }),
      this.querySummary(tenantId, query),
    ]);

    const normalizedStatuses = new Set(statuses);
    const items = payables
      .map((payable) => this.toResponse(payable))
      .filter((item) => normalizedStatuses.size === 0 || normalizedStatuses.has(item.status));
    const summary = summaryRows[0] ?? emptySummaryRow();
    return {
      items,
      summary: {
        totalExpected: toMoneyString(summary.totalExpected),
        totalPaid: toMoneyString(summary.totalPaid),
        totalRemaining: toMoneyString(summary.totalRemaining),
        overdueAmount: toMoneyString(summary.overdueAmount),
        openCount: Number(summary.openCount),
        overdueCount: Number(summary.overdueCount),
      },
      page,
      pageSize,
      total: Number(summary.total),
    };
  }

  async summarizeByCategory(
    tenantId: string,
    query: Pick<PayablesQueryDto, "start" | "end">
  ): Promise<PayableCategoryAggregate[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        categoryId: string | null;
        categoryName: string;
        expected: Prisma.Decimal;
        paid: Prisma.Decimal;
        open: Prisma.Decimal;
        overdue: Prisma.Decimal;
      }>
    >(Prisma.sql`SELECT p.category_id::text AS "categoryId", c.name AS "categoryName",
      COALESCE(SUM(p.expected_amount), 0) AS expected,
      COALESCE(SUM(COALESCE(pp.paid, 0)), 0) AS paid,
      COALESCE(SUM(p.expected_amount - COALESCE(pp.paid, 0)), 0) AS open,
      COALESCE(SUM(CASE WHEN p.due_date < CURRENT_DATE THEN p.expected_amount - COALESCE(pp.paid, 0) ELSE 0 END), 0) AS overdue
      FROM payables p JOIN financial_categories c ON c.id = p.category_id
      LEFT JOIN (SELECT payable_id, SUM(amount) FILTER (WHERE reversed_at IS NULL) AS paid FROM payable_payments GROUP BY payable_id) pp ON pp.payable_id = p.id
      WHERE p.tenant_id = ${tenantId}::uuid AND p.cancelled_at IS NULL
      ${query.start ? Prisma.sql`AND p.due_date >= ${parseDate(query.start)}` : Prisma.empty}
      ${query.end ? Prisma.sql`AND p.due_date <= ${endOfDay(parseDate(query.end))}` : Prisma.empty}
      GROUP BY p.category_id, c.name ORDER BY expected DESC`);
    return rows.map((row) => ({
      ...row,
      expected: toMoneyString(row.expected),
      paid: toMoneyString(row.paid),
      open: toMoneyString(row.open),
      overdue: toMoneyString(row.overdue),
    }));
  }

  async getOptions(tenantId: string) {
    const [categories, accounts, suppliers] = await Promise.all([
      this.prisma.financialCategory.findMany({
        where: { tenantId, active: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.financialAccount.findMany({
        where: { tenantId, active: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.supplier.findMany({
        where: { tenantId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, active: true },
      }),
    ]);

    return {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        active: category.active,
      })),
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        paymentInstitution: account.paymentInstitution,
        openingBalance: toMoneyString(account.openingBalance),
        openingBalanceAt: toDateOnly(account.openingBalanceAt),
        active: account.active,
      })),
      suppliers,
    };
  }

  async get(tenantId: string, payableId: string) {
    return this.toResponse(await this.findPayable(tenantId, payableId));
  }

  async getAuditHistory(tenantId: string, payableId: string) {
    await this.findPayable(tenantId, payableId);

    const records = await this.prisma.financialAudit.findMany({
      where: { tenantId, entityType: "payable", entityId: payableId },
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

  async create(user: AuthUser, dto: PayableDto) {
    await this.ensureCategory(user.tenantId, dto.categoryId);
    await this.ensureSupplier(user.tenantId, dto.supplierId);

    const expectedAmount = toDecimal(dto.expectedAmount);
    const competenceDate = dto.competenceDate ? parseDate(dto.competenceDate) : null;
    const dueDate = parseDate(dto.dueDate);
    const occurrences = buildPayableOccurrences(dueDate, competenceDate, dto.recurrence);

    const created = await this.prisma.$transaction(async (tx) => {
      const recurrence = dto.recurrence
        ? await tx.payableRecurrence.create({
            data: {
              tenantId: user.tenantId,
              frequency: dto.recurrence.frequency,
              interval: dto.recurrence.interval,
              startsOn: parseDate(dto.recurrence.startsOn),
              endsOn: dto.recurrence.endsOn ? parseDate(dto.recurrence.endsOn) : null,
              occurrenceCount: dto.recurrence.occurrenceCount ?? occurrences.length,
            },
          })
        : null;

      const records = [];

      for (const occurrence of occurrences) {
        const suffix =
          occurrences.length > 1 ? ` (${occurrence.sequence}/${occurrences.length})` : "";
        const payable = await tx.payable.create({
          data: {
            tenantId: user.tenantId,
            categoryId: dto.categoryId,
            supplierId: dto.supplierId ?? null,
            recurrenceGroupId: recurrence?.id ?? null,
            description: `${dto.description}${suffix}`,
            documentReference: dto.documentReference ?? null,
            competenceDate: occurrence.competenceDate ?? null,
            dueDate: occurrence.dueDate,
            expectedAmount,
            notes: dto.notes ?? null,
            createdByUserId: user.id,
          },
          include: payableInclude,
        });

        const response = this.toResponse(payable);
        await this.auditService.record(
          {
            tenantId: user.tenantId,
            actorUserId: user.id,
            entityType: "payable",
            entityId: payable.id,
            action: FinancialAuditAction.CREATE,
            afterSnapshot: response,
          },
          tx
        );

        records.push(response);
      }

      return records;
    });

    return { items: created, summary: this.buildSummary(created) };
  }

  async update(user: AuthUser, payableId: string, dto: PayableDto) {
    await this.ensureCategory(user.tenantId, dto.categoryId);
    await this.ensureSupplier(user.tenantId, dto.supplierId);

    return this.prisma.$transaction(async (tx) => {
      const current = await this.findPayable(user.tenantId, payableId, tx);
      const beforeSnapshot = this.toResponse(current);

      if (current.cancelledAt) {
        throw new BadRequestException("Conta cancelada nao pode ser alterada");
      }

      const paidAmount = this.calculatePaidAmount(current);
      const expectedAmount = toDecimal(dto.expectedAmount);

      if (expectedAmount.lessThan(paidAmount)) {
        throw new BadRequestException("Valor previsto nao pode ser menor que o valor ja pago");
      }

      const updated = await tx.payable.update({
        where: { id: payableId },
        data: {
          categoryId: dto.categoryId,
          supplierId: dto.supplierId ?? null,
          description: dto.description,
          documentReference: dto.documentReference ?? null,
          competenceDate: dto.competenceDate ? parseDate(dto.competenceDate) : null,
          dueDate: parseDate(dto.dueDate),
          expectedAmount,
          notes: dto.notes ?? null,
        },
        include: payableInclude,
      });

      const afterSnapshot = this.toResponse(updated);
      await this.auditService.record(
        {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entityType: "payable",
          entityId: payableId,
          action: FinancialAuditAction.UPDATE,
          beforeSnapshot,
          afterSnapshot,
        },
        tx
      );

      return afterSnapshot;
    });
  }

  async cancel(user: AuthUser, payableId: string, dto: PayableCancellationDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findPayable(user.tenantId, payableId, tx);
      const beforeSnapshot = this.toResponse(current);

      if (current.cancelledAt) {
        return beforeSnapshot;
      }

      if (this.calculatePaidAmount(current).greaterThan(0)) {
        throw new BadRequestException("Conta com pagamento registrado nao pode ser cancelada");
      }

      const updated = await tx.payable.update({
        where: { id: payableId },
        data: { cancelledAt: new Date(), cancellationReason: dto.reason },
        include: payableInclude,
      });
      const afterSnapshot = this.toResponse(updated);

      await this.auditService.record(
        {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entityType: "payable",
          entityId: payableId,
          action: FinancialAuditAction.CANCEL,
          beforeSnapshot,
          afterSnapshot,
        },
        tx
      );

      return afterSnapshot;
    });
  }

  async addPayment(user: AuthUser, payableId: string, dto: PayablePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findPayable(user.tenantId, payableId, tx);
      const beforeSnapshot = this.toResponse(current);

      if (current.cancelledAt) {
        throw new BadRequestException("Conta cancelada nao pode receber pagamento");
      }

      await this.ensureFinancialAccount(user.tenantId, dto.financialAccountId, tx);

      const amount = toDecimal(dto.amount);
      const remainingAmount = calculateRemainingAmount(
        current.expectedAmount,
        this.calculatePaidAmount(current)
      );

      if (amount.greaterThan(remainingAmount)) {
        throw new BadRequestException("Pagamento excede o saldo em aberto");
      }

      await tx.payablePayment.create({
        data: {
          tenantId: user.tenantId,
          payableId,
          financialAccountId: dto.financialAccountId,
          amount,
          paidAt: parseDate(dto.paidAt),
          notes: dto.notes ?? null,
          createdByUserId: user.id,
        },
      });

      const updated = await this.findPayable(user.tenantId, payableId, tx);
      const afterSnapshot = this.toResponse(updated);

      await this.auditService.record(
        {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entityType: "payable",
          entityId: payableId,
          action: FinancialAuditAction.PAY,
          beforeSnapshot,
          afterSnapshot,
        },
        tx
      );

      return afterSnapshot;
    });
  }

  async reversePayment(user: AuthUser, paymentId: string, dto: PayablePaymentReversalDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payablePayment.findFirst({
        where: { id: paymentId, tenantId: user.tenantId },
        include: { payable: { include: payableInclude } },
      });

      if (!payment) {
        throw new NotFoundException("Pagamento nao encontrado");
      }

      if (payment.reversedAt) {
        return this.toResponse(payment.payable);
      }

      const beforeSnapshot = this.toResponse(payment.payable);

      await tx.payablePayment.update({
        where: { id: paymentId },
        data: {
          reversedAt: new Date(),
          reversalReason: dto.reason,
          reversedByUserId: user.id,
        },
      });

      const updated = await this.findPayable(user.tenantId, payment.payableId, tx);
      const afterSnapshot = this.toResponse(updated);

      await this.auditService.record(
        {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entityType: "payable",
          entityId: payment.payableId,
          action: FinancialAuditAction.REVERSE,
          beforeSnapshot,
          afterSnapshot,
        },
        tx
      );

      return afterSnapshot;
    });
  }

  private buildWhere(tenantId: string, query: PayablesQueryDto): Prisma.PayableWhereInput {
    const competenceRange = query.competenceMonth ? parseMonthRange(query.competenceMonth) : null;
    const categoryIds = queryValues(query.categoryId);
    const supplierIds = queryValues(query.supplierId);

    return {
      tenantId,
      categoryId: prismaSelection(categoryIds),
      supplierId: prismaSelection(supplierIds),
      competenceDate: competenceRange
        ? {
            gte: competenceRange.start,
            lt: competenceRange.end,
          }
        : undefined,
      dueDate: {
        gte: query.start ? parseDate(query.start) : undefined,
        lte: query.end ? endOfDay(parseDate(query.end)) : undefined,
      },
    };
  }

  private querySummary(tenantId: string, query: PayablesQueryDto): Promise<PayableSummaryRow[]> {
    const statuses = queryValues(query.status).map((status) => status.toUpperCase());
    const statusPredicate = statuses.length
      ? Prisma.sql`AND status IN (${Prisma.join(statuses)})`
      : Prisma.empty;
    return this.prisma.$queryRaw<PayableSummaryRow[]>(Prisma.sql`WITH payable_values AS (
      SELECT p.expected_amount,
        COALESCE(pp.paid, 0) AS paid,
        p.expected_amount - COALESCE(pp.paid, 0) AS remaining,
        CASE
          WHEN p.cancelled_at IS NOT NULL THEN 'CANCELLED'
          WHEN COALESCE(pp.paid, 0) >= p.expected_amount THEN 'PAID'
          WHEN p.due_date < CURRENT_DATE THEN 'OVERDUE'
          WHEN COALESCE(pp.paid, 0) > 0 THEN 'PARTIALLY_PAID'
          ELSE 'OPEN'
        END AS status
      FROM payables p
      LEFT JOIN (SELECT payable_id, SUM(amount) FILTER (WHERE reversed_at IS NULL) AS paid FROM payable_payments GROUP BY payable_id) pp ON pp.payable_id = p.id
      WHERE p.tenant_id = ${tenantId}::uuid
      ${uuidInSql("p.category_id", queryValues(query.categoryId))}
      ${uuidInSql("p.supplier_id", queryValues(query.supplierId))}
      ${query.start ? Prisma.sql`AND p.due_date >= ${parseDate(query.start)}` : Prisma.empty}
      ${query.end ? Prisma.sql`AND p.due_date <= ${endOfDay(parseDate(query.end))}` : Prisma.empty}
      ${query.competenceMonth ? competenceSql(query.competenceMonth) : Prisma.empty}
    ) SELECT COUNT(*)::bigint AS total,
      COALESCE(SUM(expected_amount) FILTER (WHERE status <> 'CANCELLED'), 0) AS "totalExpected",
      COALESCE(SUM(paid) FILTER (WHERE status <> 'CANCELLED'), 0) AS "totalPaid",
      COALESCE(SUM(remaining) FILTER (WHERE status <> 'CANCELLED'), 0) AS "totalRemaining",
      COALESCE(SUM(remaining) FILTER (WHERE status = 'OVERDUE'), 0) AS "overdueAmount",
      COUNT(*) FILTER (WHERE status IN ('OPEN', 'PARTIALLY_PAID', 'OVERDUE'))::bigint AS "openCount",
      COUNT(*) FILTER (WHERE status = 'OVERDUE')::bigint AS "overdueCount"
      FROM payable_values WHERE TRUE ${statusPredicate}`);
  }

  private async queryStatusPageIds(
    tenantId: string,
    query: PayablesQueryDto,
    page: number,
    pageSize: number
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM (
      SELECT p.id, p.due_date, p.created_at, CASE
        WHEN p.cancelled_at IS NOT NULL THEN 'CANCELLED'
        WHEN COALESCE(pp.paid, 0) >= p.expected_amount THEN 'PAID'
        WHEN p.due_date < CURRENT_DATE THEN 'OVERDUE'
        WHEN COALESCE(pp.paid, 0) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'OPEN' END AS status
      FROM payables p
      LEFT JOIN (SELECT payable_id, SUM(amount) FILTER (WHERE reversed_at IS NULL) AS paid FROM payable_payments GROUP BY payable_id) pp ON pp.payable_id = p.id
      WHERE p.tenant_id = ${tenantId}::uuid
      ${uuidInSql("p.category_id", queryValues(query.categoryId))}
      ${uuidInSql("p.supplier_id", queryValues(query.supplierId))}
      ${query.start ? Prisma.sql`AND p.due_date >= ${parseDate(query.start)}` : Prisma.empty}
      ${query.end ? Prisma.sql`AND p.due_date <= ${endOfDay(parseDate(query.end))}` : Prisma.empty}
      ${query.competenceMonth ? competenceSql(query.competenceMonth) : Prisma.empty}
    ) filtered WHERE status IN (${Prisma.join(queryValues(query.status).map((status) => status.toUpperCase()))})
    ORDER BY due_date, created_at OFFSET ${(page - 1) * pageSize} LIMIT ${pageSize}`);
    return rows.map((row) => row.id);
  }

  private async findPayable(
    tenantId: string,
    payableId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<PayableWithDetails> {
    const payable = await tx.payable.findFirst({
      where: { id: payableId, tenantId },
      include: payableInclude,
    });

    if (!payable) {
      throw new NotFoundException("Conta a pagar nao encontrada");
    }

    return payable;
  }

  private async ensureCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id: categoryId, tenantId, active: true },
    });

    if (!category) {
      throw new BadRequestException("Categoria financeira invalida");
    }
  }

  private async ensureSupplier(tenantId: string, supplierId?: string | null) {
    if (!supplierId) {
      return;
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, active: true },
    });

    if (!supplier) {
      throw new BadRequestException("Fornecedor invalido");
    }
  }

  private async ensureFinancialAccount(
    tenantId: string,
    financialAccountId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const account = await tx.financialAccount.findFirst({
      where: { id: financialAccountId, tenantId, active: true },
      select: { id: true },
    });

    if (!account) {
      throw new BadRequestException("Conta financeira invalida");
    }
  }

  private toResponse(payable: PayableWithDetails) {
    const paidAmount = this.calculatePaidAmount(payable);
    const remainingAmount = calculateRemainingAmount(payable.expectedAmount, paidAmount);
    const status = calculatePayableStatus({
      expectedAmount: payable.expectedAmount,
      paidAmount,
      dueDate: payable.dueDate,
      cancelledAt: payable.cancelledAt,
    });

    return {
      id: payable.id,
      categoryId: payable.categoryId,
      categoryName: payable.category.name,
      supplierId: payable.supplierId,
      supplierName: payable.supplier?.name ?? null,
      recurrenceGroupId: payable.recurrenceGroupId,
      description: payable.description,
      documentReference: payable.documentReference,
      competenceDate: toDateOnly(payable.competenceDate),
      dueDate: toDateOnly(payable.dueDate),
      expectedAmount: toMoneyString(payable.expectedAmount),
      paidAmount: toMoneyString(paidAmount),
      remainingAmount: toMoneyString(remainingAmount),
      status,
      notes: payable.notes,
      cancelledAt: payable.cancelledAt?.toISOString() ?? null,
      cancellationReason: payable.cancellationReason,
      payments: payable.payments.map((payment) => ({
        id: payment.id,
        payableId: payment.payableId,
        financialAccountId: payment.financialAccountId,
        financialAccountName: payment.financialAccount.name,
        amount: toMoneyString(payment.amount),
        paidAt: toDateOnly(payment.paidAt),
        notes: payment.notes,
        reversedAt: payment.reversedAt?.toISOString() ?? null,
        reversalReason: payment.reversalReason,
      })),
    };
  }

  private calculatePaidAmount(payable: PayableWithDetails): Prisma.Decimal {
    return payable.payments
      .filter((payment) => !payment.reversedAt)
      .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));
  }

  private buildSummary(items: ReturnType<AccountsPayableService["toResponse"]>[]) {
    const active = items.filter((item) => item.status !== "CANCELLED");
    const sum = (field: "expectedAmount" | "paidAmount" | "remainingAmount") =>
      active.reduce((total, item) => total.plus(item[field]), new Prisma.Decimal(0));
    const overdue = active.filter((item) => item.status === "OVERDUE");
    return {
      totalExpected: toMoneyString(sum("expectedAmount")),
      totalPaid: toMoneyString(sum("paidAmount")),
      totalRemaining: toMoneyString(sum("remainingAmount")),
      overdueAmount: toMoneyString(
        overdue.reduce((total, item) => total.plus(item.remainingAmount), new Prisma.Decimal(0))
      ),
      openCount: active.filter((item) =>
        ["OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(item.status)
      ).length,
      overdueCount: overdue.length,
    };
  }
}

function queryValues(value?: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function uuidInSql(column: "p.category_id" | "p.supplier_id", values: string[]): Prisma.Sql {
  if (!values.length) return Prisma.empty;
  const identifier =
    column === "p.category_id" ? Prisma.sql`p.category_id` : Prisma.sql`p.supplier_id`;
  return Prisma.sql`AND ${identifier}::text IN (${Prisma.join(values)})`;
}

function prismaSelection(values: string[]): string | { in: string[] } | undefined {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : { in: values };
}

function emptySummaryRow(): PayableSummaryRow {
  return {
    total: 0,
    totalExpected: new Prisma.Decimal(0),
    totalPaid: new Prisma.Decimal(0),
    totalRemaining: new Prisma.Decimal(0),
    overdueAmount: new Prisma.Decimal(0),
    openCount: 0,
    overdueCount: 0,
  };
}

function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseMonthRange(value: string): { start: Date; end: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new BadRequestException("Mes de referencia invalido");
  }

  const [year, month] = value.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  };
}

function competenceSql(value: string): Prisma.Sql {
  const range = parseMonthRange(value);
  return Prisma.sql`AND p.competence_date >= ${range.start} AND p.competence_date < ${range.end}`;
}

function endOfDay(value: Date): Date {
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return end;
}

function toDateOnly(value?: Date | null): string | null {
  if (!value) {
    return null;
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
