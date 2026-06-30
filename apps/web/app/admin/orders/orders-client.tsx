"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import type { AdminOrder, OrderStatus, PaymentInstitution, PaymentMethod } from "@burgoos/types";
import {
  confirmPlatformOrder,
  getPlatformCancellationReasons,
  refusePlatformOrder,
  updateAdminOrderStatus,
} from "../../../lib/api";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import { OrderMaintenanceDialog } from "./order-maintenance-dialog";

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
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [changingOrderId, setChangingOrderId] = useState<string | null>(null);
  const [platformActionOrderId, setPlatformActionOrderId] = useState<string | null>(null);
  const [refusingOrderId, setRefusingOrderId] = useState<string | null>(null);
  const [refuseForms, setRefuseForms] = useState<
    Record<string, { providerReasonId: string; reason: string }>
  >({});
  const [cancellationReasons, setCancellationReasons] = useState<
    Record<string, Array<{ id: string; description: string }>>
  >({});
  const [connected, setConnected] = useState(false);
  const [maintenanceOrder, setMaintenanceOrder] = useState<AdminOrder | null>(null);

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
    setOperationMessage(null);
    setChangingOrderId(order.id);

    try {
      const updatedOrder = await updateAdminOrderStatus(token, order.id, status);
      setOperationMessage(
        `Pedido de ${order.customerName} atualizado para ${statusLabels[status]}.`
      );

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
    } finally {
      setChangingOrderId(null);
    }
  }

  async function acceptPlatformOrder(order: AdminOrder): Promise<void> {
    setError(null);
    setOperationMessage(null);
    setPlatformActionOrderId(order.id);

    try {
      const updatedOrder = await confirmPlatformOrder(token, order.id);
      setOperationMessage(`Pedido iFood de ${order.customerName} aceito.`);
      setActiveOrders((current) =>
        current.map((item) => (item.id === order.id ? updatedOrder : item))
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao aceitar pedido.");
    } finally {
      setPlatformActionOrderId(null);
    }
  }

  async function openRefuseForm(order: AdminOrder): Promise<void> {
    setError(null);
    setRefusingOrderId(order.id);

    if (cancellationReasons[order.id]) {
      return;
    }

    try {
      const reasons = await getPlatformCancellationReasons(token, order.id);
      setCancellationReasons((current) => ({ ...current, [order.id]: reasons }));
      setRefuseForms((current) => ({
        ...current,
        [order.id]: {
          providerReasonId: reasons[0]?.id ?? "501",
          reason: reasons[0]?.description ?? "",
        },
      }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao carregar motivos.");
    }
  }

  async function submitRefuse(order: AdminOrder): Promise<void> {
    const form = refuseForms[order.id] ?? { providerReasonId: "501", reason: "" };
    setError(null);
    setOperationMessage(null);
    setPlatformActionOrderId(order.id);

    try {
      const updatedOrder = await refusePlatformOrder(token, order.id, form);
      setOperationMessage(`Pedido iFood de ${order.customerName} recusado.`);
      setActiveOrders((current) => current.filter((item) => item.id !== order.id));
      setHistoryOrders((current) => [updatedOrder, ...current]);
      setRefusingOrderId(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao recusar pedido.");
    } finally {
      setPlatformActionOrderId(null);
    }
  }

  function replaceOrder(updatedOrder: AdminOrder): void {
    setActiveOrders((current) =>
      current.map((item) => (item.id === updatedOrder.id ? updatedOrder : item))
    );
    setHistoryOrders((current) =>
      current.map((item) => (item.id === updatedOrder.id ? updatedOrder : item))
    );
    setMaintenanceOrder(null);
  }

  function removeOrder(orderId: string): void {
    setActiveOrders((current) => current.filter((item) => item.id !== orderId));
    setHistoryOrders((current) => current.filter((item) => item.id !== orderId));
    setMaintenanceOrder(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-tomato">Pedidos</p>
          <h1 className="mt-1 text-3xl font-semibold">Fila operacional</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/orders/import"
          >
            Importar historico
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/orders/maintenance"
          >
            Manutencao
          </a>
          <span className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            {connected ? "Realtime conectado" : "Realtime desconectado"}
          </span>
        </div>
      </div>

      <OperationFeedback
        className="mt-4"
        state={{
          status: error
            ? "error"
            : changingOrderId || platformActionOrderId
              ? "pending"
              : operationMessage
                ? "success"
                : "idle",
          message:
            error ??
            operationMessage ??
            (changingOrderId || platformActionOrderId
              ? "Sincronizando status do pedido."
              : undefined),
        }}
      />

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
                        <p className="mt-1 text-xs text-slate-500">{paymentSummary(order)}</p>
                        {order.platformProvider ? (
                          <p className="mt-1 text-xs font-semibold text-tomato">
                            {order.platformProvider}
                            {order.externalOrderId ? ` - ${order.externalOrderId}` : ""}
                            {order.platformConfirmationDeadlineAt
                              ? ` - confirmar ate ${formatTime(order.platformConfirmationDeadlineAt)}`
                              : ""}
                          </p>
                        ) : null}
                        {order.platformConfirmationState ? (
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              order.platformConfirmationState === "EXPIRED"
                                ? "text-red-700"
                                : order.platformConfirmationState === "DUE_SOON"
                                  ? "text-amber-700"
                                  : "text-slate-500"
                            }`}
                          >
                            {confirmationStateLabel(order.platformConfirmationState)}
                          </p>
                        ) : null}
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
                    {order.platformSyncStatus === "RETRYABLE" ? (
                      <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                        <p className="font-semibold">Sincronizacao com iFood pendente</p>
                        <p>{order.platformSyncError ?? "A ultima tentativa falhou."}</p>
                        {order.platformSyncNextRetryAt ? (
                          <p>
                            Nova tentativa indicada apos {formatTime(order.platformSyncNextRetryAt)}
                            .
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {isPendingPlatformOrder(order) && refusingOrderId === order.id ? (
                      <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <select
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                          onChange={(event) =>
                            setRefuseForms((current) => ({
                              ...current,
                              [order.id]: {
                                ...(current[order.id] ?? { reason: "" }),
                                providerReasonId: event.target.value,
                                reason:
                                  cancellationReasons[order.id]?.find(
                                    (reason) => reason.id === event.target.value
                                  )?.description ??
                                  current[order.id]?.reason ??
                                  "",
                              },
                            }))
                          }
                          value={refuseForms[order.id]?.providerReasonId ?? ""}
                        >
                          {(cancellationReasons[order.id] ?? []).map((reason) => (
                            <option key={reason.id} value={reason.id}>
                              {reason.description}
                            </option>
                          ))}
                        </select>
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) =>
                            setRefuseForms((current) => ({
                              ...current,
                              [order.id]: {
                                providerReasonId:
                                  current[order.id]?.providerReasonId ??
                                  cancellationReasons[order.id]?.[0]?.id ??
                                  "501",
                                reason: event.target.value,
                              },
                            }))
                          }
                          placeholder="Complemento do motivo"
                          value={refuseForms[order.id]?.reason ?? ""}
                        />
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold"
                        disabled={changingOrderId !== null}
                        onClick={() => setMaintenanceOrder(order)}
                        type="button"
                      >
                        Alterar
                      </button>
                      {isPendingPlatformOrder(order) ? (
                        <>
                          <button
                            className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={
                              platformActionOrderId !== null ||
                              order.platformConfirmationState === "EXPIRED"
                            }
                            onClick={() => void acceptPlatformOrder(order)}
                            type="button"
                          >
                            Aceitar iFood
                          </button>
                          {refusingOrderId === order.id ? (
                            <button
                              className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={platformActionOrderId !== null}
                              onClick={() => void submitRefuse(order)}
                              type="button"
                            >
                              Confirmar recusa
                            </button>
                          ) : (
                            <button
                              className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={platformActionOrderId !== null}
                              onClick={() => void openRefuseForm(order)}
                              type="button"
                            >
                              Recusar
                            </button>
                          )}
                        </>
                      ) : (
                        nextStatuses[order.status].map((status) => (
                          <button
                            className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={changingOrderId !== null}
                            key={status}
                            onClick={() => void changeStatus(order, status)}
                            type="button"
                          >
                            {statusLabels[status]}
                          </button>
                        ))
                      )}
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
              <div
                className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto_auto_auto]"
                key={order.id}
              >
                <span>
                  <span className="block font-medium">{order.customerName}</span>
                  <span className="block text-xs text-slate-500">{paymentSummary(order)}</span>
                </span>
                <span>{statusLabels[order.status]}</span>
                <span className="font-semibold">R$ {order.total}</span>
                <button
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold"
                  onClick={() => setMaintenanceOrder(order)}
                  type="button"
                >
                  Alterar
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      {maintenanceOrder ? (
        <OrderMaintenanceDialog
          onClose={() => setMaintenanceOrder(null)}
          onDeleted={removeOrder}
          onSaved={replaceOrder}
          order={maintenanceOrder}
          token={token}
        />
      ) : null}
    </div>
  );
}

function paymentSummary(order: AdminOrder): string {
  return `${paymentInstitutionLabel(order.paymentInstitution ?? null)} / ${paymentMethodLabel(
    order.paymentMethod
  )}`;
}

function paymentInstitutionLabel(value: PaymentInstitution | null): string {
  const labels: Record<PaymentInstitution, string> = {
    PAGBANK: "PagBank",
    MERCADO_PAGO: "Mercado Pago",
    DINHEIRO: "Dinheiro",
    CAIXA_LOCAL: "Caixa local",
  };

  return value ? labels[value] : "Nao informado";
}

function paymentMethodLabel(value: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Dinheiro",
    PIX_MANUAL: "PIX",
    CARD_ON_DELIVERY: "Cartao",
    DEBIT_CARD: "Debito",
    CREDIT_CARD: "Credito",
    VOUCHER: "Voucher",
    PIX: "Pix",
  };

  return labels[value];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isPendingPlatformOrder(order: AdminOrder): boolean {
  return order.platformProvider === "IFOOD" && order.status === "PENDING";
}

function confirmationStateLabel(value: NonNullable<AdminOrder["platformConfirmationState"]>) {
  const labels: Record<NonNullable<AdminOrder["platformConfirmationState"]>, string> = {
    OK: "Dentro do prazo de aceite",
    DUE_SOON: "Prazo de aceite perto do limite",
    EXPIRED: "Prazo de aceite expirado",
  };

  return labels[value];
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
