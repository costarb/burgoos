"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import type { AdminOrder, OrderStatus } from "@burgoos/types";
import { updateAdminOrderStatus } from "../../../lib/api";

interface OrdersClientProps {
  apiUrl: string;
  tenantId: string;
  token: string;
  initialActiveOrders: AdminOrder[];
  initialHistoryOrders: AdminOrder[];
}

const activeStatuses: OrderStatus[] = ["PENDING", "PREPARING", "SHIPPED"];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Novo",
  PREPARING: "Preparando",
  SHIPPED: "Saiu",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function OrdersClient({
  apiUrl,
  tenantId,
  token,
  initialActiveOrders,
  initialHistoryOrders,
}: OrdersClientProps) {
  const [activeOrders, setActiveOrders] = useState(initialActiveOrders);
  const [historyOrders, setHistoryOrders] = useState(initialHistoryOrders);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(apiUrl, {
      auth: {
        tenantId,
      },
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("order-created", (order: AdminOrder) => {
      setActiveOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
      playOrderAlert();
    });

    return () => {
      socket.disconnect();
    };
  }, [apiUrl, tenantId]);

  const groupedOrders = useMemo(
    () =>
      activeStatuses.map((status) => ({
        status,
        orders: activeOrders.filter((order) => order.status === status),
      })),
    [activeOrders]
  );

  async function changeStatus(order: AdminOrder, status: OrderStatus): Promise<void> {
    setError(null);

    try {
      const updatedOrder = await updateAdminOrderStatus(token, order.id, status);

      if (status === "DELIVERED" || status === "CANCELLED") {
        setActiveOrders((current) => current.filter((item) => item.id !== order.id));
        setHistoryOrders((current) => [updatedOrder, ...current]);
        return;
      }

      setActiveOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item))
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao atualizar pedido.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Pedidos</p>
          <h1 className="mt-1 text-3xl font-semibold">Fila operacional</h1>
        </div>
        <span className="rounded-md border border-slate-200 px-3 py-2 text-sm">
          {connected ? "Realtime conectado" : "Realtime desconectado"}
        </span>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {groupedOrders.map((group) => (
          <div key={group.status}>
            <h2 className="font-semibold">{statusLabels[group.status]}</h2>
            <div className="mt-3 space-y-3">
              {group.orders.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Nenhum pedido.
                </p>
              ) : (
                group.orders.map((order) => (
                  <article
                    className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                    key={order.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{order.customerName}</p>
                        <p className="text-sm text-slate-600">{order.customerPhone}</p>
                      </div>
                      <p className="font-bold text-tomato">R$ {order.total}</p>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity}x {item.productNameSnapshot}
                        </li>
                      ))}
                    </ul>
                    {order.stockWarnings && order.stockWarnings.length > 0 ? (
                      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <p className="font-semibold">Atenção no estoque</p>
                        <ul className="mt-1 space-y-1">
                          {order.stockWarnings.map((warning) => (
                            <li key={warning.ingredientId}>
                              {warning.ingredientName}: saldo estimado{" "}
                              {warning.estimatedBalance.toFixed(3)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {nextStatuses[order.status].map((status) => (
                        <button
                          className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white"
                          key={status}
                          onClick={() => void changeStatus(order, status)}
                          type="button"
                        >
                          {statusLabels[status]}
                        </button>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Historico</h2>
        <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {historyOrders.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Sem pedidos finalizados.</p>
          ) : (
            historyOrders.map((order) => (
              <div className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_auto_auto]" key={order.id}>
                <span className="font-medium">{order.customerName}</span>
                <span>{statusLabels[order.status]}</span>
                <span className="font-semibold">R$ {order.total}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function playOrderAlert(): void {
  const AudioContextConstructor = window.AudioContext;
  const audioContext = new AudioContextConstructor();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.08;

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.18);
}
