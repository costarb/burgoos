"use client";

import React, { useState } from "react";
import type { OperationalAssignment } from "@burgoos/types";
import { readAuthSession } from "../../../lib/auth-client";
import { PointChargePanel } from "./point-charge-panel";
import { ManualPaymentPanel } from "./manual-payment-panel";

export function PaymentCheckoutDialog({
  title,
  targetType,
  targetId,
  amount,
  assignment,
  onClose,
  onApproved,
}: {
  title: string;
  targetType: "ORDER" | "SERVICE_TAB";
  targetId: string;
  amount: string;
  assignment?: OperationalAssignment | null;
  onClose: () => void;
  onApproved?: () => void;
}) {
  const [mode, setMode] = useState<"MANUAL" | "POINT">("MANUAL");
  const ownedByAnother =
    Boolean(assignment) && assignment?.userId !== readAuthSession()?.user.id;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-slate-500">Saldo a cobrar: R$ {amount}</p>
          </div>
          <button aria-label="Fechar checkout" className="rounded border px-3 py-2" onClick={onClose} type="button">×</button>
        </div>
        {ownedByAnother ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            Responsavel atual: {assignment?.userName}. Transfira a responsabilidade antes de cobrar.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button
                className={`min-h-11 rounded-md px-3 text-sm font-semibold ${mode === "MANUAL" ? "bg-white shadow" : "text-slate-600"}`}
                onClick={() => setMode("MANUAL")}
                type="button"
              >
                Caixa / PagBank
              </button>
              <button
                className={`min-h-11 rounded-md px-3 text-sm font-semibold ${mode === "POINT" ? "bg-white shadow" : "text-slate-600"}`}
                onClick={() => setMode("POINT")}
                type="button"
              >
                Mercado Pago Point
              </button>
            </div>
            {mode === "MANUAL" ? (
              <ManualPaymentPanel
                amount={amount}
                onApproved={onApproved}
                targetId={targetId}
                targetType={targetType}
              />
            ) : (
              <PointChargePanel
                amount={amount}
                onApproved={onApproved}
                targetId={targetId}
                targetType={targetType}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
