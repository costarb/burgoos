import { ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../../security/integration-secret.service";
import { IntegrationAuditService } from "../integration-audit.service";
import { IfoodFinancialCredentialService } from "./ifood-financial-credential.service";
import { IfoodFinancialClient } from "./ifood-financial.client";
import { IfoodFinancialObservabilityService } from "./ifood-financial-observability.service";
import {
  mapIfoodFinancialEvent,
  mapIfoodSettlements,
} from "./ifood-financial-reconciliation.mapper";

@Injectable()
export class IfoodFinancialReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: IfoodFinancialCredentialService,
    private readonly client: IfoodFinancialClient,
    private readonly secrets: IntegrationSecretService,
    @Optional() private readonly audit?: IntegrationAuditService,
    @Optional() private readonly observability?: IfoodFinancialObservabilityService
  ) {}

  async createRun(
    tenantId: string,
    userId: string | null,
    integrationId: string,
    startDate: string,
    endDate: string,
    trigger: "MANUAL" | "DAILY" | "HOMOLOGATION" = "MANUAL"
  ) {
    this.validateDateRange(startDate, endDate);
    await this.assertIntegration(tenantId, integrationId);
    const overlapping = await this.prisma.financialReconciliationRun.findFirst({
      where: { tenantId, integrationId, status: { in: ["PENDING", "FETCHING"] } },
      select: { id: true },
    });
    if (overlapping) throw new ConflictException("Ja existe uma conciliacao iFood em andamento");
    return this.prisma.financialReconciliationRun.create({
      data: {
        tenantId,
        integrationId,
        requestedByUserId: userId,
        trigger,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
      },
    });
  }

  async process(tenantId: string, runId: string) {
    const startedAt = Date.now();
    const run = await this.prisma.financialReconciliationRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new NotFoundException("Conciliacao iFood nao encontrada");
    await this.prisma.financialReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: "FETCHING",
        startedAt: run.startedAt ?? new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });
    try {
      const credential = await this.credentials.getCredential(tenantId, run.integrationId);
      const startDate = run.startDate.toISOString().slice(0, 10);
      const endDate = run.endDate.toISOString().slice(0, 10);
      let eventCount = run.eventCount;
      if (!this.cursor(run.cursor).eventsDone) {
        const result = {
          events: [] as Awaited<ReturnType<IfoodFinancialClient["fetchFinancialEvents"]>>["events"],
          pagesFetched: 0,
        };
        for (const window of this.windows(startDate, endDate, 33)) {
          const page = await this.client.fetchFinancialEvents({
            ...credential,
            startDate: window.startDate,
            endDate: window.endDate,
          });
          result.events.push(...page.events);
          result.pagesFetched += page.pagesFetched;
        }
        for (const event of result.events.map(mapIfoodFinancialEvent)) {
          const sale = event.externalOrderId
            ? await this.prisma.externalFinancialSale.findFirst({
                where: {
                  tenantId,
                  integrationId: run.integrationId,
                  externalSaleId: event.externalOrderId,
                },
                select: { id: true },
              })
            : null;
          await this.prisma.externalFinancialEvent.upsert({
            where: {
              tenantId_integrationId_providerEventKey: {
                tenantId,
                integrationId: run.integrationId,
                providerEventKey: event.providerEventKey,
              },
            },
            create: { tenantId, integrationId: run.integrationId, saleId: sale?.id, ...event },
            update: { saleId: sale?.id, ...event },
          });
        }
        eventCount = result.events.length;
        await this.prisma.financialReconciliationRun.update({
          where: { id: run.id },
          data: { eventCount, cursor: { eventsDone: true } },
        });
      }
      const settlementResult = await this.client.fetchSettlements({
        ...credential,
        startDate,
        endDate,
      });
      const settlements = mapIfoodSettlements(settlementResult.settlements);
      let divergentCount = 0;
      for (const settlement of settlements) {
        const impacted = await this.prisma.externalFinancialEvent.aggregate({
          where: {
            tenantId,
            integrationId: run.integrationId,
            hasTransferImpact: true,
            expectedPaymentDate: settlement.expectedPaymentDate,
          },
          _sum: { amount: true },
        });
        const divergence = new Prisma.Decimal(settlement.netAmount).minus(
          impacted._sum.amount ?? 0
        );
        const reconciliationStatus = divergence.abs().lte(new Prisma.Decimal("0.01"))
          ? "MATCHED"
          : "DIVERGENT";
        if (reconciliationStatus === "DIVERGENT") divergentCount += 1;
        await this.prisma.externalSettlement.upsert({
          where: {
            tenantId_integrationId_externalSettlementId: {
              tenantId,
              integrationId: run.integrationId,
              externalSettlementId: settlement.externalSettlementId,
            },
          },
          create: {
            tenantId,
            integrationId: run.integrationId,
            ...settlement,
            reconciliationStatus,
            divergenceAmount: divergence,
            lastSyncedAt: new Date(),
          },
          update: {
            ...settlement,
            reconciliationStatus,
            divergenceAmount: divergence,
            lastSyncedAt: new Date(),
          },
        });
      }
      const completed = await this.prisma.financialReconciliationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          eventCount,
          settlementCount: settlements.length,
          divergentCount,
          cursor: { eventsDone: true, settlementsDone: true },
          completedAt: new Date(),
        },
      });
      if (this.audit) {
        await this.audit.record({
          tenantId,
          integrationId: run.integrationId,
          actorUserId: run.requestedByUserId,
          action: "IFOOD_FINANCIAL_RECONCILIATION_COMPLETED",
          outcome: completed.status,
          metadata: { runId: run.id },
        });
      }
      this.observability?.reconciliationCompleted({
        tenantId,
        integrationId: run.integrationId,
        runId: run.id,
        status: "COMPLETED",
        eventCount,
        settlementCount: settlements.length,
        divergentCount,
        durationMs: Date.now() - startedAt,
      });
      return completed;
    } catch (error) {
      await this.prisma.financialReconciliationRun.update({
        where: { id: run.id },
        data: {
          status: "PARTIAL",
          errorCode: "PROVIDER_ERROR",
          errorMessage: error instanceof Error ? error.message : "Falha ao conciliar iFood",
        },
      });
      if (this.audit) {
        await this.audit.record({
          tenantId,
          integrationId: run.integrationId,
          actorUserId: run.requestedByUserId,
          action: "IFOOD_FINANCIAL_RECONCILIATION_COMPLETED",
          outcome: "PARTIAL",
          metadata: { runId: run.id },
        });
      }
      this.observability?.reconciliationCompleted({
        tenantId,
        integrationId: run.integrationId,
        runId: run.id,
        status: "PARTIAL",
        eventCount: run.eventCount,
        settlementCount: run.settlementCount,
        divergentCount: run.divergentCount,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  listRuns(tenantId: string, integrationId: string) {
    return this.prisma.financialReconciliationRun.findMany({
      where: { tenantId, integrationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  async getRun(tenantId: string, integrationId: string, runId: string) {
    const run = await this.prisma.financialReconciliationRun.findFirst({
      where: { id: runId, tenantId, integrationId },
    });
    if (!run) throw new NotFoundException("Conciliacao iFood nao encontrada");
    return run;
  }

  async requestFile(tenantId: string, integrationId: string, competence: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))
      throw new ConflictException("Competencia invalida");
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const existing = await this.prisma.externalReconciliationFile.findFirst({
      where: {
        tenantId,
        integrationId,
        competence,
        requestedAt: { gte: since },
        status: { in: ["REQUESTED", "PROCESSING", "READY"] },
      },
      orderBy: { requestedAt: "desc" },
    });
    if (existing) return this.fileView(existing, true);
    const credential = await this.credentials.getCredential(tenantId, integrationId);
    const response = await this.client.requestReconciliationFile({ ...credential, competence });
    const file = await this.prisma.externalReconciliationFile.create({
      data: {
        tenantId,
        integrationId,
        competence,
        providerRequestId: response.requestId,
        status: this.fileStatus(response.status),
        orderCount: response.orderCount,
        lineCount: response.lineCount,
        downloadUrlCiphertext: response.downloadUrl
          ? this.secrets.encrypt(response.downloadUrl)
          : null,
        expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
      },
    });
    return this.fileView(file, false);
  }

  async refreshFile(tenantId: string, integrationId: string, requestId: string) {
    const file = await this.findFile(tenantId, integrationId, requestId);
    const credential = await this.credentials.getCredential(tenantId, integrationId);
    const response = await this.client.getReconciliationFile({
      accessToken: credential.accessToken,
      requestId,
    });
    const updated = await this.prisma.externalReconciliationFile.update({
      where: { id: file.id },
      data: {
        status: this.fileStatus(response.status, response.downloadUrl),
        orderCount: response.orderCount,
        lineCount: response.lineCount,
        downloadUrlCiphertext: response.downloadUrl
          ? this.secrets.encrypt(response.downloadUrl)
          : file.downloadUrlCiphertext,
        expiresAt: response.expiresAt ? new Date(response.expiresAt) : file.expiresAt,
        completedAt: response.downloadUrl ? new Date() : file.completedAt,
      },
    });
    return this.fileView(updated, false);
  }

  async getDownloadUrl(tenantId: string, integrationId: string, requestId: string) {
    await this.refreshFile(tenantId, integrationId, requestId);
    const file = await this.findFile(tenantId, integrationId, requestId);
    if (file.status !== "READY" || !file.downloadUrlCiphertext)
      throw new ConflictException("Arquivo de conciliacao ainda nao esta pronto");
    return this.secrets.decrypt(file.downloadUrlCiphertext);
  }

  private async assertIntegration(tenantId: string, id: string) {
    if (
      !(await this.prisma.salesIntegration.findFirst({
        where: { id, tenantId, provider: "IFOOD" },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Integracao iFood nao encontrada");
  }
  private findFile(tenantId: string, integrationId: string, providerRequestId: string) {
    return this.prisma.externalReconciliationFile.findFirstOrThrow({
      where: { tenantId, integrationId, providerRequestId },
    });
  }
  private fileView(
    file: {
      providerRequestId: string;
      competence: string;
      status: string;
      orderCount: number | null;
      lineCount: number | null;
      expiresAt: Date | null;
      errorCode: string | null;
      errorMessage: string | null;
    },
    reused: boolean
  ) {
    return {
      requestId: file.providerRequestId,
      competence: file.competence,
      status: file.status,
      reused,
      orderCount: file.orderCount,
      lineCount: file.lineCount,
      expiresAt: file.expiresAt,
      errorCode: file.errorCode,
      errorMessage: file.errorMessage,
    };
  }
  private fileStatus(
    status?: string,
    downloadUrl?: string
  ): "REQUESTED" | "PROCESSING" | "READY" | "EXPIRED" | "FAILED" {
    const value = status?.toUpperCase();
    if (downloadUrl || value === "READY" || value === "COMPLETED") return "READY";
    if (value === "EXPIRED") return "EXPIRED";
    if (value === "FAILED" || value === "ERROR") return "FAILED";
    return value === "PROCESSING" || value === "IN_PROGRESS" ? "PROCESSING" : "REQUESTED";
  }
  private cursor(value: Prisma.JsonValue | null): { eventsDone?: boolean } {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as { eventsDone?: boolean })
      : {};
  }
  private validateDateRange(start: string, end: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end)
      throw new ConflictException("Periodo de conciliacao invalido");
  }
  private windows(startDate: string, endDate: string, maximumDays: number) {
    const windows: Array<{ startDate: string; endDate: string }> = [];
    let cursor = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    while (cursor <= end) {
      const windowEnd = new Date(
        Math.min(end.getTime(), cursor.getTime() + (maximumDays - 1) * 86_400_000)
      );
      windows.push({
        startDate: cursor.toISOString().slice(0, 10),
        endDate: windowEnd.toISOString().slice(0, 10),
      });
      cursor = new Date(windowEnd.getTime() + 86_400_000);
    }
    return windows;
  }
}
