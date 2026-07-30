export const CHARGE_STATUSES = [
  "CREATED",
  "WAITING_CUSTOMER",
  "PROCESSING",
  "APPROVED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
  "UNKNOWN",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

const transitions: Record<ChargeStatus, ChargeStatus[]> = {
  CREATED: ["WAITING_CUSTOMER", "PROCESSING", "APPROVED", "CANCELLED", "FAILED"],
  WAITING_CUSTOMER: ["PROCESSING", "APPROVED", "DECLINED", "CANCELLED", "EXPIRED", "FAILED", "UNKNOWN"],
  PROCESSING: ["APPROVED", "DECLINED", "CANCELLED", "EXPIRED", "FAILED", "UNKNOWN"],
  APPROVED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  DECLINED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
  UNKNOWN: ["PROCESSING", "APPROVED", "DECLINED", "CANCELLED", "EXPIRED", "FAILED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [],
};

const activeStatuses = new Set<ChargeStatus>([
  "CREATED",
  "WAITING_CUSTOMER",
  "PROCESSING",
  "UNKNOWN",
]);

export function canTransitionChargeStatus(from: ChargeStatus, to: ChargeStatus): boolean {
  return transitions[from].includes(to);
}

export function isActiveChargeStatus(status: ChargeStatus): boolean {
  return activeStatuses.has(status);
}
