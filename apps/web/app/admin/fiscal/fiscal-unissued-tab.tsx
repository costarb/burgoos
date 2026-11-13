"use client";

import React, { useEffect, useState } from "react";
import type { FiscalDocumentDetail, FiscalUnissuedSale } from "@rrfive/types";
import { ReceiptText, RefreshCw } from "lucide-react";
import { FISCAL_STATUS, formatDateTime, formatMoney, type FiscalActionState } from "./fiscal-labels";

export interface FiscalUnissuedActions {
  loadUnissued: (date: string) => Promise<FiscalActionState<FiscalUnissuedSale[]>>;
  emitSale: (target: FiscalUnissuedSale["target"], confirmRetroactive?: boolean) => Promise<FiscalActionState<FiscalDocumentDetail>>;
}

interface Props {
  initialSales: FiscalUnissuedSale[];
  today: string;
  emissionMode: "AUTOMATIC" | "MANUAL";
  enabled: boolean;
  actions: FiscalUnissuedActions;
  busy: boolean;
  run: <T>(action: () => Promise<FiscalActionState<T>>, onSuccess?: (data: T) => void) => Promise<void>;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  PIX_MANUAL: "Pix",
  DEBIT_CARD: "Debito",
  CREDIT_CARD: "Credito",
  VOUCHER: "Vale-refeicao",
  DIGITAL_WALLET: "Carteira digital",
  CARD_ON_DELIVERY: "Cartao na entrega",
};
const SOURCE_LABELS: Record<string, string> = { COUNTER: "Balcao", IMPORT: "Importada", API: "API" };

/** Paid sales without NFC-e, with the manual "Emitir NFC-e" action. */
export function FiscalUnissuedTab({ initialSales, today, emissionMode, enabled, actions, busy, run }: Props) {
  const [sales, setSales] = useState(initialSales);
  const [date, setDate] = useState(today);

  useEffect(() => setSales(initialSales), [initialSales]);

  function load(day = date) {
    return run(() => actions.loadUnissued(day), setSales);
  }

  function emit(sale: FiscalUnissuedSale) {
    const retroactive = date < today;
    if (retroactive && !window.confirm("Venda de dia anterior: a SEFAZ pode rejeitar a emissao retroativa. Emitir mesmo assim?")) return;
    return run(
      () => actions.emitSale(sale.target, retroactive),
      () => setSales((current) => current.filter((item) => item.target.id !== sale.target.id))
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold">Vendas sem NFC-e</h2>
          <p className="mt-1 text-sm text-slate-600">
            {emissionMode === "AUTOMATIC"
              ? "Vendas pagas que ainda nao tem nota. No modo automatico elas costumam sair em ate 1 minuto; use Emitir para adiantar."
              : "Modo manual: emita a NFC-e de cada venda paga por aqui."}
          </p>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label className="text-xs text-slate-600">
            Data da venda
            <input aria-label="Data da venda" className="mt-1 block rounded-md border border-slate-300 px-3 py-2 text-sm" max={today} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
          <button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy} type="submit">
            <RefreshCw aria-hidden className="h-4 w-4" /> Atualizar
          </button>
        </form>
      </div>

      {!enabled ? (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">A emissao esta desativada. Ative em Configuracao para emitir.</p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Venda</th>
              <th>Origem</th>
              <th>Horario</th>
              <th>Pagamento</th>
              <th>Valor</th>
              <th className="text-right">Acao</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-500" colSpan={6}>
                  Nenhuma venda paga sem NFC-e nesta data.
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr className="border-t border-slate-100" data-testid="fiscal-unissued-row" key={sale.target.id}>
                  <td className="py-2 font-medium">
                    {sale.target.type === "TAB" ? "Comanda" : "Pedido"} {sale.publicCode ?? sale.target.id.slice(0, 8)}
                    {sale.lastAttempt ? (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${FISCAL_STATUS[sale.lastAttempt].classes}`}>
                        tentativa anterior: {FISCAL_STATUS[sale.lastAttempt].label}
                      </span>
                    ) : null}
                  </td>
                  <td>{SOURCE_LABELS[sale.source] ?? sale.source}</td>
                  <td>{formatDateTime(sale.saleOccurredAt)}</td>
                  <td>{sale.paymentMethods.map((method) => PAYMENT_LABELS[method] ?? method).join(", ") || "-"}</td>
                  <td>{formatMoney(sale.totalAmount)}</td>
                  <td className="text-right">
                    <button
                      className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={busy || !enabled}
                      onClick={() => void emit(sale)}
                      type="button"
                    >
                      <ReceiptText aria-hidden className="h-3.5 w-3.5" /> Emitir NFC-e
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
