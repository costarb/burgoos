import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CashMovementType, FinancialAuditAction, Prisma } from "@prisma/client";
import { AuthUser } from "../../../platform/auth/auth.types";
import { PrismaService } from "../../../platform/database/prisma.service";
import { CashMovementDto } from "../dto/cash-flow.dto";
import { ReasonDto } from "../dto/financial-operation.dto";
import { FinancialAuditService } from "../financial-audit.service";
import { toDecimal, toMoneyString } from "../money";

const movementInclude = {
  financialAccount: { select: { id: true, name: true } },
  destinationAccount: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.CashMovementInclude;

type CashMovementWithDetails = Prisma.CashMovementGetPayload<{ include: typeof movementInclude }>;

@Injectable()
export class CashMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: FinancialAuditService
  ) {}

  async list(tenantId: string, start?: Date, end?: Date) {
    const movements = await this.prisma.cashMovement.findMany({
      where: {
        tenantId,
        occurredAt: {
          gte: start,
          lte: end,
        },
      },
      include: movementInclude,
      orderBy: { occurredAt: "desc" },
    });

    return movements.map((movement) => this.toResponse(movement));
  }

  async create(user: AuthUser, dto: CashMovementDto) {
    await this.validateMovement(user.tenantId, dto);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          tenantId: user.tenantId,
          type: dto.type,
          financialAccountId: dto.financialAccountId,
          destinationAccountId: dto.destinationAccountId ?? null,
          categoryId: dto.categoryId ?? null,
          amount: toDecimal(dto.amount),
          occurredAt: parseDate(dto.occurredAt),
          description: dto.description,
          justification: dto.justification ?? null,
          createdByUserId: user.id,
        },
        include: movementInclude,
      });

      const afterSnapshot = this.toResponse(movement);
      await this.auditService.record(
        {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entityType: "cash_movement",
          entityId: movement.id,
          action: FinancialAuditAction.CREATE,
          afterSnapshot,
        },
        tx
      );

      return afterSnapshot;
    });
  }

  async reverse(user: AuthUser, movementId: string, dto: ReasonDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.cashMovement.findFirst({
        where: { id: movementId, tenantId: user.tenantId },
        include: movementInclude,
      });

      if (!current) {
        throw new NotFoundException("Movimento de caixa nao encontrado");
      }

      if (current.reversedAt) {
        return this.toResponse(current);
      }

      const beforeSnapshot = this.toResponse(current);
      const updated = await tx.cashMovement.update({
        where: { id: movementId },
        data: {
          reversedAt: new Date(),
          reversalReason: dto.reason,
          reversedByUserId: user.id,
        },
        include: movementInclude,
      });
      const afterSnapshot = this.toResponse(updated);

      await this.auditService.record(
        {
          tenantId: user.tenantId,
          actorUserId: user.id,
          entityType: "cash_movement",
          entityId: movementId,
          action: FinancialAuditAction.REVERSE,
          beforeSnapshot,
          afterSnapshot,
        },
        tx
      );

      return afterSnapshot;
    });
  }

  private async validateMovement(tenantId: string, dto: CashMovementDto) {
    await this.ensureAccount(tenantId, dto.financialAccountId);

    if (dto.destinationAccountId) {
      await this.ensureAccount(tenantId, dto.destinationAccountId);
    }

    if (dto.categoryId) {
      await this.ensureCategory(tenantId, dto.categoryId);
    }

    if (dto.type === CashMovementType.TRANSFER) {
      if (!dto.destinationAccountId) {
        throw new BadRequestException("Transferencia exige conta de destino");
      }

      if (dto.destinationAccountId === dto.financialAccountId) {
        throw new BadRequestException("Conta de destino deve ser diferente da origem");
      }

      return;
    }

    if (dto.destinationAccountId) {
      throw new BadRequestException("Conta de destino e permitida apenas para transferencia");
    }

    if (dto.type === CashMovementType.ADJUSTMENT && !dto.justification?.trim()) {
      throw new BadRequestException("Ajuste de caixa exige justificativa");
    }
  }

  private async ensureAccount(tenantId: string, accountId: string) {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: accountId, tenantId, active: true },
      select: { id: true },
    });

    if (!account) {
      throw new BadRequestException("Conta financeira invalida");
    }
  }

  private async ensureCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id: categoryId, tenantId, active: true },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException("Categoria financeira invalida");
    }
  }

  private toResponse(movement: CashMovementWithDetails) {
    return {
      id: movement.id,
      type: movement.type,
      financialAccountId: movement.financialAccountId,
      financialAccountName: movement.financialAccount.name,
      destinationAccountId: movement.destinationAccountId,
      destinationAccountName: movement.destinationAccount?.name ?? null,
      categoryId: movement.categoryId,
      categoryName: movement.category?.name ?? null,
      amount: toMoneyString(movement.amount),
      occurredAt: toDateOnly(movement.occurredAt),
      description: movement.description,
      justification: movement.justification,
      reversedAt: movement.reversedAt?.toISOString() ?? null,
      reversalReason: movement.reversalReason,
    };
  }
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
