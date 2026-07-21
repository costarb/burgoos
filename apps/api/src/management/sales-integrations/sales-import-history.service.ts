import { Injectable, NotFoundException } from "@nestjs/common";
import { ExternalMovementStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { SalesPaginationDto } from "./dto/sales-integration.dto";

@Injectable()
export class SalesImportHistoryService {
  constructor(private readonly prisma: PrismaService) {}
  async list(tenantId: string, query: SalesPaginationDto) {
    const where = { tenantId };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.salesImportRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          integration: {
            select: {
              credentialMode: true,
              environment: true,
              providerUserId: true,
              status: true,
              lastSyncAt: true,
            },
          },
        },
      }),
      this.prisma.salesImportRun.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        errorMessage: this.safeMessage(item.errorMessage),
        integration: {
          ...item.integration,
          lastSyncAt: item.integration.lastSyncAt?.toISOString() ?? null,
        },
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
  async movements(tenantId: string, runId: string, query: SalesPaginationDto) {
    const run = await this.prisma.salesImportRun.findFirst({
      where: { id: runId, tenantId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Execucao nao encontrada");
    const where = {
      tenantId,
      runId,
      ...(query.status ? { status: query.status as ExternalMovementStatus } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.externalSalesMovement.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          providerMovementId: true,
          externalSaleId: true,
          kind: true,
          status: true,
          occurredAt: true,
          grossAmount: true,
          netAmount: true,
          feeAmount: true,
          paymentMethod: true,
          installments: true,
          rejectionCode: true,
          rejectionMessage: true,
          orderId: true,
          rawPayload: true,
        },
      }),
      this.prisma.externalSalesMovement.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        rawPayload: undefined,
        occurredAt: item.occurredAt?.toISOString() ?? null,
        providerCreatedAt: this.providerDate(item.rawPayload, "date_created"),
        providerReleaseAt: this.providerDate(item.rawPayload, "money_release_date"),
        grossAmount: item.grossAmount?.toFixed(2) ?? null,
        netAmount: item.netAmount?.toFixed(2) ?? null,
        feeAmount: item.feeAmount?.toFixed(2) ?? null,
        rejectionMessage: this.safeMessage(item.rejectionMessage),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
  private safeMessage(value: string | null): string | null {
    if (!value) return null;
    if (/(token|authorization|bearer|basic|credential)/i.test(value))
      return "Detalhes sensiveis removidos";
    return value.slice(0, 500);
  }

  private providerDate(value: unknown, field: string): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const candidate = (value as Record<string, unknown>)[field];
    return typeof candidate === "string" ? candidate : null;
  }
}
