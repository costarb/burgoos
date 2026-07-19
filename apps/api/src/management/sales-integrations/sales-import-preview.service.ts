import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ExternalMovementStatus, Prisma, SalesImportDayStatus, SalesIntegrationStatus } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { CreateSalesImportRunDto } from "./dto/sales-integration.dto";
import { SalesIntegrationService } from "./sales-integration.service";
import { SalesProviderRegistry } from "./sales-provider.registry";

const EMPTY_COUNTS = { found: 0, new: 0, duplicate: 0, rejected: 0, imported: 0, failed: 0, blockedDays: 0 };

@Injectable()
export class SalesImportPreviewService {
  constructor(private readonly prisma: PrismaService, private readonly integrations: SalesIntegrationService, private readonly registry: SalesProviderRegistry, private readonly secrets: IntegrationSecretService) {}

  async create(tenantId: string, userId: string, dto: CreateSalesImportRunDto) {
    const start = new Date(`${dto.startDate}T00:00:00.000Z`); const end = new Date(`${dto.endDate}T00:00:00.000Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const { integration } = await this.integrations.getCredential(tenantId, dto.integrationId);
    const adapter = this.registry.get(integration.provider);
    if (days < 1 || days > adapter.capabilities.maxPeriodDays) throw new BadRequestException(`Periodo deve conter entre 1 e ${adapter.capabilities.maxPeriodDays} dias`);
    if (integration.status !== SalesIntegrationStatus.ACTIVE) throw new ConflictException("Integracao deve estar ativa");
    const overlap = await this.prisma.salesImportRun.findFirst({ where: { tenantId, provider: integration.provider, status: { in: ["PENDING", "FETCHING", "IMPORTING"] }, startDate: { lte: end }, endDate: { gte: start } } });
    if (overlap) throw new ConflictException("Ja existe processamento sobreposto");
    const run = await this.prisma.salesImportRun.create({ data: { tenantId, integrationId: integration.id, provider: integration.provider, channel: integration.channel, requestedByUserId: userId, startDate: start, endDate: end, strategy: dto.strategy, fixedProductId: dto.fixedProductId, counts: EMPTY_COUNTS } });
    return run;
  }

  async process(runId: string, tenantId: string) {
    const run = await this.prisma.salesImportRun.update({ where: { id: runId }, data: { status: "FETCHING", startedAt: new Date() }, include: { integration: { include: { credentials: { where: { status: "ACTIVE" }, take: 1 } } } } });
    const credential = run.integration.credentials[0];
    if (!credential || !run.integration.externalMerchantId) throw new ConflictException("Configuracao incompleta");
    const adapter = this.registry.get(run.provider); const counts = { ...EMPTY_COUNTS }; let ready = 0;
    for (let cursor = new Date(run.startDate); cursor <= run.endDate; cursor = new Date(cursor.getTime() + 86400000)) {
      const date = cursor.toISOString().slice(0, 10); const today = new Date().toISOString().slice(0, 10);
      const day = await this.prisma.salesImportDay.upsert({
        where: { runId_movementDate: { runId, movementDate: cursor } },
        create: { tenantId, runId, movementDate: cursor, status: date >= today ? "BLOCKED_DATE" : "FETCHING" },
        update: { status: date >= today ? "BLOCKED_DATE" : "FETCHING", errorCode: null, errorMessage: null, completedAt: null },
      });
      if (date >= today) { counts.blockedDays += 1; continue; }
      try {
        const result = await adapter.fetchDay({ date, merchantId: run.integration.externalMerchantId, credential: this.secrets.decrypt(credential.secretCiphertext) });
        if (!result.validated) { counts.blockedDays += 1; await this.prisma.salesImportDay.update({ where: { id: day.id }, data: { status: "BLOCKED_NOT_VALIDATED", validated: false, pagesFetched: result.pagesFetched, totalPages: result.totalPages, totalElements: result.totalElements, completedAt: new Date() } }); continue; }
        await this.prisma.externalSalesMovement.deleteMany({ where: { runId, dayId: day.id } });
        ready += 1; counts.found += result.movements.length;
        for (const movement of result.movements) {
          const duplicate = movement.externalSaleId ? Boolean(await this.prisma.externalSaleIdentity.findUnique({ where: { tenantId_provider_externalSaleId: { tenantId, provider: run.provider, externalSaleId: movement.externalSaleId } } })) : false;
          const status: ExternalMovementStatus = duplicate ? "DUPLICATE" : movement.sale ? "NEW" : "REJECTED";
          if (status === "NEW") counts.new += 1; else if (status === "DUPLICATE") counts.duplicate += 1; else counts.rejected += 1;
          await this.prisma.externalSalesMovement.create({ data: { tenantId, runId, dayId: day.id, integrationId: run.integrationId, provider: run.provider, channel: run.channel, providerMovementId: movement.providerMovementId, externalSaleId: movement.externalSaleId, externalEventCode: movement.externalEventCode, kind: movement.kind, status, occurredAt: movement.sale ? new Date(movement.sale.occurredAt) : null, grossAmount: movement.sale?.grossAmount, netAmount: movement.sale?.netAmount, feeAmount: movement.sale?.feeAmount, paymentMethod: movement.sale?.paymentMethod, installments: movement.sale?.installments, normalizedData: movement.sale ? JSON.parse(JSON.stringify(movement.sale)) as Prisma.InputJsonValue : undefined, rawPayload: this.secrets.redact(movement.raw) as Prisma.InputJsonValue, rejectionCode: movement.rejectionCode, rejectionMessage: movement.rejectionMessage } });
        }
        await this.prisma.salesImportDay.update({ where: { id: day.id }, data: { status: SalesImportDayStatus.READY, validated: true, pagesFetched: result.pagesFetched, totalPages: result.totalPages, totalElements: result.totalElements, completedAt: new Date() } });
      } catch (error) { counts.blockedDays += 1; await this.prisma.salesImportDay.update({ where: { id: day.id }, data: { status: "FAILED", errorCode: error instanceof Error && "code" in error ? String(error.code) : "UNAVAILABLE", errorMessage: error instanceof Error ? error.message : "Falha externa", completedAt: new Date() } }); }
    }
    return this.prisma.salesImportRun.update({ where: { id: runId }, data: { status: ready > 0 && counts.blockedDays > 0 ? "PARTIALLY_READY" : ready > 0 ? "PREVIEW_READY" : "FAILED", counts, completedAt: new Date() } });
  }

  async get(tenantId: string, id: string) { const run = await this.prisma.salesImportRun.findFirst({ where: { id, tenantId }, include: { days: { orderBy: { movementDate: "asc" } } } }); if (!run) throw new NotFoundException("Execucao nao encontrada"); return run; }
}
