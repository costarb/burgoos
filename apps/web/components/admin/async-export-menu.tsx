"use client";

import React from "react";
import type { ExportFormat, ExportJob } from "@burgoos/types";

interface AsyncExportMenuProps {
  busy?: boolean;
  disabled?: boolean;
  formats?: ExportFormat[];
  progress?: ExportJob["progress"] | null;
  onExport: (format: ExportFormat) => Promise<void> | void;
}

const availableFormats: Array<{ format: ExportFormat; label: string }> = [
  { format: "CSV", label: "CSV" },
  { format: "PDF", label: "PDF" },
  { format: "XLSX", label: "XLSX" },
];

export function AsyncExportMenu({
  busy = false,
  disabled = false,
  formats,
  progress,
  onExport,
}: AsyncExportMenuProps) {
  const visibleFormats = formats
    ? availableFormats.filter((item) => formats.includes(item.format))
    : availableFormats;
  const percentage = progress?.totalRows
    ? Math.min(100, Math.round((progress.processedRows / progress.totalRows) * 100))
    : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">Exportar</span>
        {visibleFormats.map((item) => (
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            disabled={busy || disabled}
            key={item.format}
            onClick={() => {
              void onExport(item.format);
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {progress ? (
        <div aria-live="polite" className="max-w-sm text-xs text-slate-600">
          <div className="flex justify-between gap-3">
            <span>{progress.message ?? "Processando exportação"}</span>
            <span>
              {progress.processedRows}
              {progress.totalRows !== null ? ` de ${progress.totalRows}` : ""}
            </span>
          </div>
          {percentage !== null ? (
            <progress
              aria-label="Progresso da exportação"
              className="mt-1 h-2 w-full"
              max={100}
              value={percentage}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
