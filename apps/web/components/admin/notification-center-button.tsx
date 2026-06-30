"use client";

import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { getNotifications } from "../../lib/api";
import { readAuthSession } from "../../lib/auth-client";

const notificationPollIntervalMs = 5000;

interface NotificationCenterButtonProps {
  initialUnreadCount?: number;
}

export function NotificationCenterButton({
  initialUnreadCount = 0,
}: NotificationCenterButtonProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const session = readAuthSession();

    if (!session?.accessToken) {
      return;
    }

    const token = session.accessToken;
    let active = true;

    function refreshUnreadCount() {
      getNotifications(token, { limit: 1 })
        .then((state) => {
          if (active) {
            setUnreadCount(state.unreadCount);
          }
        })
        .catch(() => undefined);
    }

    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, notificationPollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
