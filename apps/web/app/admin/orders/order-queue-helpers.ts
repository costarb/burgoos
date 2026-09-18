import type { AdminOrder } from "@burgoos/types";

export function isPendingPlatformOrder(order: AdminOrder): boolean {
  return order.platformProvider === "IFOOD" && order.status === "PENDING";
}
