"use client";

import React from "react";
import type { OperationState } from "@burgoos/types";
import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";

interface OperationFeedbackProps {
  state: OperationState;
  onDismiss?: () => void;
  className?: string;
}

export function OperationFeedback({ state, onDismiss, className = "" }: OperationFeedbackProps) {
  if (state.status === "idle") {
    return null;
  }

  const appearance = {
    pending: {
      icon: <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" />,
      label: "Processando",
      classes: "border-sky-200 bg-sky-50 text-sky-900",
    },
    success: {
      icon: <CheckCircle2 aria-hidden className="h-5 w-5" />,
      label: "Concluido",
      classes: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    error: {
      icon: <AlertCircle aria-hidden className="h-5 w-5" />,
      label: "Nao foi possivel concluir",
      classes: "border-red-200 bg-red-50 text-red-900",
    },
  }[state.status];

  const progress =
    state.progress && state.progress.total > 0
      ? Math.min(100, Math.round((state.progress.current / state.progress.total) * 100))
      : null;

  return (
    <section
      aria-live={state.status === "error" ? "assertive" : "polite"}
      className={`rounded-md border p-3 ${appearance.classes} ${className}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{appearance.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{appearance.label}</p>
          {state.message ? <p className="mt-0.5 text-sm">{state.message}</p> : null}
          {progress !== null ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs font-medium">
                <span>{state.progress?.label ?? "Progresso"}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-white/70">
                <div className="h-full bg-current transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          {state.result ? <ResultCounts result={state.result} /> : null}
        </div>
        {onDismiss && state.status !== "pending" ? (
          <button
            aria-label="Fechar mensagem"
            className="shrink-0 rounded p-1 hover:bg-black/5"
            onClick={onDismiss}
            type="button"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ResultCounts({ result }: { result: NonNullable<OperationState["result"]> }) {
  const entries = [
    ["Processados", result.processed],
    ["Concluidos", result.completed],
    ["Ignorados", result.skipped],
    ["Com erro", result.failed],
  ].filter((entry): entry is [string, number] => typeof entry[1] === "number");

  if (entries.length === 0) {
    return null;
  }

  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {entries.map(([label, value]) => (
        <div className="flex gap-1" key={label}>
          <dt>{label}:</dt>
          <dd className="font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
