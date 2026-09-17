import { Inject, Injectable } from "@nestjs/common";
import { ExportContext, Prisma } from "@prisma/client";
import { AccountsPayableService } from "../../financial/accounts-payable/accounts-payable.service";
import { PayablesQueryDto } from "../../financial/dto/payable.dto";
import {
  ExportDescriptor,
  ExportProvider,
  ExportProviderJob,
  ExportRowBatch,
} from "../export-provider.registry";

const payablesColumns = [
  { key: "description", label: "Conta" },
  { key: "categoryName", label: "Categoria" },
  { key: "supplierName", label: "Fornecedor" },
  { key: "competenceDate", label: "Competencia" },
  { key: "dueDate", label: "Vencimento" },
  { key: "expectedAmount", label: "Previsto" },
  { key: "paidAmount", label: "Pago" },
  { key: "remainingAmount", label: "Em aberto" },
  { key: "status", label: "Status" },
];

@Injectable()
export class PayablesExportProvider implements ExportProvider {
  readonly context = ExportContext.PAYABLES;

  constructor(
    @Inject(AccountsPayableService) private readonly accountsPayableService: AccountsPayableService
  ) {}

  async describe(job: ExportProviderJob): Promise<ExportDescriptor> {
    const response = await this.accountsPayableService.list(job.tenantId, {
      ...normalizePayablesFilters(job.filtersSnapshot),
      page: 1,
      pageSize: 1,
    });

    return {
      title: "Contas a pagar",
      columns: payablesColumns,
      totalRows: response.total ?? response.items.length,
    };
  }

  async readBatch(
    job: ExportProviderJob,
    cursor: string | null,
    limit: number
  ): Promise<ExportRowBatch> {
    const page = cursor ? Number(cursor) : 1;
    if (!Number.isInteger(page) || page < 1) throw new Error("Cursor de exportacao invalido");
    const response = await this.accountsPayableService.list(job.tenantId, {
      ...normalizePayablesFilters(job.filtersSnapshot),
      page,
      pageSize: limit,
    });
    return {
      rows: response.items.map((payable) => ({
        description: payable.description,
        categoryName: payable.categoryName,
        supplierName: payable.supplierName ?? "",
        competenceDate: payable.competenceDate ?? "",
        dueDate: payable.dueDate,
        expectedAmount: payable.expectedAmount,
        paidAmount: payable.paidAmount,
        remainingAmount: payable.remainingAmount,
        status: payable.status,
      })),
      nextCursor: page * limit < (response.total ?? 0) ? String(page + 1) : null,
    };
  }
}

function normalizePayablesFilters(value: Prisma.JsonValue): PayablesQueryDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  return {
    start: toOptionalString(source.start),
    end: toOptionalString(source.end),
    status: toOptionalStrings(source.status),
    categoryId: toOptionalStrings(source.categoryId),
    supplierId: toOptionalStrings(source.supplierId),
    competenceMonth: toOptionalString(source.competenceMonth),
  };
}

function toOptionalStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value))
    return toOptionalString(value) ? [toOptionalString(value)!] : undefined;
  const values = value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
  return values.length ? values : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
