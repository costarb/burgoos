"use client";

import React from "react";
import type { McpConnection } from "@rrfive/types";
import { Plug } from "lucide-react";

const REASON_LABEL: Record<string, string> = {
  MANUAL: "Revogada na tela",
  REFRESH_REUSE: "Revogada por seguranca (credencial reutilizada)",
  CODE_REUSE: "Revogada por seguranca (codigo reutilizado)",
  CLIENT_REVOKED: "Desconectada pelo aplicativo",
};

export function McpConnectionsTable({
  connections,
  busy,
  onRevoke,
}: {
  connections: McpConnection[];
  busy: boolean;
  onRevoke: (connection: McpConnection) => void;
}) {
  const active = connections.filter((connection) => connection.status === "ACTIVE").length;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plug aria-hidden className="h-5 w-5" /> Conexoes autorizadas
        </h2>
        <span className="text-sm text-slate-500">{active} de 20 ativas</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Assistentes conectados pelo login. Revogar corta o acesso imediatamente; o assistente precisara
        autorizar de novo.
      </p>

      {connections.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nenhum assistente conectado pelo login.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Aplicativo</th>
                <th className="py-2 pr-4">Autorizado por</th>
                <th className="py-2 pr-4">Desde</th>
                <th className="py-2 pr-4">Ultimo uso</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr className="border-b border-slate-100 align-top" key={connection.id}>
                  <td className="py-2 pr-4">
                    <span className="font-medium">{connection.clientName}</span>
                    <span className="block text-xs text-slate-500">{connection.redirectHost}</span>
                  </td>
                  <td className="py-2 pr-4">{connection.userName}</td>
                  <td className="py-2 pr-4">{new Date(connection.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 pr-4">
                    {connection.lastUsedAt
                      ? new Date(connection.lastUsedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                      : "Nunca"}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        connection.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {connection.status === "ACTIVE" ? "Ativa" : "Revogada"}
                    </span>
                    {connection.revokedReason ? (
                      <span className="block text-xs text-slate-500">
                        {REASON_LABEL[connection.revokedReason] ?? connection.revokedReason}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right">
                    {connection.status === "ACTIVE" ? (
                      <button
                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        disabled={busy}
                        onClick={() => onRevoke(connection)}
                        type="button"
                      >
                        Revogar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
