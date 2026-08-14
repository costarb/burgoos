"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import type { KdsOrder } from "@burgoos/types";
import { io } from "socket.io-client";
import { getKdsOrders } from "../../../lib/api";
import { useAdaptivePolling } from "../../../lib/adaptive-polling";

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
  const inFlightRef = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = getKdsOrders(signal)
      .then(setOrders)
      .finally(() => {
        if (inFlightRef.current === request) inFlightRef.current = null;
      });
    inFlightRef.current = request;
    return request;
  }, []);

  useAdaptivePolling({
    visibleIntervalMs: connected ? 60_000 : 15_000,
    hiddenIntervalMs: 120_000,
    runImmediately: false,
    task: refresh,
  });

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

    return () => {
      socket.disconnect();
    };
  }, [apiUrl, refresh, tenantId, token]);

  return { orders, setOrders, connected, refresh };
}
