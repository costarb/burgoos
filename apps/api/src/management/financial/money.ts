import { Prisma } from "@prisma/client";

export function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function toMoneyString(value: Prisma.Decimal | number | string): string {
  return toDecimal(value).toFixed(2);
}

export function toRateNumber(value: Prisma.Decimal | number | string): number {
  return toDecimal(value).toNumber();
}
