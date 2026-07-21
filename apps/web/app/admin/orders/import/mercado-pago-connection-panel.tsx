"use client";

import type { SalesImportRunView, SalesIntegrationView, SalesMovementView } from "@burgoos/types";
import React, { FormEvent, useEffect, useState } from "react";
import {
  connectMercadoPagoFixedToken,
  confirmSalesImportRun,
  createSalesIntegration,
  disconnectMercadoPago,
  getSalesImportRun,
  listSalesImportMovements,
  startMercadoPagoOAuth,
  syncMercadoPago,
} from "../../../../lib/api";

export function MercadoPagoConnectionPanel({
  token,
  integration,
  onChange,
}: {
  token: string;
  integration: SalesIntegrationView | null;
  onChange: (value: SalesIntegrationView) => void;
}) {
  const [mode, setMode] = useState<"OAUTH" | "FIXED_TOKEN">("OAUTH");
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncRun, setSyncRun] = useState<SalesImportRunView | null>(null);
  const [movements, setMovements] = useState<SalesMovementView[]>([]);
  const [movementTotal, setMovementTotal] = useState(0);
  useEffect(() => {
    if (integration?.credentialMode === "FIXED_TOKEN" || integration?.credentialMode === "OAUTH")
      setMode(integration.credentialMode);
  }, [integration?.credentialMode]);
  async function ensureIntegration() {
    return (
      integration ??
      createSalesIntegration(token, {
        provider: "MERCADO_PAGO",
        channel: "API",
        displayName: "Mercado Pago",
        environment: "PRODUCTION",
        credentialMode: mode,
      })
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const current = await ensureIntegration();
      onChange(current);
      if (mode === "OAUTH") {
        const started = await startMercadoPagoOAuth(token, current.id, days);
        window.location.assign(started.authorizationUrl);
      } else {
        const connected = await connectMercadoPagoFixedToken(token, current.id, accessToken);
        setAccessToken("");
        onChange(connected);
        setMessage("Conta conectada. O access token permanece oculto.");
      }
    } catch (error) {
      setAccessToken("");
      setMessage(error instanceof Error ? error.message : "Falha ao conectar Mercado Pago");
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!integration) return;
    setBusy(true);
    try {
      onChange(await disconnectMercadoPago(token, integration.id));
      setMessage("Mercado Pago desconectado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }
  async function synchronize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!integration) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const startDate = String(data.get("startDate"));
      const endDate = String(data.get("endDate"));
      let run = await syncMercadoPago(token, integration.id, {
        startDate,
        endDate,
        strategy: "PRICE_WEIGHTED",
      });
      setSyncRun(run);
      setSyncStatus(run.status);
      for (
        let attempt = 0;
        attempt < 60 && ["PENDING", "FETCHING"].includes(run.status);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        run = await getSalesImportRun(token, run.id);
        setSyncRun(run);
        setSyncStatus(run.status);
      }
      if (["PREVIEW_READY", "PARTIALLY_READY"].includes(run.status)) {
        const preview = await listSalesImportMovements(token, run.id, 1, 100);
        setMovements(preview.items);
        setMovementTotal(preview.total);
      }
      setMessage(
        ["PREVIEW_READY", "PARTIALLY_READY"].includes(run.status)
          ? `Prévia pronta: ${run.counts.new} novas, ${run.counts.duplicate} duplicadas e ${run.counts.rejected} ignoradas.`
          : (run.errorMessage ?? "Sincronização finalizada.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao sincronizar");
    } finally {
      setBusy(false);
    }
  }
  async function confirmImport() {
    if (!syncRun) return;
    setBusy(true);
    setMessage("");
    try {
      let run = await confirmSalesImportRun(token, syncRun.id);
      setSyncRun(run);
      setSyncStatus(run.status);
      for (let attempt = 0; attempt < 60 && run.status === "IMPORTING"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        run = await getSalesImportRun(token, run.id);
        setSyncRun(run);
        setSyncStatus(run.status);
      }
      setMessage(
        run.status === "COMPLETED"
          ? `Importação concluída: ${run.counts.imported ?? 0} pedidos importados.`
          : (run.errorMessage ?? "Importação finalizada.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao importar pedidos");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">Mercado Pago</h2>
        <p className="text-sm text-slate-600">
          Status: {integration?.publicStatus ?? "DISCONNECTED"}
          {integration?.providerUserId ? ` · Conta ${integration.providerUserId}` : ""}
        </p>
        {integration ? (
          <dl className="mt-2 grid gap-1 text-sm text-slate-600">
            <div>
              Modo: {integration.credentialMode === "FIXED_TOKEN" ? "Access token fixo" : "OAuth"}
            </div>
            <div>Ambiente: {integration.environment ?? "PRODUCTION"}</div>
            <div>Validade: {formatDate(integration.tokenExpiresAt)}</div>
            <div>Última sincronização: {formatDate(integration.lastSyncAt)}</div>
            {integration.lastErrorMessage ? (
              <div role="alert">Atenção: {integration.lastErrorMessage}</div>
            ) : null}
          </dl>
        ) : null}
      </div>
      <form onSubmit={submit} className="grid gap-3 rounded border p-4">
        <fieldset className="flex gap-5">
          <legend className="mb-2 font-semibold">Forma de conexão</legend>
          <label>
            <input type="radio" checked={mode === "OAUTH"} onChange={() => setMode("OAUTH")} />{" "}
            OAuth recomendado
          </label>
          <label>
            <input
              type="radio"
              checked={mode === "FIXED_TOKEN"}
              onChange={() => setMode("FIXED_TOKEN")}
            />{" "}
            Access token fixo
          </label>
        </fieldset>
        <label className="grid gap-1 text-sm font-semibold">
          Período da carga inicial
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as 30 | 60 | 90)}
            className="rounded border px-3 py-2 font-normal"
          >
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
          </select>
        </label>
        {mode === "FIXED_TOKEN" ? (
          <div className="grid gap-2">
            <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">
              Opção temporária para testes. Em produção, prefira OAuth. O token não poderá ser
              consultado depois de salvo.
            </p>
            <label className="grid gap-1 text-sm font-semibold">
              Access token da loja
              <input
                aria-label="Access token da loja"
                type="password"
                autoComplete="off"
                required
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                className="rounded border px-3 py-2 font-normal"
              />
            </label>
          </div>
        ) : null}
        <div className="flex gap-2">
          <button disabled={busy} className="rounded bg-ink px-4 py-2 font-semibold text-white">
            {mode === "OAUTH"
              ? integration?.status === "REAUTHORIZATION_REQUIRED"
                ? "Reconectar Mercado Pago"
                : "Conectar Mercado Pago"
              : integration?.hasCredential
                ? "Substituir access token"
                : "Validar e conectar"}
          </button>
          {integration?.hasCredential ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="rounded border px-4 py-2"
            >
              Desconectar
            </button>
          ) : null}
        </div>
      </form>
      {integration?.status === "ACTIVE" ? (
        <form onSubmit={synchronize} className="grid gap-3 rounded border p-4 md:grid-cols-3">
          <h3 className="font-semibold md:col-span-3">Consultar vendas</h3>
          <label className="grid gap-1 text-sm font-semibold">
            Data inicial
            <input
              name="startDate"
              type="date"
              required
              className="rounded border px-3 py-2 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Data final
            <input
              name="endDate"
              type="date"
              required
              className="rounded border px-3 py-2 font-normal"
            />
          </label>
          <button
            disabled={busy}
            className="self-end rounded bg-tomato px-4 py-2 font-semibold text-white"
          >
            Sincronizar período
          </button>
          {syncStatus ? <p className="text-sm md:col-span-3">Progresso: {syncStatus}</p> : null}
        </form>
      ) : null}
      {movements.length > 0 ? (
        <div className="grid gap-3 overflow-x-auto">
          <p className="text-sm text-slate-600">
            Exibindo {movements.length} de {movementTotal} registros da prévia. A confirmação
            importa todos os registros classificados como novos, não apenas os exibidos.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Pagamento</th>
                <th>Data de criação</th>
                <th>Data de liberação</th>
                <th>Classificação</th>
                <th>Método</th>
                <th>Bruto</th>
                <th>Taxa</th>
                <th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-t">
                  <td>{movement.externalSaleId ?? movement.providerMovementId}</td>
                  <td>{formatProviderDate(movement.providerCreatedAt)}</td>
                  <td>{formatProviderDate(movement.providerReleaseAt)}</td>
                  <td>
                    {movement.status}
                    {movement.rejectionCode ? ` · ${movement.rejectionCode}` : ""}
                  </td>
                  <td>{movement.paymentMethod ?? "-"}</td>
                  <td>{movement.grossAmount ?? "-"}</td>
                  <td>{movement.feeAmount ?? "-"}</td>
                  <td>{movement.netAmount ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {syncRun && ["PREVIEW_READY", "PARTIALLY_READY"].includes(syncRun.status) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmImport()}
              className="w-fit rounded bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              Confirmar importação
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="status" className="text-sm">
        {message}
      </p>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "Não disponível";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR") : "Não disponível";
}

function formatProviderDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "-";
}
