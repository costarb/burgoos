import { FulfillmentMethod, PaymentMethod } from "@prisma/client";
import { ExternalOrderDraft, ExternalOrderItemDraft } from "../../../ordering/external-order.types";

type JsonRecord = Record<string, unknown>;

export function mapIfoodOrderToExternalDraft(payload: unknown): ExternalOrderDraft {
  const order = asRecord(payload);
  const delivery = asRecord(order.delivery);
  const takeout = asRecord(order.takeout);
  const customer = asRecord(order.customer);
  const total = asRecord(order.total);
  const merchant = asRecord(order.merchant);
  const schedule = asRecord(order.schedule);
  const items = Array.isArray(order.items) ? order.items : [];
  const mode = takeout.mode || order.orderType === "TAKEOUT" ? "TAKEOUT" : "DELIVERY";
  const timing = schedule.deliveryDateTime || order.scheduled ? "SCHEDULED" : "IMMEDIATE";
  const createdAt = dateFrom(order.createdAt) ?? new Date();
  const preparationStartAt = dateFrom(schedule.preparationStartDateTime);

  return {
    provider: "IFOOD",
    externalOrderId: stringFrom(order.id ?? order.orderId, "missing-order-id"),
    externalMerchantId: stringFrom(merchant.id ?? order.merchantId, "missing-merchant-id"),
    externalStatus: stringFrom(order.status, "PLACED"),
    mode,
    timing,
    customerName: stringFrom(customer.name, "Cliente iFood"),
    customerPhone: nullableString(customer.phone?.toString() ?? customer.localizer?.toString()),
    fulfillmentMethod: mode === "TAKEOUT" ? FulfillmentMethod.PICKUP : FulfillmentMethod.DELIVERY,
    paymentMethod: mapPaymentMethod(order),
    total: numberFrom(total.orderAmount ?? total.subTotal ?? order.total, 0),
    deliveryAddress: delivery.address ?? null,
    notes: nullableString(order.observations),
    confirmationDeadlineAt: new Date((preparationStartAt ?? createdAt).getTime() + 8 * 60 * 1000),
    preparationStartAt,
    rawOrder: payload,
    items: items.map(mapItem).filter((item) => item.quantity > 0),
  };
}

function mapItem(value: unknown): ExternalOrderItemDraft {
  const item = asRecord(value);
  const quantity = numberFrom(item.quantity, 1);
  const unitPrice = numberFrom(item.unitPrice ?? item.price, 0);
  const total = numberFrom(item.totalPrice ?? item.total, unitPrice * quantity);
  const options = Array.isArray(item.options)
    ? item.options
        .map((option) => stringFrom(asRecord(option).name, ""))
        .filter(Boolean)
        .join(", ")
    : "";

  return {
    externalItemId: nullableString(item.id),
    name: stringFrom(item.name, "Item iFood"),
    quantity,
    unitPrice,
    total,
    notes: options || nullableString(item.observations),
  };
}

function mapPaymentMethod(order: JsonRecord): PaymentMethod {
  const payments = asRecord(order.payments);
  const methods = Array.isArray(payments.methods) ? payments.methods : [];
  const first = asRecord(methods[0]);
  const method = stringFrom(first.method ?? first.type, "").toUpperCase();

  if (method.includes("PIX")) return PaymentMethod.PIX;
  if (method.includes("CREDIT")) return PaymentMethod.CREDIT_CARD;
  if (method.includes("DEBIT")) return PaymentMethod.DEBIT_CARD;
  if (method.includes("VOUCHER")) return PaymentMethod.VOUCHER;
  if (method.includes("CASH")) return PaymentMethod.CASH;

  return PaymentMethod.CARD_ON_DELIVERY;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringFrom(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberFrom(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : fallback;
  }

  return fallback;
}

function dateFrom(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
