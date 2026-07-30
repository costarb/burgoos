"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  ManualPaymentOption,
  PaymentInstitution,
  PaymentMethod,
} from "@burgoos/types";
import {
  confirmManualPayment,
  getManualPaymentOptions,
} from "../../../lib/api";

export function calculateCashChange(amount: string, received: string) {
  const chargeCents = moneyToCents(amount);
  const cashCents = moneyToCents(received);
  if (chargeCents === null || cashCents === null || cashCents < chargeCents) return null;
  return ((cashCents - chargeCents) / 100).toFixed(2);
}

function moneyToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimals = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function ManualPaymentPanel({
  targetType,
  targetId,
  amount,
  onApproved,
}: {
  targetType: "ORDER" | "SERVICE_TAB";
  targetId: string;
  amount: string;
  onApproved?: () => void;
}) {
  const [options, setOptions] = useState<ManualPaymentOption[]>([]);
  const [institution, setInstitution] = useState<PaymentInstitution | "">("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [cashReceived, setCashReceived] = useState("");
  const [reference, setReference] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    void getManualPaymentOptions()
      .then((available) => {
        setOptions(available);
        const preferred = available.find(
          (item) => item.institution === "CAIXA_LOCAL",
        ) ?? available[0];
        if (preferred) {
          setInstitution(preferred.institution);
          setMethod(preferred.methods[0] ?? "");
        }
      })
      .catch((error) => {
        setFeedback(error instanceof Error ? error.message : "Falha ao carregar formas de pagamento.");
      });
  }, []);

  const selected = useMemo(
    () => options.find((option) => option.institution === institution),
    [institution, options],
  );
  const isCash = method === "CASH";
  const change = isCash ? calculateCashChange(amount, cashReceived) : null;

  function selectInstitution(value: PaymentInstitution) {
    setInstitution(value);
    const option = options.find((candidate) => candidate.institution === value);
    setMethod(option?.methods[0] ?? "");
    setCashReceived("");
    setReference("");
    setFeedback(null);
  }

  async function confirm() {
    if (!institution || !method || (isCash && change === null)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const charge = await confirmManualPayment({
        targetType,
        targetId,
        institution,
        method,
        amount,
        cashReceivedAmount: isCash
          ? Number(cashReceived.replace(",", ".")).toFixed(2)
          : undefined,
        manualReference: reference.trim() || undefined,
      }, crypto.randomUUID());
      setApproved(true);
      setFeedback(
        charge.cashChangeAmount && Number(charge.cashChangeAmount) > 0
          ? `Pagamento confirmado. Troco: R$ ${charge.cashChangeAmount}`
          : "Pagamento confirmado e saldo quitado.",
      );
      onApproved?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao confirmar pagamento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="font-semibold text-emerald-950">Registrar pagamento manual</h3>
      <p className="mt-1 text-xs text-emerald-900">
        Use para Caixa local, PagBank ou outra instituição habilitada.
      </p>
      {!approved ? (
        <>
          <label className="mt-3 block text-sm font-medium">
            Instituição
            <select
              className="mt-1 min-h-12 w-full rounded-lg border bg-white px-3"
              onChange={(event) => selectInstitution(event.target.value as PaymentInstitution)}
              value={institution}
            >
              <option value="">Selecione</option>
              {options.map((option) => (
                <option key={option.institution} value={option.institution}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium">
            Forma de pagamento
            <select
              className="mt-1 min-h-12 w-full rounded-lg border bg-white px-3"
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              value={method}
            >
              <option value="">Selecione</option>
              {(selected?.methods ?? []).map((candidate) => (
                <option key={candidate} value={candidate}>
                  {paymentMethodLabel(candidate)}
                </option>
              ))}
            </select>
          </label>
          {isCash ? (
            <label className="mt-3 block text-sm font-medium">
              Valor recebido
              <input
                className="mt-1 min-h-12 w-full rounded-lg border bg-white px-3"
                inputMode="decimal"
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder={`Mínimo R$ ${amount}`}
                value={cashReceived}
              />
              <span className="mt-1 block text-sm font-semibold text-emerald-950">
                Troco: {change === null ? "informe um valor válido" : `R$ ${change}`}
              </span>
            </label>
          ) : (
            <label className="mt-3 block text-sm font-medium">
              Referência da maquininha (opcional)
              <input
                className="mt-1 min-h-12 w-full rounded-lg border bg-white px-3"
                maxLength={100}
                onChange={(event) => setReference(event.target.value)}
                value={reference}
              />
            </label>
          )}
          <button
            className="mt-4 min-h-12 w-full rounded-lg bg-emerald-700 px-3 font-semibold text-white disabled:opacity-50"
            disabled={busy || !institution || !method || (isCash && change === null)}
            onClick={confirm}
            type="button"
          >
            {busy ? "Confirmando..." : `Confirmar pagamento de R$ ${amount}`}
          </button>
        </>
      ) : null}
      {feedback ? <p className="mt-3 text-sm font-medium text-emerald-950">{feedback}</p> : null}
    </section>
  );
}

function paymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Dinheiro",
    PIX_MANUAL: "Pix manual",
    CARD_ON_DELIVERY: "Cartão",
    DEBIT_CARD: "Débito",
    CREDIT_CARD: "Crédito",
    VOUCHER: "Voucher",
    PIX: "Pix",
    DIGITAL_WALLET: "Carteira digital",
  };
  return labels[method];
}
