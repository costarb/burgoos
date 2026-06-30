"use client";

import type { AccessAuditEvent, AccessStoreSummary } from "@burgoos/types";
import { useMemo, useState } from "react";

interface AccessAuditClientProps {
  events: AccessAuditEvent[];
  stores: AccessStoreSummary[];
}

export function AccessAuditClient({ events, stores }: AccessAuditClientProps) {
  const [eventType, setEventType] = useState("ALL");
  const [storeId, setStoreId] = useState("ALL");
  const [selected, setSelected] = useState<AccessAuditEvent | null>(null);
  const eventTypes = useMemo(
    () => [...new Set(events.map((event) => event.eventType))].sort(),
    [events]
  );
  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesType = eventType === "ALL" || event.eventType === eventType;
        const matchesStore = storeId === "ALL" || event.storeId === storeId;

        return matchesType && matchesStore;
      }),
    [eventType, events, storeId]
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-7xl">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Acessos</p>
          <h1 className="mt-1 text-3xl font-semibold">Auditoria de acessos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Consulte logins, negacoes e mudancas de usuarios, perfis e permissoes.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            onChange={(event) => setEventType(event.target.value)}
            value={eventType}
          >
            <option value="ALL">Todos os eventos</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            onChange={(event) => setStoreId(event.target.value)}
            value={storeId}
          >
            <option value="ALL">Todas as lojas</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Alvo</th>
                <th className="px-4 py-3">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3">
                    {new Date(event.occurredAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-medium">{event.eventType}</td>
                  <td className="px-4 py-3">{event.result}</td>
                  <td className="px-4 py-3">{storeName(stores, event.storeId)}</td>
                  <td className="px-4 py-3">{event.targetUserId ?? "-"}</td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
                      onClick={() => setSelected(event)}
                      type="button"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
            <section className="w-full max-w-2xl rounded-md bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selected.eventType}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selected.reason ?? "Sem motivo informado"}
                  </p>
                </div>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                  onClick={() => setSelected(null)}
                  type="button"
                >
                  Fechar
                </button>
              </div>
              <pre className="mt-4 max-h-[50vh] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function storeName(stores: AccessStoreSummary[], storeId: string | null) {
  if (!storeId) {
    return "Global";
  }

  return stores.find((store) => store.id === storeId)?.name ?? storeId;
}
