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

@Injectable()
export class AccountsPayableService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinancialAuditService) private readonly auditService: FinancialAuditService
  ) {}

  async list(tenantId: string, query: PayablesQueryDto) {
    const payables = await this.prisma.payable.findMany({
      where: this.buildWhere(tenantId, query),
      include: payableInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });

    const items = payables.map((payable) => this.toResponse(payable));

    if (query.status) {
      const normalizedStatus = query.status.toUpperCase();
      const filteredItems = items.filter((item) => item.status === normalizedStatus);
      return { items: filteredItems, summary: this.buildSummary(filteredItems) };
    }

    return { items, summary: this.buildSummary(items) };
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

    return {
      tenantId,
      categoryId: query.categoryId,
      supplierId: query.supplierId,
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
    const summary = items.reduce(
      (accumulator, item) => {
        if (item.status === "CANCELLED") {
          return accumulator;
        }

        const expectedAmount = toDecimal(item.expectedAmount);
        const paidAmount = toDecimal(item.paidAmount);
        const remainingAmount = toDecimal(item.remainingAmount);

        accumulator.totalExpected = accumulator.totalExpected.plus(expectedAmount);
        accumulator.totalPaid = accumulator.totalPaid.plus(paidAmount);
        accumulator.totalRemaining = accumulator.totalRemaining.plus(remainingAmount);

        if (item.status === "OVERDUE") {
          accumulator.overdueAmount = accumulator.overdueAmount.plus(remainingAmount);
          accumulator.overdueCount += 1;
        }

        if (
          item.status === "OPEN" ||
          item.status === "PARTIALLY_PAID" ||
          item.status === "OVERDUE"
        ) {
          accumulator.openCount += 1;
        }

        return accumulator;
      },
      {
        totalExpected: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
        totalRemaining: new Prisma.Decimal(0),
        overdueAmount: new Prisma.Decimal(0),
        openCount: 0,
        overdueCount: 0,
      }
    );

    return {
      totalExpected: toMoneyString(summary.totalExpected),
      totalPaid: toMoneyString(summary.totalPaid),
      totalRemaining: toMoneyString(summary.totalRemaining),
      overdueAmount: toMoneyString(summary.overdueAmount),
      openCount: summary.openCount,
      overdueCount: summary.overdueCount,
    };
  }
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
