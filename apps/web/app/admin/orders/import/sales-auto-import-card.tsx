"use client";

import React, { useEffect, useState } from "react";
import type { SalesAutoImportSettings, SalesIntegrationView } from "@rrfive/types";
import type { AdminProduct } from "../../../../lib/api";
import { updateSalesAutoImport } from "../../../../lib/api";

interface Props {
  token: string;
  integration: SalesIntegrationView;
  products: AdminProduct[];
  onChange: (integration: SalesIntegrationView) => void;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatLag(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "sem vendas hoje";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}

/** Automatic import every 2 minutes (Mercado Pago / PagBank) feeding the automatic NFC-e. */
export function SalesAutoImportCard({ token, integration, products, onChange }: Props) {
  const current = integration.autoImport ?? { enabled: false, strategy: "PRICE_WEIGHTED", fixedProductId: null };
  const [form, setForm] = useState<SalesAutoImportSettings>(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const health = integration.autoImportHealth;

  useEffect(() => setForm(integration.autoImport ?? { enabled: false, strategy: "PRICE_WEIGHTED", fixedProductId: null }), [integration]);

  async function save(next: SalesAutoImportSettings) {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await updateSalesAutoImport(token, integration.id, next);
      onChange(updated);
      setMessage(next.enabled ? "Importacao automatica ligada." : "Importacao automatica desligada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar a importacao automatica");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border border-slate-200 p-4" data-testid="sales-auto-import">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="font-semibold">Importacao automatica</h3>
          <p className="mt-1 text-sm text-slate-600">
            Busca as vendas do dia a cada 2 minutos e cria os pedidos sem precisar confirmar. Com a emissao fiscal automatica ativa, a NFC-e e emitida em
            seguida.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !current.enabled ? "bg-slate-200 text-slate-700" : health?.degraded ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
          }`}
          data-testid="sales-auto-import-status"
        >
          {!current.enabled ? "Desligada" : health?.degraded ? "Com falhas" : "Ligada"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold">
          Atribuicao dos produtos
          <select
            className="rounded border px-3 py-2 font-normal"
            onChange={(event) => setForm({ ...form, strategy: event.target.value as SalesAutoImportSettings["strategy"] })}
            value={form.strategy}
          >
            <option value="PRICE_WEIGHTED">Automatica por valor</option>
            <option value="FIXED_PRODUCT">Produto fixo</option>
          </select>
        </label>
        {form.strategy === "FIXED_PRODUCT" ? (
          <label className="grid gap-1 text-sm font-semibold">
            Produto
            <select
              aria-label="Produto fixo da importacao automatica"
              className="rounded border px-3 py-2 font-normal"
              onChange={(event) => setForm({ ...form, fixedProductId: event.target.value || null })}
              value={form.fixedProductId ?? ""}
            >
              <option value="">Selecione</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-end gap-2">
          <button
            className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy || (form.strategy === "FIXED_PRODUCT" && !form.fixedProductId)}
            onClick={() => void save({ ...form, enabled: !current.enabled })}
            type="button"
          >
            {current.enabled ? "Desligar" : "Ligar importacao automatica"}
          </button>
          {current.enabled ? (
            <button className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => void save({ ...form, enabled: true })} type="button">
              Salvar atribuicao
            </button>
          ) : null}
        </div>
      </div>

      {current.enabled && health ? (
        <dl className="mt-3 grid gap-2 rounded bg-slate-50 p-3 text-sm sm:grid-cols-4" data-testid="sales-auto-import-health">
          <div>
            <dt className="text-xs uppercase text-slate-500">Ultima importacao</dt>
            <dd>{formatDateTime(health.lastSuccessAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Ultima tentativa</dt>
            <dd>{formatDateTime(health.lastAttemptAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Atraso das vendas</dt>
            <dd>{formatLag(health.lagSeconds)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Falhas seguidas</dt>
            <dd className={health.consecutiveFailures > 0 ? "font-semibold text-red-700" : ""}>
              {health.consecutiveFailures}
              {health.lastErrorCode ? ` (${health.lastErrorCode})` : ""}
            </dd>
          </div>
        </dl>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
