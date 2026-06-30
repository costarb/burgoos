import { Prisma } from "@prisma/client";

export interface PricedOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
}

export interface CalculatedOrderItem {
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface CalculatedOrder {
  total: Prisma.Decimal;
  items: CalculatedOrderItem[];
}

export function calculateOrderTotals(items: PricedOrderItem[]): CalculatedOrder {
  const calculatedItems = items.map((item) => {
    const total = item.unitPrice.mul(item.quantity);

    return {
      productId: item.productId,
      productNameSnapshot: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total
    };
  });

  return {
    total: calculatedItems.reduce(
      (sum, item) => sum.add(item.total),
      new Prisma.Decimal(0)
    ),
    items: calculatedItems
  };
}
