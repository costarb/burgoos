"use client";

import React, { FormEvent, useState } from "react";
import type { PaymentException, PaymentExceptionDetail } from "@burgoos/types";
import { finishPaymentException, getPaymentException, getPaymentExceptions } from "../../../lib/api";

const labels: Record<PaymentException["type"], string> = {
  UNKNOWN_RESULT: "Resultado desconhecido",
  POSSIBLE_DUPLICATE: "Possível duplicidade",
  MANUAL_DIVERGENCE: "Divergência manual",
  REFUND_AFTER_DELIVERY: "Estorno após entrega",
  TOKEN_ERROR: "Erro de credencial",
};

export function PaymentExceptionsClient({
  initialExceptions,
  initialSelected = null,
}: {
  initialExceptions: PaymentException[];
  initialSelected?: PaymentExceptionDetail | null;
}) {
  const [items, setItems] = useState(initialExceptions);
  const [selected, setSelected] = useState<PaymentExceptionDetail | null>(initialSelected);
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "DISMISSED">("OPEN");
  const [resolution, setResolution] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function filter(next: typeof status) {
    setStatus(next);
    setSelected(null);
    setItems(await getPaymentExceptions(next));
  }

  async function select(id: string) {
    setBusy(true);
    setFeedback(null);
    try {
      setSelected(await getPaymentException(id));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível abrir a exceção.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(event: FormEvent, action: "resolve" | "dismiss") {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      await finishPaymentException(selected.id, action, { resolution });
      setItems(await getPaymentExceptions(status));
      setSelected(null);
      setResolution("");
      setFeedback(action === "resolve" ? "Exceção resolvida." : "Exceção descartada.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível finalizar a exceção.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Financeiro</p>
        <h1 className="text-2xl font-semibold text-slate-900">Exceções de pagamento</h1>
        <p className="text-sm text-slate-600">Situações que exigem conferência antes do fechamento.</p>
      </header>
      <div className="flex gap-2">
        {(["OPEN", "RESOLVED", "DISMISSED"] as const).map((value) => (
          <button key={value} className={`rounded-lg px-4 py-2 text-sm font-semibold ${status === value ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`} onClick={() => void filter(value)}>
            {value === "OPEN" ? "Abertas" : value === "RESOLVED" ? "Resolvidas" : "Descartadas"}
          </button>
        ))}
      </div>
      {feedback && <p className="rounded-lg bg-slate-100 p-3 text-sm">{feedback}</p>}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="space-y-3">
          {items.length === 0 && <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Nenhuma exceção neste filtro.</div>}
          {items.map((item) => (
            <button key={item.id} onClick={() => void select(item.id)} className="w-full rounded-xl border bg-white p-4 text-left shadow-sm hover:border-slate-400">
              <div className="flex items-start justify-between gap-3">
                <strong>{labels[item.type]}</strong>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">{item.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {new Date(item.openedAt).toLocaleString("pt-BR")}
                {item.charge ? ` · R$ ${Number(item.charge.amount).toFixed(2)}` : ""}
              </p>
            </button>
          ))}
        </div>
        <aside className="rounded-xl border bg-white p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-slate-500">{busy ? "Carregando..." : "Selecione uma exceção para analisar."}</p>
          ) : (
            <div className="space-y-4">
              <div><h2 className="text-lg font-semibold">{labels[selected.type]}</h2><p className="text-sm text-slate-600">{selected.description}</p></div>
              <div>
                <h3 className="text-sm font-semibold">Histórico</h3>
                <ol className="mt-2 space-y-2">
                  {selected.timeline.map((entry) => (
                    <li key={entry.id} className="border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
                      <strong>{entry.type}</strong> · {new Date(entry.occurredAt).toLocaleString("pt-BR")}
                      {entry.reason && <p>{entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              </div>
              {selected.status === "OPEN" && (
                <form className="space-y-3">
                  <label className="block text-sm font-semibold" htmlFor="resolution">Justificativa</label>
                  <textarea id="resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} className="min-h-24 w-full rounded-lg border p-3 text-sm" />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={(event) => void finish(event, "resolve")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Marcar resolvida</button>
                    <button disabled={busy} onClick={(event) => void finish(event, "dismiss")} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Descartar</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
