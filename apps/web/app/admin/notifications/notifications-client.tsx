"use client";

import React, { useEffect, useState } from "react";
import type {
  NotificationCenterState,
  OperationalNotification,
  OperationalNotificationSeverity,
} from "@burgoos/types";
import { Bell, Check, Download, ExternalLink } from "lucide-react";
import { getNotifications, markNotificationRead } from "../../../lib/api";

const notificationPollIntervalMs = 5000;

interface NotificationsClientProps {
  token: string;
  initialState: NotificationCenterState;
}

export function NotificationsClient({ token, initialState }: NotificationsClientProps) {
  const [state, setState] = useState(initialState);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    function refreshNotifications() {
      getNotifications(token, { limit: 50 })
        .then((nextState) => {
          if (active) {
            setState(nextState);
          }
        })
        .catch(() => undefined);
    }

    const interval = window.setInterval(refreshNotifications, notificationPollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token]);

  async function markRead(notification: OperationalNotification) {
    if (notification.status === "READ" || busyId) {
      return;
    }

    setBusyId(notification.id);

    try {
      const updated = await markNotificationRead(token, notification.id);
      setState((current) => ({
        unreadCount: Math.max(0, current.unreadCount - 1),
        items: current.items.map((item) => (item.id === updated.id ? updated : item)),
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Administracao</p>
          <h1 className="mt-1 text-3xl font-semibold">Notificacoes</h1>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold">{state.unreadCount}</span> nao lidas
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        {state.items.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
            <div>
              <Bell className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Nenhuma notificacao encontrada.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {state.items.map((notification) => (
              <NotificationRow
                busy={busyId === notification.id}
                key={notification.id}
                notification={notification}
                onMarkRead={markRead}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function NotificationRow({
  notification,
  busy,
  onMarkRead,
}: {
  notification: OperationalNotification;
  busy: boolean;
  onMarkRead: (notification: OperationalNotification) => Promise<void>;
}) {
  const unread = notification.status === "UNREAD";

  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={notification.severity} />
          {unread ? (
            <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
              Nova
            </span>
          ) : null}
          <time className="text-xs text-slate-500">{formatDateTime(notification.createdAt)}</time>
        </div>
        <h2 className="mt-2 text-base font-semibold text-slate-950">{notification.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {notification.actionUrl ? (
          <a
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            href={notification.actionUrl}
          >
            {notification.actionLabel?.toLowerCase().includes("baixar") ? (
              <Download aria-hidden className="h-4 w-4" />
            ) : (
              <ExternalLink aria-hidden className="h-4 w-4" />
            )}
            {notification.actionLabel ?? "Abrir"}
          </a>
        ) : null}
        {unread ? (
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => {
              void onMarkRead(notification);
            }}
            type="button"
          >
            <Check aria-hidden className="h-4 w-4" />
            Marcar lida
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SeverityBadge({ severity }: { severity: OperationalNotificationSeverity }) {
  const classes = {
    INFO: "border-sky-200 bg-sky-50 text-sky-800",
    SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-800",
    WARNING: "border-amber-200 bg-amber-50 text-amber-800",
    ERROR: "border-red-200 bg-red-50 text-red-800",
  }[severity];

  const labels = {
    INFO: "Info",
    SUCCESS: "Sucesso",
    WARNING: "Atencao",
    ERROR: "Erro",
  }[severity];

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${classes}`}>{labels}</span>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
