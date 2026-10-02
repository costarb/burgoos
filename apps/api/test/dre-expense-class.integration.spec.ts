import { DreExpenseClass, Prisma, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsPayableService } from "../src/management/financial/accounts-payable/accounts-payable.service";
import { FinancialAccountService } from "../src/management/financial/cash-flow/financial-account.service";
import { FinancialAuditService } from "../src/management/financial/financial-audit.service";
import type { AuthUser } from "../src/platform/auth/auth.types";

const TENANT = "11111111-1111-4111-8111-111111111111";
const user: AuthUser = { id: "user-1", tenantId: TENANT, role: UserRole.OWNER, email: "a@b.c", name: "Dono" };

interface Category {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  dreClass: DreExpenseClass;
}

function createPrisma() {
  const state = {
    categories: [] as Category[],
    payables: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
  };
  const pick = (category: Category) => ({
    id: category.id,
    name: category.name,
    active: category.active,
    dreClass: category.dreClass,
  });
  const withRelations = (payable: Record<string, unknown>) => ({
    ...payable,
    category: pick(state.categories.find((item) => item.id === payable.categoryId)!),
    supplier: null,
    payments: [],
  });
  const prisma: Record<string, unknown> = {
    state,
    financialCategory: {
      create: vi.fn(async ({ data }: { data: Omit<Category, "id"> }) => {
        const category = { id: `cat-${state.categories.length + 1}`, ...data };
        state.categories.push(category);
        return pick(category);
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
        const found = state.categories.find((item) => item.id === where.id && item.tenantId === where.tenantId);
        return found ? pick(found) : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Category> }) => {
        const category = state.categories.find((item) => item.id === where.id)!;
        Object.assign(category, data);
        return pick(category);
      }),
    },
    financialAudit: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.audits.push(data);
        return data;
      }),
    },
    supplier: { findFirst: vi.fn(async () => null) },
    payableRecurrence: { create: vi.fn(async () => ({ id: "recurrence-1" })) },
    payable: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const payable = {
          id: `payable-${state.payables.length + 1}`,
          cancelledAt: null,
          cancellationReason: null,
          createdAt: new Date(),
          ...data,
          expectedAmount: new Prisma.Decimal(data.expectedAmount as Prisma.Decimal),
        };
        state.payables.push(payable);
        return withRelations(payable);
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const payable = state.payables.find((item) => item.id === where.id);
        return payable ? withRelations(payable) : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const payable = state.payables.find((item) => item.id === where.id)!;
        Object.assign(payable, data);
        return withRelations(payable);
      }),
    },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma as typeof prisma & { state: typeof state };
}

describe("DRE expense classification", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let categories: FinancialAccountService;
  let payables: AccountsPayableService;

  beforeEach(() => {
    prisma = createPrisma();
    const audit = new FinancialAuditService(prisma as never);
    categories = new FinancialAccountService(prisma as never, audit);
    payables = new AccountsPayableService(prisma as never, audit);
  });

  it("creates categories as variable expense by default and accepts an explicit class", async () => {
    expect(await categories.createCategory(TENANT, { name: "Marketing" })).toMatchObject({ dreClass: "VARIABLE_EXPENSE" });
    expect(await categories.createCategory(TENANT, { name: "Aluguel", dreClass: "FIXED_COST" })).toMatchObject({
      dreClass: "FIXED_COST",
    });
  });

  it("audits class changes and keeps the class when it is not sent", async () => {
    const category = await categories.createCategory(TENANT, { name: "Prestador", dreClass: "VARIABLE_EXPENSE" });

    await categories.updateCategory(user, category!.id, { name: "Prestador de Servico" });
    expect(prisma.state.categories[0].dreClass).toBe("VARIABLE_EXPENSE");
    expect(prisma.state.audits).toHaveLength(0);

    await categories.updateCategory(user, category!.id, { name: "Prestador de Servico", dreClass: "FIXED_COST" });
    expect(prisma.state.audits).toEqual([
      expect.objectContaining({
        entityType: "financial_category",
        entityId: category!.id,
        action: "UPDATE",
        beforeSnapshot: { dreClass: "VARIABLE_EXPENSE" },
        afterSnapshot: { dreClass: "FIXED_COST" },
      }),
    ]);
  });

  it("copies the payable adjustment to every recurrence and exposes the effective class", async () => {
    const category = await categories.createCategory(TENANT, { name: "Prestador", dreClass: "VARIABLE_EXPENSE" });

    const created = await payables.create(user, {
      categoryId: category!.id,
      description: "Contador",
      competenceDate: "2026-09-01",
      dueDate: "2026-09-10",
      expectedAmount: 800,
      dreClassOverride: "FIXED_COST",
      recurrence: { frequency: "MONTHLY", interval: 1, startsOn: "2026-09-10", occurrenceCount: 3 },
    } as never);

    expect(created.items).toHaveLength(3);
    for (const item of created.items) {
      expect(item).toMatchObject({
        dreClassOverride: "FIXED_COST",
        categoryDreClass: "VARIABLE_EXPENSE",
        effectiveDreClass: "FIXED_COST",
      });
    }
  });

  it("follows the category until the payable is adjusted, and back again", async () => {
    const category = await categories.createCategory(TENANT, { name: "Prestador", dreClass: "VARIABLE_EXPENSE" });
    const [payable] = (
      await payables.create(user, {
        categoryId: category!.id,
        description: "Manutencao",
        dueDate: "2026-09-10",
        expectedAmount: 300,
      } as never)
    ).items;
    expect(payable).toMatchObject({ dreClassOverride: null, effectiveDreClass: "VARIABLE_EXPENSE" });

    await categories.updateCategory(user, category!.id, { name: "Prestador", dreClass: "EXCLUDED" });
    const following = await payables.get(TENANT, payable.id);
    expect(following.effectiveDreClass).toBe("EXCLUDED");

    const base = { categoryId: category!.id, description: "Manutencao", dueDate: "2026-09-10", expectedAmount: 300 };
    const adjusted = await payables.update(user, payable.id, { ...base, dreClassOverride: "FIXED_COST" } as never);
    expect(adjusted).toMatchObject({ dreClassOverride: "FIXED_COST", effectiveDreClass: "FIXED_COST" });

    const reset = await payables.update(user, payable.id, { ...base, dreClassOverride: null } as never);
    expect(reset).toMatchObject({ dreClassOverride: null, effectiveDreClass: "EXCLUDED" });
  });
});
