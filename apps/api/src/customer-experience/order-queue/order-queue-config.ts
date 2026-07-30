import { OrderStatus } from "@prisma/client";

export interface OrderQueueConfig {
  enabled: boolean;
  activeStatuses: OrderStatus[];
  completedStatuses: OrderStatus[];
  completedLimit: number;
  showNickname: boolean;
  staleAfterSeconds: number;
}

export const DEFAULT_ORDER_QUEUE_CONFIG: OrderQueueConfig = {
  enabled: true,
  activeStatuses: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY],
  completedStatuses: [OrderStatus.DELIVERED],
  completedLimit: 8,
  showNickname: false,
  staleAfterSeconds: 15,
};

const publicStatuses = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
]);

export function parseOrderQueueConfig(config: unknown): OrderQueueConfig {
  const root = isRecord(config) ? config : {};
  const value = isRecord(root.orderQueue) ? root.orderQueue : {};
  return {
    enabled: typeof value.enabled === "boolean"
      ? value.enabled
      : DEFAULT_ORDER_QUEUE_CONFIG.enabled,
    activeStatuses: statuses(value.activeStatuses, DEFAULT_ORDER_QUEUE_CONFIG.activeStatuses),
    completedStatuses: statuses(
      value.completedStatuses,
      DEFAULT_ORDER_QUEUE_CONFIG.completedStatuses,
    ),
    completedLimit: integerBetween(
      value.completedLimit,
      1,
      30,
      DEFAULT_ORDER_QUEUE_CONFIG.completedLimit,
    ),
    showNickname: typeof value.showNickname === "boolean"
      ? value.showNickname
      : DEFAULT_ORDER_QUEUE_CONFIG.showNickname,
    staleAfterSeconds: integerBetween(
      value.staleAfterSeconds,
      5,
      120,
      DEFAULT_ORDER_QUEUE_CONFIG.staleAfterSeconds,
    ),
  };
}

function statuses(value: unknown, fallback: OrderStatus[]): OrderStatus[] {
  if (!Array.isArray(value)) return fallback;
  const valid = [...new Set(value.filter(
    (item): item is OrderStatus =>
      typeof item === "string" && publicStatuses.has(item as OrderStatus),
  ))];
  return valid.length > 0 ? valid : fallback;
}

function integerBetween(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
