"use client";

import type { AdminProduct } from "../../../../lib/api";
import {
  confirmSalesImportRun,
  createSalesImportRun,
  createSalesIntegration,
  getSalesImportRun,
  listSalesImportRuns,
  listSalesIntegrations,
  listSalesProviders,
  saveSalesCredential,
  setSalesIntegrationStatus,
} from "../../../../lib/api";
import type { SalesImportRunView, SalesIntegrationView, SalesProviderCapability } from "@burgoos/types";
import React, { FormEvent, useEffect, useState } from "react";
import { SalesProviderSelector } from "./sales-provider-selector";

export function SalesRunSummary({ run, busy, onConfirm }: { run: SalesImportRunView; busy: boolean; onConfirm: () => void }) {
  return <div className="rounded border bg-slate-50 p-4 text-sm" aria-live="polite"><p className="font-semibold">Execucao {run.status}</p><p className="mt-1">Encontradas {run.counts.found} · novas {run.counts.new} · duplicadas {run.counts.duplicate} · rejeitadas {run.counts.rejected} · falhas {run.counts.failed} · dias bloqueados {run.counts.blockedDays}</p>{run.days?.map((day) => <p key={day.date} className="text-slate-600">{day.date}: {day.status} ({day.pagesFetched}/{day.totalPages ?? 0} paginas){day.errorMessage ? ` · ${day.errorMessage}` : ""}</p>)}{["PREVIEW_READY", "PARTIALLY_READY"].includes(run.status) ? <button type="button" disabled={busy} onClick={onConfirm} className="mt-3 rounded bg-ink px-4 py-2 font-semibold text-white">Confirmar importacao</button> : null}</div>;
}

export function SalesImportHistory({ history }: { history: SalesImportRunView[] }) {
  if (history.length === 0) return <p className="text-sm text-slate-500">Nenhuma execucao encontrada.</p>;
  return <details><summary className="cursor-pointer font-semibold">Historico de execucoes</summary><ul className="mt-2 grid gap-2 text-sm">{history.map((item) => <li key={item.id} className="rounded border p-2">{item.startDate.slice(0, 10)} a {item.endDate.slice(0, 10)} · {item.status} · {item.counts.imported ?? 0} importadas{item.errorMessage ? ` · ${item.errorMessage}` : ""}</li>)}</ul></details>;
}

