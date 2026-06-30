"use client";

import React from "react";
import type { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <section
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-xl"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-amber-100 p-2 text-amber-800">
            <AlertTriangle aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-950" id="confirmation-title">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <button
            aria-label="Fechar"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? "Processando..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
