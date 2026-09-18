import type { AdminOrder } from "@rrfive/types";

export function isPendingPlatformOrder(order: AdminOrder): boolean {
  return order.platformProvider === "IFOOD" && order.status === "PENDING";
}
