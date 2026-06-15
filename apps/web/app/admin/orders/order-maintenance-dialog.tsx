"use client";

import React, { useEffect, useState } from "react";
import type {
  AdminOrder,
  EditOrderInput,
  OrderMaintenanceRecord,
  PlatformSyncAttemptSummary,
} from "@burgoos/types";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import {
  deleteAdminOrder,
  editAdminOrder,
  getOrderMaintenanceHistory,
  getPlatformSyncAttempts,
} from "../../../lib/api";

interface OrderMaintenanceDialogProps {
  order: AdminOrder;
  token: string;
  onClose: () => void;
  onDeleted: (orderId: string) => void;
  onSaved: (order: AdminOrder) => void;
}

export function OrderMaintenanceDialog({
  order,
  token,
  onClose,
  onDeleted,
  onSaved,
}: OrderMaintenanceDialogProps) {
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [createdAt, setCreatedAt] = useState(toLocalDateTime(order.createdAt));
  const [paymentGrossAmount, setPaymentGrossAmount] = useState(
    order.paymentGrossAmount ?? order.total
  );
  const [paymentFeeAmount, setPaymentFeeAmount] = useState(order.paymentFeeAmount ?? "0.00");
  const [paymentNetAmount, setPaymentNetAmount] = useState(order.paymentNetAmount ?? order.total);
  const [paymentReleaseExpectedAt, setPaymentReleaseExpectedAt] = useState(
    order.paymentReleaseExpectedAt ? toLocalDateTime(order.paymentReleaseExpectedAt) : ""
  );
  const [reason, setReason] = useState("");
  const [items, setItems] = useState(order.items);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<OrderMaintenanceRecord[]>([]);
  const [syncAttempts, setSyncAttempts] = useState<PlatformSyncAttemptSummary[]>([]);

  useEffect(() => {
    void getOrderMaintenanceHistory(token, order.id)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [order.id, token]);

  useEffect(() => {
    if (!order.platformProvider) {
      setSyncAttempts([]);
      return;
    }

    void getPlatformSyncAttempts(token, order.id)
      .then(setSyncAttempts)
      .catch(() => setSyncAttempts([]));
  }, [order.id, order.platformProvider, token]);

  async function save(): Promise<void> {
    setBusy("save");
    setError(null);
    setMessage(null);

    try {
      const payload: EditOrderInput = {
        expectedUpdatedAt: order.updatedAt ?? new Date().toISOString(),
        reason: reason || undefined,
        customerName,
        customerPhone,
        fulfillmentMethod: order.fulfillmentMethod,
        notes,
        createdAt: new Date(createdAt).toISOString(),
        paymentMethod: order.paymentMethod,
        paymentInstitution: order.paymentInstitution,
        externalPaymentId: order.externalPaymentId,
        paymentGrossAmount,
        paymentFeeAmount,
        paymentNetAmount,
        paymentBrand: order.paymentBrand,
        paymentReleaseExpectedAt: paymentReleaseExpectedAt
          ? new Date(paymentReleaseExpectedAt).toISOString()
          : null,
        orderPlatformId: order.orderPlatformId,
        items: items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };
      const updated = await editAdminOrder(token, order.id, payload);
      setMessage("Pedido salvo com sucesso.");
      onSaved(updated);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao alterar pedido.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(): Promise<void> {
    if (reason.trim().length < 3) {
      setError("Informe um motivo com pelo menos 3 caracteres para excluir.");
      return;
    }

    setBusy("delete");
    setError(null);
    setMessage(null);
    try {
      await deleteAdminOrder(token, order.id, {
        expectedUpdatedAt: order.updatedAt ?? new Date().toISOString(),
        reason,
      });
      onDeleted(order.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao excluir pedido.");
    } finally {
      setBusy(null);
    }
  }

  const finalized = order.status === "DELIVERED" || order.status === "CANCELLED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Alterar pedido</h2>
            <p className="text-xs text-slate-500">{order.id}</p>
          </div>
          <button className="px-2 py-1 text-xl" onClick={onClose} title="Fechar" type="button">
            ×
          </button>
        </div>

        {finalized ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Este pedido esta finalizado. A alteracao recalculara estoque e resultados financeiros.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Cliente
            <input
              className="mt-1 w-full rounded-md border p-2"
              onChange={(event) => setCustomerName(event.target.value)}
              value={customerName}
            />
          </label>
          <label className="text-sm">
            Telefone
            <input
              className="mt-1 w-full rounded-md border p-2"
              onChange={(event) => setCustomerPhone(event.target.value)}
              value={customerPhone}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            Data da venda
            <input
              className="mt-1 w-full rounded-md border p-2"
              onChange={(event) => setCreatedAt(event.target.value)}
              type="datetime-local"
              value={createdAt}
            />
          </label>
          <label className="text-sm">
            Data de liberacao
            <input
              className="mt-1 w-full rounded-md border p-2"
              onChange={(event) => setPaymentReleaseExpectedAt(event.target.value)}
              type="datetime-local"
              value={paymentReleaseExpectedAt}
            />
          </label>
          <label className="text-sm">
            Valor bruto
            <input
              className="mt-1 w-full rounded-md border p-2"
              min={0}
              onChange={(event) => setPaymentGrossAmount(event.target.value)}
              step="0.01"
              type="number"
              value={paymentGrossAmount}
            />
          </label>
          <label className="text-sm">
            Taxa
            <input
              className="mt-1 w-full rounded-md border p-2"
              min={0}
              onChange={(event) => setPaymentFeeAmount(event.target.value)}
              step="0.01"
              type="number"
              value={paymentFeeAmount}
            />
          </label>
          <label className="text-sm">
            Valor liquido
            <input
              className="mt-1 w-full rounded-md border p-2"
              min={0}
              onChange={(event) => setPaymentNetAmount(event.target.value)}
              step="0.01"
              type="number"
              value={paymentNetAmount}
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">Itens</h3>
          {items.map((item, index) => (
            <div className="grid grid-cols-[1fr_90px_120px] gap-2" key={item.id}>
              <span className="self-center text-sm">{item.productNameSnapshot}</span>
              <input
                aria-label={`Quantidade ${item.productNameSnapshot}`}
                className="rounded-md border p-2 text-sm"
                min={1}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((currentItem, currentIndex) =>
                      currentIndex === index
                        ? { ...currentItem, quantity: Number(event.target.value) }
                        : currentItem
                    )
                  )
                }
                type="number"
                value={item.quantity}
              />
              <input
                aria-label={`Preco ${item.productNameSnapshot}`}
                className="rounded-md border p-2 text-sm"
                min={0}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((currentItem, currentIndex) =>
                      currentIndex === index
                        ? { ...currentItem, unitPrice: event.target.value }
                        : currentItem
                    )
                  )
                }
                step="0.01"
                type="number"
                value={item.unitPrice}
              />
            </div>
          ))}
        </div>

        <label className="mt-4 block text-sm">
          Observacoes
          <textarea
            className="mt-1 w-full rounded-md border p-2"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
        <label className="mt-4 block text-sm">
          Motivo da manutencao
          <textarea
            className="mt-1 w-full rounded-md border p-2"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>

        <OperationFeedback
          className="mt-3"
          state={{
            status: error ? "error" : busy ? "pending" : message ? "success" : "idle",
            message:
              error ??
              message ??
              (busy === "save"
                ? "Salvando alteracoes do pedido."
                : busy === "delete"
                  ? "Excluindo pedido."
                  : undefined),
          }}
        />

        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <button
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
            disabled={busy !== null}
            onClick={() => void remove()}
            type="button"
          >
            {busy === "delete" ? "Excluindo..." : "Excluir pedido"}
          </button>
          <div className="flex gap-2">
            <button
              className="rounded-md border px-4 py-2 text-sm"
              disabled={busy !== null}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
              disabled={busy !== null}
              onClick={() => void save()}
              type="button"
            >
              {busy === "save" ? "Salvando..." : "Salvar alteracoes"}
            </button>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          {order.platformProvider ? (
            <div className="mb-5">
              <h3 className="text-sm font-semibold">Sincronizacao da plataforma</h3>
              {syncAttempts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nenhuma tentativa registrada.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {syncAttempts.map((attempt) => (
                    <li className="rounded-md border border-slate-200 p-3 text-sm" key={attempt.id}>
                      <div className="flex justify-between gap-3">
                        <strong>
                          {platformActionLabel(attempt.action)} -{" "}
                          {platformSyncStatusLabel(attempt.status)}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {new Date(attempt.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      {attempt.errorMessage ? (
                        <p className="mt-1 text-xs text-red-700">{attempt.errorMessage}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <h3 className="text-sm font-semibold">Historico de manutencoes</h3>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nenhuma manutencao registrada.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {history.map((record) => (
                <li className="rounded-md border border-slate-200 p-3 text-sm" key={record.id}>
                  <div className="flex justify-between gap-3">
                    <strong>{record.action === "EDIT" ? "Alteracao" : "Exclusao"}</strong>
                    <span className="text-xs text-slate-500">
                      {new Date(record.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-1">{record.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">Responsavel: {record.actorName}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function toLocalDateTime(value?: string): string {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function platformActionLabel(action: PlatformSyncAttemptSummary["action"]): string {
  const labels: Record<PlatformSyncAttemptSummary["action"], string> = {
    CONFIRM: "Aceite",
    REFUSE: "Recusa",
    START_PREPARATION: "Inicio do preparo",
    READY_TO_PICKUP: "Pronto para retirada",
    DISPATCH: "Saiu para entrega",
    DELIVER: "Entregue",
    REQUEST_CANCELLATION: "Cancelamento",
    RESPOND_DISPUTE: "Resposta de disputa",
  };

  return labels[action];
}

function platformSyncStatusLabel(status: PlatformSyncAttemptSummary["status"]): string {
  const labels: Record<PlatformSyncAttemptSummary["status"], string> = {
    PENDING: "pendente",
    SENT: "enviado",
    CONFIRMED: "confirmado",
    FAILED: "falhou",
    RETRYABLE: "tentara novamente",
    CANCELLED: "cancelado",
  };

  return labels[status];
}
