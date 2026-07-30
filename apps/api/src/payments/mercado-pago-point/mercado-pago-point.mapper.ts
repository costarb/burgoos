import { ChargeStatus } from "../application/charge-status";
import { MercadoPagoPointOrder } from "./mercado-pago-point.types";

export interface MappedPointOrder {
  status: ChargeStatus;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  providerTransactionId: string | null;
  paidAmount: string | null;
  refundedAmount: string | null;
  paymentMethodType: string | null;
}

export function mapPointOrder(order: MercadoPagoPointOrder): MappedPointOrder {
  const payment = order.transactions?.payments?.[0];
  const status = normalize(order.status);
  const detail = normalize(order.status_detail);
  const transactionStatus = normalize(payment?.status);
  const transactionDetail = normalize(payment?.status_detail);

  return {
    status: mapStatus(status, detail, transactionStatus, transactionDetail),
    providerStatus: order.status ?? payment?.status ?? null,
    providerStatusDetail: order.status_detail ?? payment?.status_detail ?? null,
    providerTransactionId: payment?.id ?? null,
    paidAmount: payment?.paid_amount ?? null,
    refundedAmount: payment?.refunded_amount ?? null,
    paymentMethodType: payment?.payment_method?.type ?? null,
  };
}

function mapStatus(
  orderStatus: string,
  orderDetail: string,
  transactionStatus: string,
  transactionDetail: string,
): ChargeStatus {
  const combined = `${orderStatus}/${orderDetail}/${transactionStatus}/${transactionDetail}`;
  if (combined.includes("partially_refunded")) return "PARTIALLY_REFUNDED";
  if (orderStatus === "refunded" || transactionStatus === "refunded") return "REFUNDED";
  if (
    transactionStatus === "accredited" ||
    transactionStatus === "approved" ||
    (orderStatus === "processed" && !combined.includes("failed"))
  ) return "APPROVED";
  if (orderStatus === "expired" || transactionStatus === "expired") return "EXPIRED";
  if (orderStatus === "cancelled" || orderStatus === "canceled" || transactionStatus === "cancelled") return "CANCELLED";
  if (orderStatus === "at_terminal" || transactionStatus === "at_terminal") return "PROCESSING";
  if (orderStatus === "action_required" && orderDetail === "waiting_payment") return "WAITING_CUSTOMER";
  if (orderStatus === "action_required" && orderDetail === "check_on_terminal") return "UNKNOWN";
  if (orderStatus === "failed" && combined.match(/rejected|declined/)) return "DECLINED";
  if (orderStatus === "failed" || transactionStatus === "failed") return "FAILED";
  if (orderStatus === "created") return "CREATED";
  return "UNKNOWN";
}

function normalize(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}
