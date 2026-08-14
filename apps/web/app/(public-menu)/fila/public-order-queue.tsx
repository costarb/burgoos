"use client";

import type { PublicOrderQueue, PublicQueueItem, PublicQueueStatus } from "@burgoos/types";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { getPublicOrderQueue, getPublicOrderQueueByDomain } from "../../../lib/api";
import { useAdaptivePolling } from "../../../lib/adaptive-polling";

type QueueSource = { slug: string } | { domain: string };

export function PublicOrderQueueClient({
  initialQueue,
  source,
}: {
  initialQueue: PublicOrderQueue;
  source: QueueSource;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [lastSuccessAt, setLastSuccessAt] = useState(() => Date.now());
  const [staleByAge, setStaleByAge] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useAdaptivePolling({
    visibleIntervalMs: 5_000,
    hiddenIntervalMs: 30_000,
    runImmediately: false,
    task: async (signal) => {
      try {
        const next = "slug" in source
          ? await getPublicOrderQueue(source.slug, signal)
          : await getPublicOrderQueueByDomain(source.domain, signal);
        if (next) {
          setQueue(next);
          setLastSuccessAt(Date.now());
          setRefreshFailed(false);
        }
      } catch (error) {
        if (!signal.aborted) setRefreshFailed(true);
        throw error;
      }
    },
  });

  useEffect(() => {
    setStaleByAge(false);
    const delay = Math.max(0, lastSuccessAt + queue.staleAfterSeconds * 1_000 - Date.now());
    const timer = window.setTimeout(() => setStaleByAge(true), delay);
    return () => window.clearTimeout(timer);
  }, [lastSuccessAt, queue.staleAfterSeconds]);

  const stale = refreshFailed || staleByAge;
  const grouped = useMemo(() => groupActive(queue.active), [queue.active]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-700 pb-5">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            {queue.storeName}
          </p>
          <h1 className="mt-1 text-3xl font-black sm:text-5xl">Acompanhe seu pedido</h1>
        </div>
        <div className={`rounded-full px-4 py-2 text-sm font-bold ${
          stale ? "bg-amber-400 text-slate-950" : "bg-emerald-500/20 text-emerald-300"
        }`}>
          {stale ? "Atualizacao temporariamente indisponivel" : "Fila atualizada"}
        </div>
      </header>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <QueueColumn
          empty="Nenhum pedido aguardando"
          items={grouped.PENDING}
          status="PENDING"
          title="Recebidos"
        />
        <QueueColumn
          empty="Nenhum pedido em preparo"
          items={grouped.PREPARING}
          status="PREPARING"
          title="Em preparo"
        />
        <QueueColumn
          empty="Nenhum pedido pronto"
          items={grouped.READY}
          status="READY"
          title="Prontos"
        />
      </section>

      <section className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
        <h2 className="text-xl font-black text-slate-200">Concluidos recentemente</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {queue.completed.length > 0 ? queue.completed.map((item) => (
            <QueueCard compact item={item} key={`${item.publicCode}-${item.enteredAt}`} />
          )) : (
            <p className="text-slate-400">Nenhum pedido concluido recentemente.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function QueueColumn({
  title,
  status,
  items,
  empty,
}: {
  title: string;
  status: PublicQueueStatus;
  items: PublicQueueItem[];
  empty: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${columnStyle(status)}`}>
      <h2 className="text-xl font-black sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <QueueCard item={item} key={`${item.publicCode}-${item.enteredAt}`} />
        )) : <p className="py-6 text-center text-sm opacity-70">{empty}</p>}
      </div>
    </div>
  );
}

function QueueCard({ item, compact = false }: { item: PublicQueueItem; compact?: boolean }) {
  return (
    <article className={`rounded-xl bg-white font-black text-slate-950 shadow-lg ${
      compact ? "min-w-28 px-4 py-3" : "px-5 py-4"
    }`}>
      <p className={compact ? "text-xl" : "text-3xl sm:text-4xl"}>#{item.publicCode}</p>
      {item.displayName ? (
        <p className="mt-1 max-w-60 truncate text-sm font-semibold text-slate-600">
          {item.displayName}
        </p>
      ) : null}
    </article>
  );
}

function groupActive(items: PublicQueueItem[]) {
  return {
    PENDING: items.filter((item) => item.status === "PENDING"),
    PREPARING: items.filter((item) => item.status === "PREPARING"),
    READY: items.filter((item) => item.status === "READY"),
  };
}

function columnStyle(status: PublicQueueStatus) {
  if (status === "READY") return "border-emerald-500 bg-emerald-500/15";
  if (status === "PREPARING") return "border-amber-500 bg-amber-500/10";
  return "border-blue-500 bg-blue-500/10";
}
