import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentInstitution, Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import {
  FinancialAccountDto,
  FinancialCategoryDto,
  PaymentInstitutionConfigurationDto,
} from "../dto/financial-account.dto";
import { toDecimal, toMoneyString } from "../money";

@Injectable()
export class FinancialAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(tenantId: string) {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { tenantId },
      include: { institution: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      paymentInstitution: account.paymentInstitution,
      paymentInstitutionId: account.paymentInstitutionId,
      paymentInstitutionName:
        account.institution?.name ?? paymentInstitutionLabel(account.paymentInstitution),
      openingBalance: toMoneyString(account.openingBalance),
      openingBalanceAt: toDateOnly(account.openingBalanceAt),
      active: account.active,
    }));
  }

  async createAccount(tenantId: string, dto: FinancialAccountDto) {
    const institution = await this.resolveInstitution(tenantId, dto);

    try {
      const account = await this.prisma.financialAccount.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          paymentInstitution: institution?.paymentInstitution ?? dto.paymentInstitution ?? null,
          paymentInstitutionId: institution?.id ?? null,
          openingBalance: toDecimal(dto.openingBalance),
          openingBalanceAt: parseDate(dto.openingBalanceAt),
          active: dto.active ?? true,
        },
        include: { institution: true },
      });

      return this.toAccountResponse(account);
    } catch (error) {
      handleUniqueError(error, "Conta financeira ja cadastrada");
    }
  }

  async updateAccount(tenantId: string, accountId: string, dto: FinancialAccountDto) {
    await this.ensureAccount(tenantId, accountId);
    const institution = await this.resolveInstitution(tenantId, dto);

    try {
      const account = await this.prisma.financialAccount.update({
        where: { id: accountId },
        data: {
          name: dto.name.trim(),
          paymentInstitution: institution?.paymentInstitution ?? dto.paymentInstitution ?? null,
          paymentInstitutionId: institution?.id ?? null,
          openingBalance: toDecimal(dto.openingBalance),
          openingBalanceAt: parseDate(dto.openingBalanceAt),
          active: dto.active ?? true,
        },
        include: { institution: true },
      });

      return this.toAccountResponse(account);
    } catch (error) {
      handleUniqueError(error, "Conta financeira ja cadastrada");
    }
  }

  async listInstitutions(tenantId: string, filters: { search?: string; active?: boolean } = {}) {
    await this.ensureDefaultInstitutions(tenantId);

    const institutions = await this.prisma.paymentInstitutionConfiguration.findMany({
      where: {
        tenantId,
        active: filters.active,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: "insensitive" } },
              { code: { contains: filters.search, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      code: institution.code,
      paymentInstitution: institution.paymentInstitution,
      active: institution.active,
    }));
  }

  async createInstitution(tenantId: string, dto: PaymentInstitutionConfigurationDto) {
    try {
      const institution = await this.prisma.paymentInstitutionConfiguration.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          code: this.normalizeInstitutionCode(dto.code?.trim() || dto.name),
          paymentInstitution: dto.paymentInstitution ?? null,
          active: dto.active ?? true,
        },
      });

      return this.toInstitutionResponse(institution);
    } catch (error) {
      handleUniqueError(error, "Instituicao financeira ja cadastrada");
    }
  }

  async updateInstitution(
    tenantId: string,
    institutionId: string,
    dto: PaymentInstitutionConfigurationDto
  ) {
    await this.ensureInstitution(tenantId, institutionId);

    try {
      const institution = await this.prisma.paymentInstitutionConfiguration.update({
        where: { id: institutionId },
        data: {
          name: dto.name.trim(),
          code: this.normalizeInstitutionCode(dto.code?.trim() || dto.name),
          paymentInstitution: dto.paymentInstitution ?? null,
          active: dto.active ?? true,
        },
      });

      return this.toInstitutionResponse(institution);
    } catch (error) {
      handleUniqueError(error, "Instituicao financeira ja cadastrada");
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

  private async ensureInstitution(tenantId: string, institutionId: string) {
    const institution = await this.prisma.paymentInstitutionConfiguration.findFirst({
      where: { id: institutionId, tenantId },
      select: { id: true },
    });

    if (!institution) {
      throw new NotFoundException("Instituicao financeira nao encontrada");
    }
  }

  private async resolveInstitution(tenantId: string, dto: FinancialAccountDto) {
    if (!dto.paymentInstitutionId) {
      return null;
    }

    const institution = await this.prisma.paymentInstitutionConfiguration.findFirst({
      where: {
        id: dto.paymentInstitutionId,
        tenantId,
        active: true,
      },
      select: {
        id: true,
        paymentInstitution: true,
      },
    });

    if (!institution) {
      throw new NotFoundException("Instituicao financeira nao encontrada");
    }

    return institution;
  }

  private async ensureDefaultInstitutions(tenantId: string) {
    const defaults: Array<{ name: string; code: string; paymentInstitution: PaymentInstitution }> =
      [
        { name: "PagBank", code: "PAGBANK", paymentInstitution: PaymentInstitution.PAGBANK },
        {
          name: "Mercado Pago",
          code: "MERCADO_PAGO",
          paymentInstitution: PaymentInstitution.MERCADO_PAGO,
        },
        { name: "Dinheiro", code: "DINHEIRO", paymentInstitution: PaymentInstitution.DINHEIRO },
        {
          name: "Caixa Local",
          code: "CAIXA_LOCAL",
          paymentInstitution: PaymentInstitution.CAIXA_LOCAL,
        },
      ];

    await Promise.all(
      defaults.map((institution) =>
        this.prisma.paymentInstitutionConfiguration.upsert({
          where: {
            tenantId_paymentInstitution: {
              tenantId,
              paymentInstitution: institution.paymentInstitution,
            },
          },
          create: {
            tenantId,
            ...institution,
          },
          update: {},
        })
      )
    );
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

  private normalizeInstitutionCode(value: string): string {
    return value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  }

  private toAccountResponse(
    account: Prisma.FinancialAccountGetPayload<{ include: { institution: true } }>
  ) {
    return {
      id: account.id,
      name: account.name,
      paymentInstitution: account.paymentInstitution,
      paymentInstitutionId: account.paymentInstitutionId,
      paymentInstitutionName:
        account.institution?.name ?? paymentInstitutionLabel(account.paymentInstitution),
      openingBalance: toMoneyString(account.openingBalance),
      openingBalanceAt: toDateOnly(account.openingBalanceAt),
      active: account.active,
    };
  }

  private toInstitutionResponse(institution: {
    id: string;
    name: string;
    code: string;
    paymentInstitution: PaymentInstitution | null;
    active: boolean;
  }) {
    return {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      paymentInstitution: institution.paymentInstitution,
      active: institution.active,
    };
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

function paymentInstitutionLabel(value: PaymentInstitution | null): string | null {
  if (!value) {
    return null;
  }

  return {
    PAGBANK: "PagBank",
    MERCADO_PAGO: "Mercado Pago",
    DINHEIRO: "Dinheiro",
    CAIXA_LOCAL: "Caixa Local",
  }[value];
}
