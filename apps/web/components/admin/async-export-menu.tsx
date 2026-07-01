"use client";

import React from "react";
import type { ExportFormat } from "@burgoos/types";

interface AsyncExportMenuProps {
  busy?: boolean;
  disabled?: boolean;
  formats?: ExportFormat[];
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
  onExport,
}: AsyncExportMenuProps) {
  const visibleFormats = formats
    ? availableFormats.filter((item) => formats.includes(item.format))
    : availableFormats;

  return (
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
  );
}
