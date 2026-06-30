import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { toDecimal } from "./money";

export function calculateIngredientUnitCost(
  purchaseCost: number | string | Prisma.Decimal,
  purchaseQuantity: number | string | Prisma.Decimal
): Prisma.Decimal {
  const quantity = toDecimal(purchaseQuantity);

  if (quantity.lte(0)) {
    throw new BadRequestException("Purchase quantity must be greater than zero");
  }

  return toDecimal(purchaseCost).div(quantity);
}
