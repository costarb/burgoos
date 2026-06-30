import { Prisma, StockMovementType } from "@prisma/client";

export interface OrderStockItem {
  orderItemId: string;
  productId: string;
  quantity: number;
}

export interface ProductTechnicalSheetForStock {
  productId: string;
  lines: Array<{
    ingredientId: string;
    quantityUsed: Prisma.Decimal;
  }>;
}

export interface IngredientRequirement {
  orderItemId: string;
  productId: string;
  ingredientId: string;
  quantity: Prisma.Decimal;
}

export interface StockMovementDraft extends IngredientRequirement {
  movementType: StockMovementType;
  reason: string;
}

export function calculateOrderIngredientRequirements(input: {
  items: OrderStockItem[];
  technicalSheets: ProductTechnicalSheetForStock[];
}): IngredientRequirement[] {
  const sheetsByProduct = new Map(input.technicalSheets.map((sheet) => [sheet.productId, sheet]));
  const requirements = new Map<string, IngredientRequirement>();

  for (const item of input.items) {
    const sheet = sheetsByProduct.get(item.productId);

    if (!sheet) {
      continue;
    }

    for (const line of sheet.lines) {
      const key = `${item.orderItemId}:${line.ingredientId}`;
      const current = requirements.get(key);
      const quantity = line.quantityUsed.mul(item.quantity);

      if (current) {
        current.quantity = current.quantity.add(quantity);
      } else {
        requirements.set(key, {
          orderItemId: item.orderItemId,
          productId: item.productId,
          ingredientId: line.ingredientId,
          quantity,
        });
      }
    }
  }

  return [...requirements.values()];
}

export function buildStockMovementDrafts(input: {
  requirements: IngredientRequirement[];
  movementType: "RESERVATION" | "CONSUMPTION" | "RELEASE";
  reason: string;
}): StockMovementDraft[] {
  return input.requirements.map((requirement) => ({
    ...requirement,
    movementType: input.movementType,
    reason: input.reason,
  }));
}

export function calculateEstimatedStockImpact(
  movements: Array<{
    movementType: StockMovementType;
    quantity: Prisma.Decimal;
  }>
): Prisma.Decimal {
  return movements.reduce((total, movement) => {
    if (
      movement.movementType === StockMovementType.RESERVATION ||
      movement.movementType === StockMovementType.CONSUMPTION
    ) {
      return total.sub(movement.quantity);
    }

    if (
      movement.movementType === StockMovementType.RELEASE ||
      movement.movementType === StockMovementType.MANUAL_ENTRY
    ) {
      return total.add(movement.quantity);
    }

    return total;
  }, new Prisma.Decimal(0));
}
