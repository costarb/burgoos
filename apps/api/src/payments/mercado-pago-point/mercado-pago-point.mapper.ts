import { PaymentMethod } from "@prisma/client";
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
  /** Method the customer actually used on the terminal, when Mercado Pago reports it. */
  paymentMethod: PaymentMethod | null;
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
    paymentMethod: mapPaymentMethod(payment?.payment_method?.type, payment?.payment_method?.id),
  };
}

/** Mercado Pago payment_method type/id → ERP payment method; null when unknown or not reported yet. */
export function mapPaymentMethod(type?: string, id?: string): PaymentMethod | null {
  const methodType = normalize(type);
  if (normalize(id) === "pix" || methodType === "bank_transfer") return PaymentMethod.PIX;
  if (methodType === "credit_card") return PaymentMethod.CREDIT_CARD;
  if (methodType === "debit_card" || methodType === "prepaid_card") return PaymentMethod.DEBIT_CARD;
  if (methodType === "voucher_card") return PaymentMethod.VOUCHER;
  if (methodType === "account_money" || methodType === "digital_wallet") return PaymentMethod.DIGITAL_WALLET;
  return null;
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
