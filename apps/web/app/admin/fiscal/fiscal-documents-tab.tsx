"use client";

import React, { useEffect, useState } from "react";
import type { FiscalDocumentDetail, FiscalDocumentPage, FiscalDocumentStatus, FiscalDocumentSummary } from "@rrfive/types";
import { CheckCircle2, Copy, Download, ExternalLink, FileCode2, Printer, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import type { FiscalDocumentQuery } from "../../../lib/api";
import {
  FISCAL_STATUS,
  PENDING_REASON,
  deadlineLabel,
  formatDateTime,
  formatMoney,
  type FiscalActionState,
} from "./fiscal-labels";

export interface FiscalDocumentActions {
  loadDocuments: (query: FiscalDocumentQuery) => Promise<FiscalActionState<FiscalDocumentPage>>;
  reprocess: (id: string, confirmRetroactive?: boolean) => Promise<FiscalActionState<FiscalDocumentDetail>>;
  cancel: (id: string, reason: string) => Promise<FiscalActionState<FiscalDocumentDetail>>;
  sync: (id: string) => Promise<FiscalActionState<FiscalDocumentDetail>>;
  reviewTaxDivergence: (id: string) => Promise<FiscalActionState<FiscalDocumentDetail>>;
}

interface Props {
  mode: "pending" | "all";
  initialPage: FiscalDocumentPage;
  environment?: "HOMOLOGATION" | "PRODUCTION";
  defaultCancelReason: string;
  actions: FiscalDocumentActions;
  busy: boolean;
  run: <T>(action: () => Promise<FiscalActionState<T>>, onSuccess?: (data: T) => void) => Promise<void>;
}

const STATUS_FILTERS: Array<[FiscalDocumentStatus | "", string]> = [
  ["", "Todas"],
  ["AUTHORIZED", "Autorizadas"],
  ["PROCESSING", "Processando"],
  ["REJECTED", "Rejeitadas"],
  ["ERROR", "Com erro"],
  ["CANCEL_PENDING", "Cancelamento pendente"],
  ["CANCELLED", "Canceladas"],
];
const inputClass = "rounded-md border border-slate-300 px-3 py-2 text-sm";
const iconButton = "inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function FiscalDocumentsTab({ mode, initialPage, environment = "PRODUCTION", defaultCancelReason, actions, busy, run }: Props) {
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState<FiscalDocumentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cancelling, setCancelling] = useState<FiscalDocumentSummary | null>(null);
  const [reason, setReason] = useState(defaultCancelReason);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setPage(initialPage), [initialPage]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function query(pageNumber = 1): FiscalDocumentQuery {
    return mode === "pending"
      ? { pendingOnly: true, page: pageNumber, pageSize: 25 }
      : {
          status: status ? [status] : undefined,
          from: from ? new Date(`${from}T00:00:00-03:00`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59-03:00`).toISOString() : undefined,
          page: pageNumber,
          pageSize: 25,
        };
  }

  function load(pageNumber = 1) {
    return run(() => actions.loadDocuments(query(pageNumber)), setPage);
  }

  function afterAction() {
    void load(page.page);
  }

  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{mode === "pending" ? "Pendencias fiscais" : "Notas emitidas"}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "pending"
              ? "Notas rejeitadas, com erro ou com cancelamento a fazer. Cancelamentos no Bling tem prazo de 30 minutos apos a autorizacao."
              : "Historico de NFC-e por periodo e situacao."}
          </p>
        </div>
        {mode === "all" ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void load(1);
            }}
          >
            <label className="text-xs text-slate-600">
              Situacao
              <select aria-label="Situacao" className={`${inputClass} mt-1 block`} onChange={(event) => setStatus(event.target.value as FiscalDocumentStatus | "")} value={status}>
                {STATUS_FILTERS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              De
              <input aria-label="De" className={`${inputClass} mt-1 block`} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
            </label>
            <label className="text-xs text-slate-600">
              Ate
              <input aria-label="Ate" className={`${inputClass} mt-1 block`} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
            </label>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
              Filtrar
            </button>
            {from && to ? (
              <a
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                data-testid="fiscal-xml-export"
                href={`/api/admin/fiscal/exports/xml?${new URLSearchParams({ from, to, environment }).toString()}`}
                title="ZIP com os XMLs autorizados e cancelados e um resumo para o contador"
              >
                <Download aria-hidden className="h-4 w-4" /> Exportar XMLs
              </a>
            ) : (
              <span className="text-xs text-slate-500">Informe o periodo para exportar os XMLs</span>
            )}
          </form>
        ) : (
          <button className={iconButton} disabled={busy} onClick={() => void load(1)} type="button">
            <RefreshCw aria-hidden className="h-3.5 w-3.5" /> Atualizar
          </button>
        )}
      </div>

      {cancelling ? (
        <form
          className="mt-4 rounded-md bg-amber-50 p-4 text-sm"
          data-testid="fiscal-cancel-form"
          onSubmit={(event) => {
            event.preventDefault();
            const target = cancelling;
            void run(
              () => actions.cancel(target.id, reason),
              () => {
                setCancelling(null);
                afterAction();
              }
            );
          }}
        >
          <p className="font-semibold">Cancelar NFC-e {cancelling.number ?? ""}</p>
          <label className="mt-2 block">
            Justificativa (minimo 15 caracteres)
            <input className={`${inputClass} mt-1 w-full`} minLength={15} onChange={(event) => setReason(event.target.value)} required value={reason} />
          </label>
          <div className="mt-3 flex gap-2">
            <button className="rounded-md bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60" disabled={busy || reason.trim().length < 15} type="submit">
              Solicitar cancelamento
            </button>
            <button className="rounded-md border border-slate-300 px-4 py-2 font-semibold" onClick={() => setCancelling(null)} type="button">
              Voltar
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Venda</th>
              <th>NFC-e</th>
              <th>Valor</th>
              <th>Data da venda</th>
              <th>Situacao</th>
              <th className="text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {page.items.length === 0 ? (
              <tr>
                <td className="py-4 text-slate-500" colSpan={6}>
                  {mode === "pending" ? "Nenhuma pendencia fiscal." : "Nenhuma nota no periodo."}
                </td>
              </tr>
            ) : (
              page.items.map((document) => {
                const statusInfo = FISCAL_STATUS[document.status];
                const deadline = document.status === "CANCEL_PENDING" ? deadlineLabel(document.cancelDeadlineAt, now) : null;
                return (
                  <tr className="border-t border-slate-100 align-top" data-testid="fiscal-document-row" key={document.id}>
                    <td className="py-2">
                      {document.target.type === "TAB" ? "Comanda" : "Pedido"} {document.target.publicCode ?? document.target.id.slice(0, 8)}
                      {document.environment === "HOMOLOGATION" ? <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-500">homologacao</span> : null}
                    </td>
                    <td>{document.number ? `${document.number} / ${document.series ?? 1}` : "-"}</td>
                    <td>{formatMoney(document.totalAmount)}</td>
                    <td>{formatDateTime(document.saleOccurredAt)}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.classes}`}>{statusInfo.label}</span>
                      {document.pendingReason ? <p className="mt-1 text-xs text-slate-600">{PENDING_REASON[document.pendingReason]}</p> : null}
                      {document.rejectionMessage && document.status !== "AUTHORIZED" ? (
                        <p className="mt-1 text-xs text-red-700">
                          {document.rejectionCode}: {document.rejectionMessage}
                        </p>
                      ) : null}
                      {document.taxDivergences?.length ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-amber-900" data-testid="fiscal-tax-divergences">
                          {document.taxDivergences.map((item) => (
                            <li key={item.code}>
                              {item.description} (NCM {item.ncm}): saiu {item.actual.cfop ?? "-"}/{item.actual.csosn ?? "-"}, perfil {item.expected.cfop}/{item.expected.csosn}
                            </li>
                          ))}
                          {document.taxDivergenceReviewedAt ? <li className="text-slate-500">Revisada em {formatDateTime(document.taxDivergenceReviewedAt)}</li> : null}
                        </ul>
                      ) : null}
                      {deadline ? <p className={`mt-1 text-xs font-semibold ${deadline === "prazo encerrado" ? "text-red-700" : "text-amber-800"}`}>{deadline}</p> : null}
                    </td>
                    <td className="space-x-1 space-y-1 text-right">
                      {document.status === "AUTHORIZED" || document.status === "CANCEL_PENDING" || document.status === "CANCELLED" ? (
                        <>
                          <a className={iconButton} href={`/api/admin/fiscal/documents/${document.id}/danfe`} rel="noreferrer" target="_blank">
                            <Printer aria-hidden className="h-3.5 w-3.5" /> DANFE
                          </a>
                          <a className={iconButton} href={`/api/admin/fiscal/documents/${document.id}/xml`}>
                            <FileCode2 aria-hidden className="h-3.5 w-3.5" /> XML
                          </a>
                        </>
                      ) : null}
                      {document.status === "REJECTED" || document.status === "ERROR" ? (
                        <button
                          className={iconButton}
                          disabled={busy}
                          onClick={() => {
                            const retroactive = new Date(document.saleOccurredAt).toDateString() !== new Date().toDateString();
                            if (retroactive && !window.confirm("Venda de dia anterior: a SEFAZ pode rejeitar a emissao retroativa. Emitir mesmo assim?")) return;
                            void run(() => actions.reprocess(document.id, retroactive), afterAction);
                          }}
                          type="button"
                        >
                          <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Reprocessar
                        </button>
                      ) : null}
                      {document.pendingReason === "TAX_DIVERGENCE" ? (
                        <button className={iconButton} disabled={busy} onClick={() => void run(() => actions.reviewTaxDivergence(document.id), afterAction)} type="button">
                          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Marcar como revisada
                        </button>
                      ) : null}
                      {document.status === "AUTHORIZED" ? (
                        <button className={iconButton} disabled={busy} onClick={() => setCancelling(document)} type="button">
                          <XCircle aria-hidden className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      ) : null}
                      {document.status === "CANCEL_PENDING" || document.status === "CANCEL_FAILED" || document.status === "PROCESSING" ? (
                        <>
                          {document.providerPanelUrl ? (
                            <a className={iconButton} href={document.providerPanelUrl} rel="noreferrer" target="_blank">
                              <ExternalLink aria-hidden className="h-3.5 w-3.5" /> Abrir no Bling
                            </a>
                          ) : null}
                          {document.status !== "PROCESSING" && document.accessKey ? (
                            <button className={iconButton} onClick={() => void navigator.clipboard?.writeText(document.accessKey ?? "")} type="button">
                              <Copy aria-hidden className="h-3.5 w-3.5" /> Copiar chave
                            </button>
                          ) : null}
                          <button className={iconButton} disabled={busy} onClick={() => void run(() => actions.sync(document.id), afterAction)} type="button">
                            <RefreshCw aria-hidden className="h-3.5 w-3.5" /> {document.status === "PROCESSING" ? "Consultar" : "Ja cancelei no Bling"}
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {page.total > page.pageSize ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button className={iconButton} disabled={busy || page.page <= 1} onClick={() => void load(page.page - 1)} type="button">
            Anterior
          </button>
          <span>
            {page.page} de {totalPages}
          </span>
          <button className={iconButton} disabled={busy || page.page >= totalPages} onClick={() => void load(page.page + 1)} type="button">
            Proxima
          </button>
        </div>
      ) : null}
    </section>
  );
}
