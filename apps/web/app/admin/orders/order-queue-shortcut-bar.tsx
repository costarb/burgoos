"use client";

import React from "react";
import type { KdsOrder } from "@burgoos/types";
import type { OrderQueuePosition } from "./use-order-queue-shortcuts";
import { isPendingPlatformOrder } from "./order-queue-helpers";

interface OrderQueueShortcutBarProps {
  selectedOrder: KdsOrder | null;
  position: OrderQueuePosition | null;
  pendingCancelOrderId: string | null;
}

export function OrderQueueShortcutBar({
  selectedOrder,
  position,
  pendingCancelOrderId,
}: OrderQueueShortcutBarProps) {
  if (!selectedOrder) {
    return (
      <div className="sticky bottom-4 z-10 mt-6 rounded-md border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-500 shadow-lg backdrop-blur">
        Pressione <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-xs">Tab</kbd> para
        selecionar um pedido e usar os atalhos de teclado.
      </div>
    );
  }

  const isPendingIfood = isPendingPlatformOrder(selectedOrder);
  const primaryLabel = isPendingIfood ? "Aceitar iFood" : "Avancar";
  const destructiveLabel = isPendingIfood ? "Recusar" : "Cancelar";
  const canCharge = !selectedOrder.serviceTabId;
  const confirmingCancel = pendingCancelOrderId === selectedOrder.id;

  return (
    <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
      <div>
        <p className="font-semibold">
          {position ? `${position.index}/${position.total} - ` : ""}
          {selectedOrder.customerName} <span className="text-slate-500">#{selectedOrder.publicCode}</span>
        </p>
        {confirmingCancel ? (
          <p className="mt-1 font-semibold text-red-700">
            Aperte F3 novamente para confirmar {destructiveLabel.toLowerCase()}.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <ShortcutKey label={primaryLabel} shortcut="F2" />
        <ShortcutKey
          label={confirmingCancel ? `Confirmar ${destructiveLabel.toLowerCase()}` : destructiveLabel}
          shortcut="F3"
          tone={confirmingCancel ? "danger" : "default"}
        />
        {canCharge ? <ShortcutKey label="Cobrar" shortcut="F4" /> : null}
      </div>
    </div>
  );
}

function ShortcutKey({
  label,
  shortcut,
  tone = "default",
}: {
  label: string;
  shortcut: string;
  tone?: "default" | "danger";
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${
        tone === "danger" ? "border-red-300 bg-red-50 text-red-800" : "border-slate-300 bg-slate-50"
      }`}
    >
      <kbd className="rounded border border-current px-1.5 py-0.5">{shortcut}</kbd>
      {label}
    </span>
  );
}
