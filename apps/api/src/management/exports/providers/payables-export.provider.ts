import { Inject, Injectable } from "@nestjs/common";
import { ExportContext, Prisma } from "@prisma/client";
import { AccountsPayableService } from "../../financial/accounts-payable/accounts-payable.service";
import { PayablesQueryDto } from "../../financial/dto/payable.dto";
import { ExportDataset, ExportProvider, ExportProviderJob } from "../export-provider.registry";

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

  async build(job: ExportProviderJob): Promise<ExportDataset> {
    const response = await this.accountsPayableService.list(
      job.tenantId,
      normalizePayablesFilters(job.filtersSnapshot)
    );

    return {
      title: "Contas a pagar",
      columns: payablesColumns,
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
    status: toOptionalString(source.status),
    categoryId: toOptionalString(source.categoryId),
    supplierId: toOptionalString(source.supplierId),
    competenceMonth: toOptionalString(source.competenceMonth),
  };
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
