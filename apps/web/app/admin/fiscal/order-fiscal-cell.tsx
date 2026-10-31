"use client";

import React, { useEffect, useState } from "react";
import type { FiscalDocumentDetail, OrderFiscalInfo } from "@rrfive/types";
import { FileCode2, MessageCircle, Printer, ReceiptText } from "lucide-react";
import { FISCAL_STATUS, PENDING_REASON, type FiscalActionState } from "./fiscal-labels";

interface Props {
  saleDate: string;
  info: OrderFiscalInfo;
  emitAction: (target: OrderFiscalInfo["target"], confirmRetroactive?: boolean) => Promise<FiscalActionState<FiscalDocumentDetail>>;
}

const BLOCKED_REASON: Record<NonNullable<OrderFiscalInfo["blockedReason"]>, string> = {
  NOT_PAID: "Aguardando pagamento",
  TAB_NOT_PAID: "Comanda ainda nao paga",
  DISABLED: "Emissao desativada",
  CANCELLED: "Pedido cancelado",
};

const linkClass = "inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50";

/** wa.me share text with the public SEFAZ consultation (the operator picks the contact). */
export function whatsAppShareUrl(info: OrderFiscalInfo): string | null {
  if (info.status !== "AUTHORIZED" || !info.consultationUrl || !info.accessKey) return null;
  const text = [
    `Sua NFC-e${info.number ? ` nº ${info.number}` : ""} foi emitida.`,
    `Consulte em ${info.consultationUrl}`,
    `Chave de acesso: ${info.accessKey.replace(/(\d{4})(?=\d)/g, "$1 ")}`,
  ].join("\n");
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function isPreviousDay(saleDate: string): boolean {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  return day(new Date(saleDate)) < day(new Date());
}

/** Fiscal status of an order with the manual emission action and document links. */
export function OrderFiscalCell({ saleDate, info: initialInfo, emitAction }: Props) {
  const [info, setInfo] = useState(initialInfo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setInfo(initialInfo), [initialInfo]);
  const status = FISCAL_STATUS[info.status];
  const isTab = info.target.type === "TAB";

  async function emit() {
    const retroactive = isPreviousDay(saleDate);
    if (retroactive && !window.confirm("Venda de dia anterior: a SEFAZ pode rejeitar a emissao retroativa. Emitir mesmo assim?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await emitAction(info.target, retroactive);
      setMessage({ ok: result.status === "success", text: result.message ?? "" });
      if (result.status === "success" && result.data) {
        setInfo({ ...info, status: result.data.status, documentId: result.data.id, number: result.data.number, pendingReason: result.data.pendingReason, canEmit: false, blockedReason: null });
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
          {whatsAppShareUrl(info) ? (
            <a className={linkClass} href={whatsAppShareUrl(info) as string} rel="noreferrer" target="_blank">
              <MessageCircle aria-hidden className="h-3.5 w-3.5" /> WhatsApp
            </a>
          ) : null}
        </>
      ) : null}
      {info.canEmit ? (
        <button className={`${linkClass} disabled:opacity-50`} disabled={busy} onClick={() => void emit()} type="button">
          {info.status === "REJECTED" ? "Emitir novamente" : "Emitir NFC-e"}
          {isTab ? ` da comanda${info.targetCode ? ` ${info.targetCode}` : ""}` : ""}
        </button>
      ) : info.blockedReason ? (
        <span className="text-xs text-slate-500" data-testid="order-fiscal-blocked">
          {BLOCKED_REASON[info.blockedReason]}
        </span>
      ) : null}
      {message ? <span className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span> : null}
    </div>
  );
}
