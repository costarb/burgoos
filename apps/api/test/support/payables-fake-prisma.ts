import { DreExpenseClass, Prisma } from "@prisma/client";
import { vi } from "vitest";

type Row = Record<string, unknown>;

interface Named {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
}

/** In-memory Prisma for AccountsPayableService (create, update, cancel, pay, list, options). */
export function createPayablesFakePrisma(tenantId: string) {
  const state = {
    categories: [] as Array<Named & { dreClass: DreExpenseClass }>,
    suppliers: [] as Named[],
    accounts: [] as Array<Named & { paymentInstitution: string | null }>,
    payables: [] as Row[],
    payments: [] as Row[],
    audits: [] as Row[],
  };

  const byWhere = <T extends Row | Named>(rows: T[], where: Row = {}) =>
    rows.filter((row) =>
      Object.entries(where).every(([key, value]) => {
        if (value === undefined) return true;
        if (key === "dueDate" && value && typeof value === "object") {
          const range = value as { gte?: Date; lte?: Date };
          const due = (row as Row).dueDate as Date;
          return (!range.gte || due >= range.gte) && (!range.lte || due <= range.lte);
        }
        if (value && typeof value === "object") return true;
        return (row as Row)[key] === value;
      })
    );

  const withRelations = (payable: Row) => {
    const category = state.categories.find((item) => item.id === payable.categoryId)!;
    const supplier = state.suppliers.find((item) => item.id === payable.supplierId) ?? null;
    return {
      ...payable,
      category: { id: category.id, name: category.name, dreClass: category.dreClass },
      supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
      payments: state.payments
        .filter((payment) => payment.payableId === payable.id)
        .map((payment) => ({
          ...payment,
          financialAccount: state.accounts.find(
            (account) => account.id === payment.financialAccountId
          ),
        })),
    };
  };

  const namedModel = <T extends Named>(rows: () => T[]) => ({
    findFirst: vi.fn(async ({ where }: { where: Row }) => byWhere(rows(), where)[0] ?? null),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) => byWhere(rows(), where)),
  });

  const prisma: Record<string, unknown> = {
    state,
    financialCategory: namedModel(() => state.categories),
    supplier: namedModel(() => state.suppliers),
    financialAccount: {
      ...namedModel(() => state.accounts),
      findMany: vi.fn(async ({ where }: { where?: Row } = {}) =>
        byWhere(state.accounts, where).map((account) => ({
          ...account,
          openingBalance: new Prisma.Decimal(0),
          openingBalanceAt: null,
        }))
      ),
    },
    payableRecurrence: { create: vi.fn(async () => ({ id: "recurrence-1" })) },
    payable: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const payable = {
          id: `00000000-0000-4000-8000-${String(state.payables.length + 1).padStart(12, "0")}`,
          cancelledAt: null,
          cancellationReason: null,
          createdAt: new Date(),
          ...data,
          expectedAmount: new Prisma.Decimal(data.expectedAmount as Prisma.Decimal),
        };
        state.payables.push(payable);
        return withRelations(payable);
      }),
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const payable = byWhere(state.payables, where)[0];
        return payable ? withRelations(payable) : null;
      }),
      findMany: vi.fn(async ({ where }: { where?: Row } = {}) =>
        byWhere(state.payables, { tenantId: where?.tenantId, dueDate: where?.dueDate }).map(
          withRelations
        )
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const payable = state.payables.find((item) => item.id === where.id)!;
        Object.assign(payable, data);
        return withRelations(payable);
      }),
    },
    payablePayment: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const payment = { id: `payment-${state.payments.length + 1}`, reversedAt: null, ...data };
        state.payments.push(payment);
        return payment;
      }),
    },
    financialAudit: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        state.audits.push(data);
        return data;
      }),
    },
    $queryRaw: vi.fn(async () => []),
  };
  prisma.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma));

  state.categories.push(
    {
      id: "cat-rent",
      tenantId,
      name: "Aluguel",
      active: true,
      dreClass: DreExpenseClass.FIXED_COST,
    },
    {
      id: "cat-svc",
      tenantId,
      name: "Prestador de Serviço",
      active: true,
      dreClass: DreExpenseClass.VARIABLE_EXPENSE,
    }
  );
  state.suppliers.push({ id: "sup-1", tenantId, name: "Imobiliária Centro", active: true });
  state.accounts.push({
    id: "acc-1",
    tenantId,
    name: "Banco Inter",
    active: true,
    paymentInstitution: null,
  });

  return prisma as typeof prisma & { state: typeof state };
}
