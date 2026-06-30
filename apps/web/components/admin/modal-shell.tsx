"use client";

import React, { type ReactNode } from "react";

interface ModalShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
}

export function ModalShell({
  title,
  description,
  children,
  busy = false,
  onClose,
}: ModalShellProps) {
  return (
    <div
      aria-labelledby="modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950" id="modal-title">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Fechar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
