import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { FinancialAccountDto, FinancialCategoryDto } from "../dto/financial-account.dto";
import { toDecimal, toMoneyString } from "../money";

@Injectable()
export class FinancialAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(tenantId: string) {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      paymentInstitution: account.paymentInstitution,
      openingBalance: toMoneyString(account.openingBalance),
      openingBalanceAt: toDateOnly(account.openingBalanceAt),
      active: account.active,
    }));
  }

  async createAccount(tenantId: string, dto: FinancialAccountDto) {
    try {
      const account = await this.prisma.financialAccount.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          paymentInstitution: dto.paymentInstitution ?? null,
          openingBalance: toDecimal(dto.openingBalance),
          openingBalanceAt: parseDate(dto.openingBalanceAt),
          active: dto.active ?? true,
        },
      });

      return {
        id: account.id,
        name: account.name,
        paymentInstitution: account.paymentInstitution,
        openingBalance: toMoneyString(account.openingBalance),
        openingBalanceAt: toDateOnly(account.openingBalanceAt),
        active: account.active,
      };
    } catch (error) {
      handleUniqueError(error, "Conta financeira ja cadastrada");
    }
  }

  async updateAccount(tenantId: string, accountId: string, dto: FinancialAccountDto) {
    await this.ensureAccount(tenantId, accountId);

    try {
      const account = await this.prisma.financialAccount.update({
        where: { id: accountId },
        data: {
          name: dto.name.trim(),
          paymentInstitution: dto.paymentInstitution ?? null,
          openingBalance: toDecimal(dto.openingBalance),
          openingBalanceAt: parseDate(dto.openingBalanceAt),
          active: dto.active ?? true,
        },
      });

      return {
        id: account.id,
        name: account.name,
        paymentInstitution: account.paymentInstitution,
        openingBalance: toMoneyString(account.openingBalance),
        openingBalanceAt: toDateOnly(account.openingBalanceAt),
        active: account.active,
      };
    } catch (error) {
      handleUniqueError(error, "Conta financeira ja cadastrada");
    }
  }

  async listCategories(tenantId: string) {
    return this.prisma.financialCategory.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    });
  }

  async createCategory(tenantId: string, dto: FinancialCategoryDto) {
    try {
      return await this.prisma.financialCategory.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          active: dto.active ?? true,
        },
        select: { id: true, name: true, active: true },
      });
    } catch (error) {
      handleUniqueError(error, "Categoria financeira ja cadastrada");
    }
  }

  async updateCategory(tenantId: string, categoryId: string, dto: FinancialCategoryDto) {
    await this.ensureCategory(tenantId, categoryId);

    try {
      return await this.prisma.financialCategory.update({
        where: { id: categoryId },
        data: {
          name: dto.name.trim(),
          active: dto.active ?? true,
        },
        select: { id: true, name: true, active: true },
      });
    } catch (error) {
      handleUniqueError(error, "Categoria financeira ja cadastrada");
    }
  }

  private async ensureAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: accountId, tenantId },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException("Conta financeira nao encontrada");
    }
  }

  private async ensureCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id: categoryId, tenantId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException("Categoria financeira nao encontrada");
    }
  }
}

function handleUniqueError(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new BadRequestException(message);
  }

  throw error;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
