import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { StockMovementDto } from "./dto/stock-movement.dto";
import {
  buildStockMovementDrafts,
  calculateOrderIngredientRequirements,
} from "./stock-movement-calculator";

interface OrderForInventory {
  id: string;
  tenantId: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
  }>;
}

export interface OrderStockWarning {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  estimatedBalance: number;
  status: "BUY" | "INSUFFICIENT";
}

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

  async getOrderStockWarnings(order: OrderForInventory): Promise<OrderStockWarning[]> {
    const requirements = await this.calculateOrderRequirements(order);
    const ingredientIds = [...new Set(requirements.map((requirement) => requirement.ingredientId))];

    if (ingredientIds.length === 0) {
      return [];
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        tenantId: order.tenantId,
        id: {
          in: ingredientIds,
        },
      },
      include: {
        stockMovements: true,
      },
    });
    const requiredByIngredient = requirements.reduce((totals, requirement) => {
      const current = totals.get(requirement.ingredientId) ?? new Prisma.Decimal(0);
      totals.set(requirement.ingredientId, current.add(requirement.quantity));
      return totals;
    }, new Map<string, Prisma.Decimal>());

    return ingredients.reduce<OrderStockWarning[]>((warnings, ingredient) => {
      const movementTotals = ingredient.stockMovements.reduce((totals, movement) => {
        if (
          movement.movementType === StockMovementType.RESERVATION ||
          movement.movementType === StockMovementType.CONSUMPTION
        ) {
          return totals.sub(movement.quantity);
        }

        if (
          movement.movementType === StockMovementType.RELEASE ||
          movement.movementType === StockMovementType.MANUAL_ENTRY ||
          movement.movementType === StockMovementType.INITIAL ||
          movement.movementType === StockMovementType.MANUAL_ADJUSTMENT
        ) {
          return totals.add(movement.quantity);
        }

        return totals;
      }, new Prisma.Decimal(0));
      const estimatedBalance = ingredient.currentStock.add(movementTotals);

      if (estimatedBalance.lt(0)) {
        warnings.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          requiredQuantity: (
            requiredByIngredient.get(ingredient.id) ?? new Prisma.Decimal(0)
          ).toNumber(),
          estimatedBalance: estimatedBalance.toNumber(),
          status: "INSUFFICIENT",
        });
        return warnings;
      }

      if (estimatedBalance.lte(ingredient.minimumStock)) {
        warnings.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          requiredQuantity: (
            requiredByIngredient.get(ingredient.id) ?? new Prisma.Decimal(0)
          ).toNumber(),
          estimatedBalance: estimatedBalance.toNumber(),
          status: "BUY",
        });
        return warnings;
      }

      return warnings;
    }, []);
  }

  async reserveForOrder(order: OrderForInventory): Promise<void> {
    const existingReservations = await this.prisma.stockMovement.findMany({
      where: {
        tenantId: order.tenantId,
        orderId: order.id,
        movementType: StockMovementType.RESERVATION,
      },
    });

    if (existingReservations.length > 0) {
      return;
    }

    const requirements = await this.calculateOrderRequirements(order);
    const movements = buildStockMovementDrafts({
      requirements,
      movementType: StockMovementType.RESERVATION,
      reason: "Pedido em andamento",
    });

    if (movements.length === 0) {
      return;
    }

    await this.prisma.stockMovement.createMany({
      data: movements.map((movement) => ({
        tenantId: order.tenantId,
        ingredientId: movement.ingredientId,
        orderId: order.id,
        orderItemId: movement.orderItemId,
        movementType: movement.movementType,
        quantity: movement.quantity,
        reason: movement.reason,
      })),
    });
  }

  async releaseOrderReservation(tenantId: string, orderId: string, reason: string): Promise<void> {
    const activeReservations = await this.getActiveReservationMovements(tenantId, orderId);

    if (activeReservations.length === 0) {
      return;
    }

    await this.prisma.stockMovement.createMany({
      data: activeReservations.map((movement) => ({
        tenantId,
        ingredientId: movement.ingredientId,
        orderId,
        orderItemId: movement.orderItemId,
        movementType: StockMovementType.RELEASE,
        quantity: movement.quantity,
        reason,
      })),
    });
  }

  async consumeOrderReservation(tenantId: string, orderId: string): Promise<void> {
    const activeReservations = await this.getActiveReservationMovements(tenantId, orderId);

    if (activeReservations.length === 0) {
      return;
    }

    await this.prisma.stockMovement.createMany({
      data: [
        ...activeReservations.map((movement) => ({
          tenantId,
          ingredientId: movement.ingredientId,
          orderId,
          orderItemId: movement.orderItemId,
          movementType: StockMovementType.RELEASE,
          quantity: movement.quantity,
          reason: "Pedido entregue: liberar reserva",
        })),
        ...activeReservations.map((movement) => ({
          tenantId,
          ingredientId: movement.ingredientId,
          orderId,
          orderItemId: movement.orderItemId,
          movementType: StockMovementType.CONSUMPTION,
          quantity: movement.quantity,
          reason: "Pedido entregue: baixa de estoque",
        })),
      ],
    });
  }

  private async calculateOrderRequirements(order: OrderForInventory) {
    const productIds = [...new Set(order.items.map((item) => item.productId))];
    const technicalSheets = await this.prisma.technicalSheet.findMany({
      where: {
        tenantId: order.tenantId,
        productId: {
          in: productIds,
        },
        active: true,
      },
      include: {
        lines: true,
      },
    });

    return calculateOrderIngredientRequirements({
      items: order.items.map((item) => ({
        orderItemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
      })),
      technicalSheets: technicalSheets.map((sheet) => ({
        productId: sheet.productId,
        lines: sheet.lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantityUsed: line.quantityUsed,
        })),
      })),
    });
  }

  private async getActiveReservationMovements(tenantId: string, orderId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        orderId,
      },
    });
    const reservations = new Map<
      string,
      {
        ingredientId: string;
        orderItemId: string | null;
        quantity: Prisma.Decimal;
      }
    >();

    for (const movement of movements) {
      const key = `${movement.orderItemId ?? ""}:${movement.ingredientId}`;

      if (!reservations.has(key)) {
        reservations.set(key, {
          ingredientId: movement.ingredientId,
          orderItemId: movement.orderItemId,
          quantity: new Prisma.Decimal(0),
        });
      }

      const current = reservations.get(key);

      if (!current) {
        continue;
      }

      if (movement.movementType === StockMovementType.RESERVATION) {
        current.quantity = current.quantity.add(movement.quantity);
      }

      if (movement.movementType === StockMovementType.RELEASE) {
        current.quantity = current.quantity.sub(movement.quantity);
      }
    }

    return [...reservations.values()].filter((movement) => movement.quantity.gt(0));
  }
}
