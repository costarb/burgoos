"use client";

import React, { useRef, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { getNotificationSummary } from "../../lib/api";
import { readAuthSession } from "../../lib/auth-client";
import { useAdaptivePolling } from "../../lib/adaptive-polling";

const notificationPollIntervalMs = Number(process.env.NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL_MS ?? 30_000);
const hiddenPollIntervalMs = Number(process.env.NEXT_PUBLIC_HIDDEN_POLL_INTERVAL_MS ?? 120_000);

interface NotificationCenterButtonProps {
  initialUnreadCount?: number;
}

export function NotificationCenterButton({
  initialUnreadCount = 0,
}: NotificationCenterButtonProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const session = readAuthSession();
  const etagRef = useRef<string>();

  useAdaptivePolling({
    enabled: Boolean(session?.accessToken),
    visibleIntervalMs: notificationPollIntervalMs,
    hiddenIntervalMs: hiddenPollIntervalMs,
    task: async (signal) => {
      if (!session?.accessToken) return;
      const result = await getNotificationSummary(session.accessToken, etagRef.current, signal);
      etagRef.current = result.etag;
      if (result.data) setUnreadCount(result.data.unreadCount);
    },
  });

  return (
    <Link
      aria-label={
        unreadCount > 0 ? `${unreadCount} notificacoes nao lidas` : "Abrir centro de notificacoes"
      }
      className="relative grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
      href="/admin/notifications"
      title="Notificacoes"
    >
      <Bell aria-hidden className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-tomato px-1 text-xs font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
