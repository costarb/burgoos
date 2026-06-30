"use client";

import React from "react";
import type { ExportFormat } from "@burgoos/types";

interface AsyncExportMenuProps {
  busy?: boolean;
  disabled?: boolean;
  onExport: (format: ExportFormat) => Promise<void> | void;
}

const formats: Array<{ format: ExportFormat; label: string }> = [
  { format: "CSV", label: "CSV" },
  { format: "PDF", label: "PDF" },
  { format: "XLSX", label: "XLSX" },
];

export function AsyncExportMenu({
  busy = false,
  disabled = false,
  onExport,
}: AsyncExportMenuProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate-700">Exportar</span>
      {formats.map((item) => (
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
  );
}
