import { ProviderMovement } from "../sales-provider.adapter";
import { MercadoPagoPayment } from "./mercado-pago.types";

const SALE_OPERATION_TYPES = new Set(["regular_payment", "pos_payment", "recurring_payment"]);

export function mapMercadoPagoPayment(payment: MercadoPagoPayment): ProviderMovement {
  const id = String(payment.id);
  const raw = redactPayment(payment);
  if (
    !payment.operation_type ||
    !SALE_OPERATION_TYPES.has(payment.operation_type) ||
    isSameOwnerTransfer(payment)
  )
    return {
      providerMovementId: id,
      externalSaleId: id,
      externalEventCode: payment.status,
      kind: "NON_SALE",
      sale: null,
      raw,
      rejectionCode: "NON_SALE_OPERATION",
      rejectionMessage: "Movimento Mercado Pago sem origem em venda reconhecida",
    };
  if (payment.status !== "approved")
    return {
      providerMovementId: id,
      externalSaleId: id,
      externalEventCode: payment.status,
      kind: "NON_SALE",
      sale: null,
      raw,
    };
  const method = mapMethod(payment.payment_type_id, payment.payment_method_id);
  const businessDate = payment.money_release_date ?? payment.date_created;
  if (
    !method ||
    !businessDate ||
    !Number.isFinite(payment.transaction_amount) ||
    payment.transaction_amount <= 0
  )
    return {
      providerMovementId: id,
      externalSaleId: id,
      externalEventCode: payment.status,
      kind: "SALE",
      sale: null,
      raw,
      rejectionCode: "INVALID_SALE",
      rejectionMessage: "Pagamento aprovado sem data, valor ou meio compativel",
    };
  const gross = payment.transaction_amount;
  const fee = (payment.fee_details ?? []).reduce(
    (total, item) => total + (Number(item.amount) || 0),
    0
  );
  return {
    providerMovementId: id,
    externalSaleId: id,
    externalEventCode: payment.status,
    kind: "SALE",
    raw,
    sale: {
      provider: "MERCADO_PAGO",
      channel: "API",
      providerMovementId: id,
      externalSaleId: id,
      externalEventCode: payment.status,
      occurredAt: normalizeProviderDateTime(businessDate),
      grossAmount: gross,
      feeAmount: fee,
      netAmount: payment.transaction_details?.net_received_amount ?? gross - fee,
      paymentMethod: method,
      installments: Math.max(1, payment.installments ?? 1),
      paymentBrand: payment.payment_method_id,
      expectedReleaseAt: payment.money_release_date
        ? normalizeProviderDateTime(payment.money_release_date)
        : undefined,
      raw,
    },
  };
}

function isSameOwnerTransfer(payment: MercadoPagoPayment): boolean {
  return (
    payment.additional_info?.bank_info?.is_same_bank_account_owner === true ||
    payment.point_of_interaction?.transaction_data?.bank_info?.is_same_bank_account_owner === true
  );
}

function normalizeProviderDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function mapMethod(type?: string, method?: string) {
  if (type === "credit_card") return "CREDIT_CARD" as const;
  if (type === "prepaid_card") return "CREDIT_CARD" as const;
  if (type === "debit_card") return "DEBIT_CARD" as const;
  if (type === "account_money") return "DIGITAL_WALLET" as const;
  if (type === "bank_transfer" && method === "pix") return "PIX" as const;
  if (method === "pix") return "PIX" as const;
  return null;
}

function redactPayment(payment: MercadoPagoPayment): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(payment)) as Record<string, unknown>;
  for (const key of ["card", "payer", "collector", "binary_mode", "metadata"]) delete copy[key];
  return copy;
}
