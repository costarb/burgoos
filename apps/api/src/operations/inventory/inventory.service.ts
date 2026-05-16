import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { StockMovementDto } from "./dto/stock-movement.dto";

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBalances(tenantId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { tenantId },
      include: {
        stockMovements: true,
      },
      orderBy: [{ name: "asc" }],
    });

    return ingredients.map((ingredient) => {
      const movementTotals = ingredient.stockMovements.reduce(
        (totals, movement) => {
          if (
            movement.movementType === StockMovementType.RESERVATION ||
            movement.movementType === StockMovementType.CONSUMPTION
          ) {
            totals.reservedOrConsumed = totals.reservedOrConsumed.add(movement.quantity);
          }

          if (movement.movementType === StockMovementType.RELEASE) {
            totals.reservedOrConsumed = totals.reservedOrConsumed.sub(movement.quantity);
          }

          if (
            movement.movementType === StockMovementType.INITIAL ||
            movement.movementType === StockMovementType.MANUAL_ENTRY ||
            movement.movementType === StockMovementType.MANUAL_ADJUSTMENT
          ) {
            totals.manualEntries = totals.manualEntries.add(movement.quantity);
          }

          return totals;
        },
        {
          reservedOrConsumed: new Prisma.Decimal(0),
          manualEntries: new Prisma.Decimal(0),
        }
      );
      const estimatedBalance = ingredient.currentStock
        .add(movementTotals.manualEntries)
        .sub(movementTotals.reservedOrConsumed);

      return {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        currentStock: ingredient.currentStock.toNumber(),
        reservedOrConsumed: movementTotals.reservedOrConsumed.toNumber(),
        manualEntries: movementTotals.manualEntries.toNumber(),
        estimatedBalance: estimatedBalance.toNumber(),
        minimumStock: ingredient.minimumStock.toNumber(),
        status: estimatedBalance.lte(0)
          ? "INSUFFICIENT"
          : estimatedBalance.lte(ingredient.minimumStock)
            ? "BUY"
            : "OK",
      };
    });
  }

  async createManualMovement(tenantId: string, dto: StockMovementDto) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: {
        id: dto.ingredientId,
        tenantId,
      },
    });

    if (!ingredient) {
      throw new NotFoundException("Ingredient not found");
    }

    return this.prisma.stockMovement.create({
      data: {
        tenantId,
        ingredientId: dto.ingredientId,
        movementType: dto.movementType,
        quantity: new Prisma.Decimal(dto.quantity),
        reason: dto.reason ?? "Movimentacao manual",
      },
    });
  }
}