export function SalesIntegrationPanel({ token, products }: { token: string; products: AdminProduct[] }) {
  const [integration, setIntegration] = useState<SalesIntegrationView | null>(null);
  const [run, setRun] = useState<SalesImportRunView | null>(null);
  const [history, setHistory] = useState<SalesImportRunView[]>([]);
  const [providers, setProviders] = useState<SalesProviderCapability[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("PAGBANK");
  const [strategy, setStrategy] = useState<"PRICE_WEIGHTED" | "FIXED_PRODUCT">("PRICE_WEIGHTED");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [integrations, runs, catalog] = await Promise.all([listSalesIntegrations(token), listSalesImportRuns(token), listSalesProviders(token)]);
    setProviders(catalog);
    setIntegration(integrations.find((item) => item.provider === selectedProvider) ?? null);
    setHistory(runs.items);
  }
  useEffect(() => { void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Falha ao carregar integracao")); }, [token, selectedProvider]);

  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      let current = integration;
      if (!current) current = await createSalesIntegration(token, { provider: "PAGBANK", channel: "API", displayName: "PagBank EDI", externalMerchantId: String(data.get("merchantId")) });
      const credential = String(data.get("credential") ?? "");
      if (credential) await saveSalesCredential(token, current.id, credential);
      current = await setSalesIntegrationStatus(token, current.id, "ACTIVE");
      setIntegration(current); setMessage("Integracao PagBank ativa. O token permanece oculto.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao configurar"); } finally { setBusy(false); }
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!integration) return; setBusy(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const created = await createSalesImportRun(token, { integrationId: integration.id, startDate: String(data.get("startDate")), endDate: String(data.get("endDate")), strategy, fixedProductId: strategy === "FIXED_PRODUCT" ? String(data.get("fixedProductId")) : undefined });
      setRun(created);
      let current = created;
      for (let attempt = 0; attempt < 60 && ["PENDING", "FETCHING"].includes(current.status); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); current = await getSalesImportRun(token, created.id); setRun(current);
      }
      setMessage(["PREVIEW_READY", "PARTIALLY_READY"].includes(current.status) ? "Pre-visualizacao pronta para conferencia." : current.errorMessage ?? "Consulta finalizada sem datas prontas.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na consulta"); } finally { setBusy(false); }
  }

  async function confirm() {
    if (!run) return; setBusy(true);
    try { await confirmSalesImportRun(token, run.id); let updated = await getSalesImportRun(token, run.id); for (let attempt = 0; attempt < 60 && ["PREVIEW_READY", "PARTIALLY_READY", "IMPORTING"].includes(updated.status); attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 1000)); updated = await getSalesImportRun(token, run.id); setRun(updated); } setRun(updated); setMessage(`Importacao concluida: ${updated.counts.imported} importadas, ${updated.counts.duplicate} duplicadas e ${updated.counts.failed} falhas.`); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao importar"); } finally { setBusy(false); }
  }

  return (
    <section className="mt-8 grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-xl font-semibold">Integracao PagBank EDI</h2><p className="mt-1 text-sm text-slate-600">Consulta movimentos transacionais consolidados de D-1. Tentativas nao autorizadas, vouchers e recargas nao aparecem no EDI.</p></div>
      <SalesProviderSelector providers={providers} selectedProvider={selectedProvider} onChange={setSelectedProvider} />
      <form className="grid gap-3 md:grid-cols-3" onSubmit={configure}>
        <label className="grid gap-1 text-sm font-semibold">USER do estabelecimento<input name="merchantId" defaultValue={integration?.externalMerchantId ?? ""} required className="rounded border px-3 py-2 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">TOKEN EDI<input name="credential" type="password" required={!integration?.hasCredential} placeholder={integration?.hasCredential ? "Token configurado; deixe vazio para manter" : "Token recebido pelo PagBank"} className="rounded border px-3 py-2 font-normal" /></label>
        <button disabled={busy} className="self-end rounded bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60">{integration?.status === "ACTIVE" ? "Atualizar integracao" : "Salvar e ativar"}</button>
      </form>
      {integration?.status === "ACTIVE" ? (
        <form className="grid gap-3 border-t pt-5 md:grid-cols-4" onSubmit={preview}>
          <label className="grid gap-1 text-sm font-semibold">Data inicial<input name="startDate" type="date" required className="rounded border px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Data final<input name="endDate" type="date" required className="rounded border px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Atribuicao<select value={strategy} onChange={(event) => setStrategy(event.target.value as typeof strategy)} className="rounded border px-3 py-2 font-normal"><option value="PRICE_WEIGHTED">Automatica por valor</option><option value="FIXED_PRODUCT">Produto fixo</option></select></label>
          {strategy === "FIXED_PRODUCT" ? <label className="grid gap-1 text-sm font-semibold">Produto<select name="fixedProductId" required className="rounded border px-3 py-2 font-normal"><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label> : null}
          <button disabled={busy} className="rounded bg-tomato px-4 py-2 font-semibold text-white disabled:opacity-60">Consultar vendas</button>
        </form>
      ) : null}
      {run ? <div className="rounded border bg-slate-50 p-4 text-sm"><p className="font-semibold">Execucao {run.status}</p><p className="mt-1">Encontradas {run.counts.found} · novas {run.counts.new} · duplicadas {run.counts.duplicate} · rejeitadas {run.counts.rejected} · dias bloqueados {run.counts.blockedDays}</p>{run.days?.map((day) => <p key={day.date} className="text-slate-600">{day.date}: {day.status} ({day.pagesFetched}/{day.totalPages ?? 0} paginas)</p>)}{["PREVIEW_READY", "PARTIALLY_READY"].includes(run.status) ? <button type="button" disabled={busy} onClick={() => void confirm()} className="mt-3 rounded bg-ink px-4 py-2 font-semibold text-white">Confirmar importacao</button> : null}</div> : null}
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-slate-700">{message ?? ""}</p>
      {history.length > 0 ? <details><summary className="cursor-pointer font-semibold">Historico de execucoes</summary><ul className="mt-2 grid gap-2 text-sm">{history.map((item) => <li key={item.id} className="rounded border p-2">{item.startDate.slice(0, 10)} a {item.endDate.slice(0, 10)} · {item.status} · {item.counts.imported ?? 0} importadas</li>)}</ul></details> : null}
    </section>
  );
}
