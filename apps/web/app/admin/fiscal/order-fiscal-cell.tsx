"use client";

import React, { useState } from "react";
import type { FiscalDocumentDetail, OrderFiscalInfo } from "@rrfive/types";
import { FileCode2, Printer, ReceiptText } from "lucide-react";
import { FISCAL_STATUS, PENDING_REASON, type FiscalActionState } from "./fiscal-labels";

interface Props {
  orderId: string;
  saleDate: string;
  info: OrderFiscalInfo;
  emitAction: (orderId: string, confirmRetroactive?: boolean) => Promise<FiscalActionState<FiscalDocumentDetail>>;
}

const linkClass = "inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50";

function isPreviousDay(saleDate: string): boolean {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  return day(new Date(saleDate)) < day(new Date());
}

/** Fiscal status of an order with the manual emission action and document links. */
export function OrderFiscalCell({ orderId, saleDate, info: initialInfo, emitAction }: Props) {
  const [info, setInfo] = useState(initialInfo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const status = FISCAL_STATUS[info.status];
  const canEmit = info.status === "NOT_ISSUED" || info.status === "REJECTED";

  async function emit() {
    const retroactive = isPreviousDay(saleDate);
    if (retroactive && !window.confirm("Venda de dia anterior: a SEFAZ pode rejeitar a emissao retroativa. Emitir mesmo assim?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await emitAction(orderId, retroactive);
      setMessage({ ok: result.status === "success", text: result.message ?? "" });
      if (result.status === "success" && result.data) {
        setInfo({ ...info, status: result.data.status, documentId: result.data.id, number: result.data.number, pendingReason: result.data.pendingReason });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="order-fiscal-cell">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${status.classes}`}>
        <ReceiptText aria-hidden className="h-3 w-3" /> NFC-e: {status.label}
        {info.number ? ` nº ${info.number}` : ""}
      </span>
      {info.pendingReason ? <span className="text-xs text-slate-600">{PENDING_REASON[info.pendingReason]}</span> : null}
      {info.documentId && (info.status === "AUTHORIZED" || info.status === "CANCEL_PENDING" || info.status === "CANCELLED") ? (
        <>
          <a className={linkClass} href={`/api/admin/fiscal/documents/${info.documentId}/danfe`} rel="noreferrer" target="_blank">
            <Printer aria-hidden className="h-3.5 w-3.5" /> DANFE
          </a>
          <a className={linkClass} href={`/api/admin/fiscal/documents/${info.documentId}/xml`}>
            <FileCode2 aria-hidden className="h-3.5 w-3.5" /> XML
          </a>
        </>
      ) : null}
      {canEmit ? (
        <button className={`${linkClass} disabled:opacity-50`} disabled={busy} onClick={() => void emit()} type="button">
          {info.status === "REJECTED" ? "Emitir novamente" : "Emitir NFC-e"}
        </button>
      ) : null}
      {message ? <span className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span> : null}
    </div>
  );
}
