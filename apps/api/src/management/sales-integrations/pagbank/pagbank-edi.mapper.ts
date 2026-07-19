import type { PaymentMethod } from "@prisma/client";
import { ProviderMovement } from "../sales-provider.adapter";
import { PagBankEdiMovement } from "./pagbank-edi.types";

const NON_SALE_EVENTS = new Set(["2", "3", "4", "5", "6", "7", "8", "9"]);

function paymentMethod(code: string): PaymentMethod | null {
  const normalized = code.trim().toUpperCase();
  if (["11", "PIX"].includes(normalized)) return "PIX";
  if (["1", "2", "CREDIT", "CREDITO"].includes(normalized)) return "CREDIT_CARD";
  if (["3", "DEBIT", "DEBITO"].includes(normalized)) return "DEBIT_CARD";
  if (["BOLETO", "BOL"].includes(normalized)) return "PIX_MANUAL";
  return null;
}

export function mapPagBankMovement(item: PagBankEdiMovement): ProviderMovement {
  const eventCode = String(item.tipo_evento ?? "").trim();
  const movementId = String(item.movimento_api_codigo ?? "").trim();
  const externalSaleId = String(item.codigo_transacao ?? "").trim() || null;
  if (NON_SALE_EVENTS.has(eventCode)) {
    return { providerMovementId: movementId, externalSaleId, externalEventCode: eventCode, kind: "NON_SALE", sale: null, raw: item };
  }
  if (eventCode !== "1") {
    return { providerMovementId: movementId, externalSaleId, externalEventCode: eventCode, kind: "UNKNOWN", sale: null, raw: item, rejectionCode: "UNKNOWN_EVENT", rejectionMessage: "Evento EDI nao reconhecido" };
  }
  const method = paymentMethod(String(item.meio_pagamento ?? item.arranjo_ur ?? ""));
  const gross = Number(item.valor_total_transacao);
  const date = String(item.data_inicial_transacao ?? item.data_venda_ajuste ?? "");
  const time = String(item.hora_inicial_transacao ?? item.hora_venda_ajuste ?? "00:00:00");
  if (!movementId || !externalSaleId || !method || !date || !Number.isFinite(gross) || gross <= 0) {
    return { providerMovementId: movementId || `${externalSaleId ?? "unknown"}-${date}`, externalSaleId, externalEventCode: eventCode, kind: "SALE", sale: null, raw: item, rejectionCode: "INVALID_SALE", rejectionMessage: "Venda sem identificador, data, valor ou meio de pagamento valido" };
  }
  const fee = Number(item.taxa_intermediacao ?? 0) + Number(item.tarifa_intermediacao ?? 0);
  return {
    providerMovementId: movementId,
    externalSaleId,
    externalEventCode: eventCode,
    kind: "SALE",
    raw: item,
    sale: {
      provider: "PAGBANK", channel: "API", providerMovementId: movementId, externalSaleId,
      externalEventCode: eventCode, occurredAt: `${date}T${time}`, grossAmount: gross,
      netAmount: Number(item.valor_liquido_transacao ?? gross - fee), feeAmount: fee,
      paymentMethod: method as "PIX" | "PIX_MANUAL" | "DEBIT_CARD" | "CREDIT_CARD",
      installments: Math.max(1, Number(item.quantidade_parcelas ?? 1)), paymentBrand: item.arranjo_ur, raw: item,
    },
  };
}
