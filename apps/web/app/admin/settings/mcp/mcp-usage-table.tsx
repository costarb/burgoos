"use client";

import React, { useState } from "react";
import type { McpToken, McpToolCallResult, McpUsagePage, McpUsageQuery } from "@rrfive/types";
import type { McpActionState } from "./mcp-action-state";

interface McpUsageTableProps {
  initialPage: McpUsagePage;
  tokens: McpToken[];
  loadUsageAction: (query: McpUsageQuery) => Promise<McpActionState<McpUsagePage>>;
}

const RESULT_LABEL: Record<McpToolCallResult, { label: string; classes: string }> = {
  SUCCESS: { label: "Sucesso", classes: "bg-emerald-100 text-emerald-800" },
  ERROR: { label: "Erro", classes: "bg-amber-100 text-amber-800" },
  DENIED: { label: "Recusada", classes: "bg-red-100 text-red-800" },
};

const ERROR_LABEL: Record<string, string> = {
  TOKEN_REVOKED: "Token revogado",
  TOKEN_EXPIRED: "Token expirado",
  MCP_DISABLED: "MCP desabilitado",
  STORE_INACTIVE: "Loja inativa",
  RATE_LIMITED: "Limite de chamadas",
  AREA_DISABLED: "Area nao liberada",
  INVALID_PERIOD: "Periodo invalido",
  PERIOD_TOO_LONG: "Periodo acima de 92 dias",
  TIMEOUT: "Tempo esgotado",
  MEMORY_PRESSURE: "Sistema sob carga",
  INTERNAL: "Erro interno",
};

const PAGE_SIZE = 25;

export function McpUsageTable({ initialPage, tokens, loadUsageAction }: McpUsageTableProps) {
  const [usage, setUsage] = useState(initialPage);
  const [filters, setFilters] = useState<McpUsageQuery>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(usage.total / usage.pageSize));

  async function load(query: McpUsageQuery) {
    setLoading(true);
    setError(null);
    try {
      const result = await loadUsageAction({ ...query, pageSize: PAGE_SIZE });
      if (result.status === "success" && result.data) setUsage(result.data);
      else setError(result.message ?? "Nao foi possivel carregar o uso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel carregar o uso.");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(next: McpUsageQuery) {
    setFilters(next);
    void load({ ...next, page: 1 });
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Uso do MCP</h2>
      <p className="mt-1 text-sm text-slate-600">
        Consultas feitas pelos assistentes de IA e tentativas recusadas. O historico e mantido por
        90 dias.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <select
          aria-label="Filtrar por token"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          disabled={loading}
          onChange={(event) =>
            applyFilters({ ...filters, tokenId: event.target.value || undefined })
          }
          value={filters.tokenId ?? ""}
        >
          <option value="">Todos os tokens</option>
          {tokens.map((token) => (
            <option key={token.id} value={token.id}>
              {token.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por resultado"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          disabled={loading}
          onChange={(event) =>
            applyFilters({
              ...filters,
              result: (event.target.value || undefined) as McpToolCallResult | undefined,
            })
          }
          value={filters.result ?? ""}
        >
          <option value="">Todos os resultados</option>
          <option value="SUCCESS">Sucesso</option>
          <option value="ERROR">Erro</option>
          <option value="DENIED">Recusada</option>
        </select>
        <input
          aria-label="Data inicial"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          disabled={loading}
          onChange={(event) => applyFilters({ ...filters, start: event.target.value || undefined })}
          type="date"
          value={filters.start ?? ""}
        />
        <input
          aria-label="Data final"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          disabled={loading}
          onChange={(event) => applyFilters({ ...filters, end: event.target.value || undefined })}
          type="date"
          value={filters.end ?? ""}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {usage.items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nenhuma chamada registrada.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Token</th>
                <th className="py-2 pr-4">Consulta</th>
                <th className="py-2 pr-4">Parametros</th>
                <th className="py-2 pr-4">Resultado</th>
                <th className="py-2 pr-4 text-right">Duracao</th>
              </tr>
            </thead>
            <tbody>
              {usage.items.map((entry) => (
                <tr className="border-b border-slate-100 align-top" key={entry.id}>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {new Date(entry.occurredAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td className="py-2 pr-4">{entry.tokenName ?? "-"}</td>
                  <td className="py-2 pr-4">
                    <span className="font-medium">{entry.target ?? entry.method}</span>
                    <span className="block text-xs text-slate-500">{entry.method}</span>
                  </td>
                  <td className="max-w-xs truncate py-2 pr-4 font-mono text-xs text-slate-600">
                    {entry.arguments ? JSON.stringify(entry.arguments) : "-"}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RESULT_LABEL[entry.result].classes}`}
                    >
                      {RESULT_LABEL[entry.result].label}
                    </span>
                    {entry.errorCode ? (
                      <span className="block text-xs text-slate-500">
                        {ERROR_LABEL[entry.errorCode] ?? entry.errorCode}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 text-right">{entry.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          {usage.total} chamada(s) · pagina {usage.page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-1 font-semibold disabled:opacity-50"
            disabled={loading || usage.page <= 1}
            onClick={() => void load({ ...filters, page: usage.page - 1 })}
            type="button"
          >
            Anterior
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-1 font-semibold disabled:opacity-50"
            disabled={loading || usage.page >= totalPages}
            onClick={() => void load({ ...filters, page: usage.page + 1 })}
            type="button"
          >
            Proxima
          </button>
        </div>
      </div>
    </section>
  );
}
