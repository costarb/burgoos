"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import type { KdsOrder } from "@burgoos/types";
import { io } from "socket.io-client";
import { getKdsOrders } from "../../../lib/api";

export function useKdsOrders({
  apiUrl,
  tenantId,
  token,
  initialOrders,
}: {
  apiUrl: string;
  tenantId: string;
  token: string;
  initialOrders: KdsOrder[];
}): {
  orders: KdsOrder[];
  setOrders: Dispatch<SetStateAction<KdsOrder[]>>;
  connected: boolean;
  refresh: () => Promise<void>;
} {
  const [orders, setOrders] = useState(initialOrders);
  const [connected, setConnected] = useState(false);
  const refresh = useCallback(async () => {
    setOrders(await getKdsOrders());
  }, []);

  useEffect(() => {
    const socket = io(apiUrl, {
      auth: { tenantId, token },
    });
    const invalidate = () => void refresh();

    socket.on("connect", () => {
      setConnected(true);
      invalidate();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("order-created", invalidate);
    socket.on("order-updated", invalidate);
    socket.on("order-status-changed", invalidate);

    const interval = window.setInterval(invalidate, 15_000);
    window.addEventListener("focus", invalidate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", invalidate);
      socket.disconnect();
    };
  }, [apiUrl, refresh, tenantId, token]);

  return { orders, setOrders, connected, refresh };
}
