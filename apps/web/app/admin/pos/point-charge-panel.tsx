"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PaymentCharge, PaymentTerminal } from "@burgoos/types";
import {
  cancelPaymentCharge,
  createPaymentCharge,
  getPaymentTerminals,
  getActivePaymentCharge,
  setPaymentTerminalEnabled,
  syncPaymentTerminals,
} from "../../../lib/api";
import { usePaymentCharge } from "./use-payment-charge";

export function PointChargePanel({
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
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [terminalId, setTerminalId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingTerminals, setLoadingTerminals] = useState(true);
  const [terminalsLoaded, setTerminalsLoaded] = useState(false);
  const { charge, setCharge } = usePaymentCharge(null);
  const approvalNotified = useRef(false);

  useEffect(() => {
    if (charge?.status === "APPROVED" && !approvalNotified.current) {
      approvalNotified.current = true;
      onApproved?.();
    }
  }, [charge?.status, onApproved]);

  useEffect(() => {
    setLoadingTerminals(true);
    void Promise.all([
      getPaymentTerminals(),
      getActivePaymentCharge(targetType, targetId),
    ]).then(([items, activeCharge]) => {
      setTerminals(items);
      setTerminalsLoaded(true);
      setTerminalId(items.find((item) => item.enabled)?.id ?? "");
      if (activeCharge) setCharge(activeCharge);
    }).catch((error) => {
      setFeedback(error instanceof Error
        ? error.message
        : "Nao foi possivel carregar as maquininhas.");
    }).finally(() => setLoadingTerminals(false));
  }, [targetId, targetType, setCharge]);

  async function synchronize() {
    setBusy(true);
    try {
      const items = await syncPaymentTerminals();
      setTerminals(items);
      setTerminalsLoaded(true);
      setTerminalId(items.find((item) => item.enabled)?.id ?? "");
      setFeedback(items.length === 0
        ? "O Mercado Pago respondeu sem maquininhas ativas para a conta conectada. Confira se o token pertence a conta da Point e se o modelo e compativel com a API Orders."
        : "Maquininhas sincronizadas. Habilite uma que esteja em modo PDV.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao sincronizar maquininhas.");
    } finally {
      setBusy(false);
    }
  }

  async function chargeOrder() {
    if (!terminalId) return;
    setBusy(true);
    setFeedback(null);
    try {
      setCharge(await createPaymentCharge({
        targetType,
        targetId,
        institution: "MERCADO_PAGO",
        method: "DEBIT_CARD",
        mode: "AUTOMATIC",
        amount,
        terminalId,
      }, crypto.randomUUID()));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao enviar cobranca.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTerminal(terminal: PaymentTerminal) {
    setBusy(true);
    try {
      const updated = await setPaymentTerminalEnabled(terminal.id, !terminal.enabled);
      setTerminals((current) =>
        current.map((candidate) => candidate.id === updated.id ? updated : candidate),
      );
      if (updated.enabled) setTerminalId(updated.id);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao habilitar maquininha.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!charge) return;
    setBusy(true);
    try {
      setCharge(await cancelPaymentCharge(charge.id));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao cancelar cobranca.");
    } finally {
      setBusy(false);
    }
  }

  const enabled = terminals.filter((terminal) => terminal.enabled);
  return (
    <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h3 className="font-semibold text-blue-950">Cobrar no Mercado Pago Point</h3>
      {!charge ? (
        <>
          <select className="mt-3 min-h-12 w-full rounded-lg border bg-white px-3" onChange={(event) => setTerminalId(event.target.value)} value={terminalId}>
            <option value="">
              {loadingTerminals ? "Carregando maquininhas..." : "Selecione a maquininha"}
            </option>
            {enabled.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.displayName}</option>)}
          </select>
          {!loadingTerminals && terminalsLoaded && terminals.length === 0 ? (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
              Nenhuma maquininha sincronizada. Clique em Sincronizar para consultar a conta Mercado Pago conectada.
            </p>
          ) : null}
          {!loadingTerminals && terminals.length > 0 && enabled.length === 0 ? (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">
              Foram encontradas {terminals.length} maquininha(s), mas nenhuma esta habilitada em modo PDV.
            </p>
          ) : null}
          {terminals.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs text-blue-950">
              {terminals.map((terminal) => (
                <label className="flex items-center justify-between rounded bg-white px-2 py-1" key={terminal.id}>
                  <span>{terminal.displayName} · {terminal.operatingMode ?? "modo desconhecido"}</span>
                  <input
                    checked={terminal.enabled}
                    disabled={busy || terminal.operatingMode?.toUpperCase() !== "PDV"}
                    onChange={() => toggleTerminal(terminal)}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button className="min-h-12 flex-1 rounded-lg bg-blue-800 px-3 font-semibold text-white disabled:opacity-50" disabled={busy || !terminalId} onClick={chargeOrder} type="button">
              Enviar R$ {amount} para a Point
            </button>
            <button className="rounded-lg border bg-white px-3 font-semibold" disabled={busy} onClick={synchronize} type="button">Sincronizar</button>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-lg bg-white p-3">
          <strong>{statusLabel(charge)}</strong>
          <p className="mt-1 text-sm">Valor: R$ {charge.amount}</p>
          {["CREATED", "WAITING_CUSTOMER", "PROCESSING", "UNKNOWN"].includes(charge.status) ? (
            <button className="mt-3 rounded border border-red-300 px-3 py-2 text-sm font-semibold text-red-700" disabled={busy} onClick={cancel} type="button">Cancelar cobranca</button>
          ) : charge.status !== "APPROVED" ? (
            <button className="mt-3 rounded border px-3 py-2 text-sm font-semibold" onClick={() => setCharge(null)} type="button">Tentar novamente</button>
          ) : null}
        </div>
      )}
      {feedback ? <p className="mt-2 text-sm text-blue-950">{feedback}</p> : null}
    </section>
  );
}

function statusLabel(charge: PaymentCharge) {
  const labels: Record<string, string> = {
    CREATED: "Cobranca criada",
    WAITING_CUSTOMER: "Aguardando pagamento na maquininha",
    PROCESSING: "Pagamento em processamento",
    APPROVED: "Pagamento aprovado",
    DECLINED: "Pagamento recusado",
    CANCELLED: "Cobranca cancelada",
    EXPIRED: "Cobranca expirada",
    FAILED: "Falha na cobranca",
    UNKNOWN: "Confirme o resultado na maquininha",
  };
  return labels[charge.status] ?? charge.status;
}
