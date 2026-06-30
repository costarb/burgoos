import { Inject, Injectable } from "@nestjs/common";
import { ExportContext, Prisma } from "@prisma/client";
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
}

export interface ExportProvider {
  context: ExportContext;
  build(job: ExportProviderJob): Promise<ExportDataset>;
}

@Injectable()
export class ExportProviderRegistry {
  private readonly providers: Map<ExportContext, ExportProvider>;

  constructor(@Inject(PayablesExportProvider) payablesExportProvider: PayablesExportProvider) {
    this.providers = new Map([[payablesExportProvider.context, payablesExportProvider]]);
  }

  get(context: ExportContext): ExportProvider | null {
    return this.providers.get(context) ?? null;
  }
}
