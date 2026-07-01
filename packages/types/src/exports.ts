export type ExportContext = "PAYABLES" | "MANAGEMENT_REPORT";

export type ExportFormat = "CSV" | "PDF" | "XLSX";

export type ExportJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";

export interface ExportJobRequest<
  TFilters extends Record<string, unknown> = Record<string, unknown>,
> {
  context: ExportContext;
  format: ExportFormat;
  filters: TFilters;
  columns?: string[];
}

export interface ExportJob {
  id: string;
  context: ExportContext;
  format: ExportFormat;
  status: ExportJobStatus;
  filtersSnapshot: Record<string, unknown>;
  columnsSnapshot: string[] | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  downloadUrl: string | null;
}
