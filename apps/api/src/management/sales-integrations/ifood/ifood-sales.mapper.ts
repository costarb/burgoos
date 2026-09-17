import { ProviderMovement } from "../sales-provider.adapter";
import { IfoodFinancialSale, IfoodPaymentMethod } from "./ifood-financial.types";

const PAYMENT_METHODS = {
  CASH: "CASH",
  PIX: "PIX",
  PIX_MANUAL: "PIX_MANUAL",
  CARD_ON_DELIVERY: "CARD_ON_DELIVERY",
  DEBIT: "DEBIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  CREDIT: "CREDIT_CARD",
  CREDIT_CARD: "CREDIT_CARD",
  MEAL_VOUCHER: "VOUCHER",
  FOOD_VOUCHER: "VOUCHER",
  VOUCHER: "VOUCHER",
  DIGITAL_WALLET: "DIGITAL_WALLET",
  WALLET: "DIGITAL_WALLET",
} as const;

export function mapIfoodSale(sale: IfoodFinancialSale): ProviderMovement {
  const raw = redact(sale) as Record<string, unknown>;
  if (sale.currentStatus !== "CONCLUDED") {
    return rejected(
      sale,
      raw,
      sale.currentStatus === "CANCELLED" ? "CANCELLED_SALE" : "UNKNOWN_STATUS",
      sale.currentStatus === "CANCELLED" ? "Venda iFood cancelada" : "Status iFood desconhecido"
    );
  }
  const methods = sale.payments.methods.map(rawMethod);
  const mapped = methods.map((method) => PAYMENT_METHODS[method as keyof typeof PAYMENT_METHODS]);
  const unknownPaymentMethods = methods.filter((_, index) => !mapped[index]);
  const primaryKnownIndex = mapped.findIndex(Boolean);
  if (primaryKnownIndex < 0) {
    return rejected(sale, raw, "UNKNOWN_PAYMENT_METHOD", "Meio de pagamento iFood desconhecido");
  }
  const primary = sale.payments.methods[primaryKnownIndex];
  const customerPaid = sale.payments.methods.reduce((sum, method) => sum + (method.value ?? 0), 0);
  const normalizedPayments = sale.payments.methods.map((payment, index) => {
    const providerMethod = methods[index] ?? "UNKNOWN";
    const installments = payment.installment?.installmentDetail ?? [];
    return {
      providerPaymentKey: `${index}:${providerMethod}:${(payment.value ?? 0).toFixed(2)}`,
      providerMethod,
      mappedMethod: mapped[index] ?? null,
      paymentType: payment.type ?? null,
      liability: payment.liability ?? "UNKNOWN",
      amount: payment.value ?? 0,
      currency: payment.currency ?? "BRL",
      brand: payment.card?.brand ?? null,
      nsuMasked: mask(payment.transaction?.nsu),
      acquirerDocumentMasked: mask(payment.transaction?.acquirerDocument),
      installments: installments.map((installment, installmentIndex) => ({
        reference: String(installment.reference ?? installmentIndex + 1),
        sequence: positiveInteger(installment.sequence) ?? installmentIndex + 1,
        amount: installment.amount ?? 0,
        expectedPaymentDate: installment.expectedPaymentDate ?? null,
        status: installment.status ?? null,
        settledAt: installment.settledAt ?? null,
      })),
    };
  });
  const ifoodReceivableAmount = normalizedPayments
    .filter((payment) => payment.liability === "IFOOD")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const storeReceivedAmount = normalizedPayments
    .filter((payment) => payment.liability === "STORE")
    .reduce((sum, payment) => sum + payment.amount, 0);
  return {
    providerMovementId: sale.id,
    externalSaleId: sale.id,
    externalEventCode: sale.currentStatus,
    kind: "SALE",
    sale: {
      provider: "IFOOD",
      channel: "API",
      providerMovementId: sale.id,
      externalSaleId: sale.id,
      externalEventCode: sale.currentStatus,
      occurredAt: sale.createdAt,
      grossAmount: sale.saleGrossValue.bag,
      netAmount: sale.billingSummary.saleBalance,
      feeAmount: customerPaid - sale.billingSummary.saleBalance,
      paymentMethod: mapped[primaryKnownIndex]!,
      providerMethod: methods.join(","),
      installments: primary.installment?.maxInstallments,
      paymentBrand: primary.card?.brand,
      financial: {
        bagAmount: sale.saleGrossValue.bag,
        deliveryFeeAmount: sale.saleGrossValue.deliveryFee ?? 0,
        serviceFeeAmount: sale.saleGrossValue.serviceFee ?? 0,
        benefitsAmount: sale.benefits?.totalValue ?? 0,
        customerPaidAmount: customerPaid,
        saleBalanceAmount: sale.billingSummary.saleBalance,
        ifoodReceivableAmount,
        storeReceivedAmount,
      },
      payments: normalizedPayments,
      mappingState: {
        reviewRequired: unknownPaymentMethods.length > 0,
        unknownPaymentMethods,
      },
      raw,
    },
    raw,
  };
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function mask(value: string | undefined): string | null {
  if (!value) return null;
  const suffix = value.replace(/\D/g, "").slice(-4);
  return suffix ? `****${suffix}` : "********";
}

export function merchantDate(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function rawMethod(payment: IfoodPaymentMethod): string {
  return typeof payment.method === "string" ? payment.method : String(payment.method.method ?? "");
}

function rejected(
  sale: IfoodFinancialSale,
  raw: Record<string, unknown>,
  rejectionCode: string,
  rejectionMessage: string
): ProviderMovement {
  return {
    providerMovementId: sale.id,
    externalSaleId: sale.id,
    externalEventCode: sale.currentStatus,
    kind: "UNKNOWN",
    sale: null,
    raw,
    rejectionCode,
    rejectionMessage,
  };
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /document|nsu|bank|account|token|secret/i.test(key) ? "********" : redact(item),
    ])
  );
}
