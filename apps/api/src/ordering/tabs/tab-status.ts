export const SERVICE_TAB_STATUSES = [
  "OPEN",
  "CHECKOUT_PENDING",
  "PAID",
  "CANCELLED",
] as const;

export type ServiceTabStatus = (typeof SERVICE_TAB_STATUSES)[number];

const transitions: Record<ServiceTabStatus, ServiceTabStatus[]> = {
  OPEN: ["CHECKOUT_PENDING", "CANCELLED"],
  CHECKOUT_PENDING: ["OPEN", "PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function canTransitionTabStatus(
  from: ServiceTabStatus,
  to: ServiceTabStatus
): boolean {
  return transitions[from].includes(to);
}
