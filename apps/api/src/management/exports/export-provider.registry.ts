import { Inject, Injectable } from "@nestjs/common";
import { ExportContext, Prisma } from "@prisma/client";
import { ManagementReportExportProvider } from "./providers/management-report-export.provider";
import { PayablesExportProvider } from "./providers/payables-export.provider";

export interface ExportProviderJob {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  filtersSnapshot: Prisma.JsonValue;
  columnsSnapshot: Prisma.JsonValue | null;
}

export interface ExportColumn {
  key: string;
  label: string;
}

export interface ExportDataset {
  title: string;
  columns: ExportColumn[];
  rows: Array<Record<string, string | number | null>>;
  layout?: "MANAGEMENT_REPORT";
  metadata?: Record<string, unknown>;
}

export interface ExportDescriptor extends Omit<ExportDataset, "rows"> {
  totalRows: number;
}

export interface ExportRowBatch {
  rows: ExportDataset["rows"];
  nextCursor: string | null;
}

export interface ExportProvider {
  context: ExportContext;
  describe(job: ExportProviderJob): Promise<ExportDescriptor>;
  readBatch(job: ExportProviderJob, cursor: string | null, limit: number): Promise<ExportRowBatch>;
}

@Injectable()
export class ExportProviderRegistry {
  private readonly providers: Map<ExportContext, ExportProvider>;

  constructor(
    @Inject(PayablesExportProvider) payablesExportProvider: PayablesExportProvider,
    @Inject(ManagementReportExportProvider)
    managementReportExportProvider: ManagementReportExportProvider
  ) {
    this.providers = new Map<ExportContext, ExportProvider>([
      [payablesExportProvider.context, payablesExportProvider],
      [managementReportExportProvider.context, managementReportExportProvider],
    ]);
  }

  get(context: ExportContext): ExportProvider | null {
    return this.providers.get(context) ?? null;
  }
}
