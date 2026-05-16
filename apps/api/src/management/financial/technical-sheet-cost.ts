import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { toDecimal, toMoneyString } from "./money";

export interface TechnicalSheetCostInput {
  ingredientId: string;
  ingredientName: string;
  quantityUsed: number | string | Prisma.Decimal;
  unitCost: number | string | Prisma.Decimal;
  isPackaging?: boolean;
  notes?: string | null;
}

export function calculateTechnicalSheetCost(lines: TechnicalSheetCostInput[]) {
  if (lines.length === 0) {
    throw new BadRequestException("Technical sheet must have at least one line");
  }

  const calculatedLines = lines.map((line) => {
    const quantityUsed = toDecimal(line.quantityUsed);

    if (quantityUsed.lte(0)) {
      throw new BadRequestException("Quantity used must be greater than zero");
    }

    const unitCostSnapshot = toDecimal(line.unitCost);
    const itemCost = quantityUsed.mul(unitCostSnapshot);

    return {
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      quantityUsed,
      unitCostSnapshot,
      itemCost,
      itemCostText: toMoneyString(itemCost),
      isPackaging: line.isPackaging ?? false,
      notes: line.notes ?? null,
    };
  });

  return {
    ingredientCmv: calculatedLines.reduce(
      (total, line) => total.add(line.itemCost),
      new Prisma.Decimal(0)
    ),
    lines: calculatedLines.map((line) => ({
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      quantityUsed: line.quantityUsed.toNumber(),
      unitCostSnapshot: line.unitCostSnapshot.toFixed(4),
      itemCost: line.itemCostText,
      isPackaging: line.isPackaging,
      notes: line.notes,
    })),
  };
}
