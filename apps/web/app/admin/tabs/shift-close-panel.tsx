"use client";

import { useState } from "react";
import type { ShiftCloseSummary } from "@burgoos/types";
import { getShiftCloseSummary } from "../../../lib/api";

export function ShiftClosePanel({ initialSummary }: { initialSummary: ShiftCloseSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try { setSummary(await getShiftCloseSummary()); } finally { setBusy(false); }
  }
  return (
    <section className={`mx-6 mt-6 rounded-xl border p-4 ${summary.canClose ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Conferência de fechamento</h2>
          <p className="text-sm text-slate-600">{summary.canClose ? "Nenhuma pendência operacional identificada." : "Revise as pendências antes de encerrar o turno."}</p>
        </div>
        <button disabled={busy} onClick={() => void refresh()} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">Atualizar</button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        <div><dt>Comandas abertas</dt><dd className="text-lg font-bold">{summary.openTabs}</dd></div>
        <div><dt>Pedidos ativos</dt><dd className="text-lg font-bold">{summary.activeOrders}</dd></div>
        <div><dt>Cobranças inconclusivas</dt><dd className="text-lg font-bold">{summary.inconclusiveCharges}</dd></div>
        <div><dt>Exceções abertas</dt><dd className="text-lg font-bold">{summary.openExceptions}</dd></div>
      </dl>
    </section>
  );
}
