import { FulfillmentMethod, OrderStatus } from "@prisma/client";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: []
};

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentMethod?: FulfillmentMethod
): boolean {
  if (
    to === OrderStatus.SHIPPED &&
    fulfillmentMethod !== undefined &&
    fulfillmentMethod !== FulfillmentMethod.DELIVERY
  ) {
    return false;
  }

  return allowedTransitions[from].includes(to);
}
