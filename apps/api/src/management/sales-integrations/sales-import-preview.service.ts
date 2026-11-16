import { currentActionOrigin } from "../../common/observability/action-origin";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  ExternalMovementStatus,
  Prisma,
  SalesImportDayStatus,
  SalesImportRun,
  SalesIntegrationEnvironment,
  SalesIntegrationStatus,
  SalesProvider,
} from "@prisma/client";
import type { NormalizedHistoricalSale } from "../../ordering/historical-order-import.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { IntegrationSecretService } from "../../security/integration-secret.service";
import { CreateSalesImportRunDto } from "./dto/sales-integration.dto";
import { SalesIntegrationService } from "./sales-integration.service";
import { SalesProviderRegistry } from "./sales-provider.registry";
import { ProviderTransactionStateService } from "./provider-transaction-state.service";
import { IntegrationAuditService } from "./integration-audit.service";
import { IfoodFinancialCredentialService } from "./ifood/ifood-financial-credential.service";

const IDENTITY_CHUNK = 1000;

export interface ProcessOptions {
  /** false: already imported sales are reconciled by the caller and not stored as movements. */
  persistKnownSales?: boolean;
}

/** A sale returned by the provider that already became an order (ExternalSaleIdentity exists). */
export interface KnownSale {
  externalSaleId: string;
  sale: NormalizedHistoricalSale;
}

export type ProcessResult = SalesImportRun & {
  knownSales: KnownSale[];
  /** Most recent sale seen by the provider in this run, used for the automatic import lag. */
  latestOccurredAt: Date | null;
};

const EMPTY_COUNTS = {
  found: 0,
  new: 0,
  duplicate: 0,
  rejected: 0,
  imported: 0,
  failed: 0,
  blockedDays: 0,
  existingOrders: 0,
  historicalCandidates: 0,
  reconciled: 0,
  unknown: 0,
};

@Injectable()
export class SalesImportPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: SalesIntegrationService,
    private readonly registry: SalesProviderRegistry,
    private readonly secrets: IntegrationSecretService,
    private readonly transactionStates: ProviderTransactionStateService = {
      upsertFromMovement: async () => null,
    } as unknown as ProviderTransactionStateService,
    private readonly audit?: IntegrationAuditService,
    @Optional() private readonly ifoodCredentials?: IfoodFinancialCredentialService
  ) {}

  async create(
    tenantId: string,
    userId: string | null,
    dto: CreateSalesImportRunDto,
    trigger: "MANUAL" | "INITIAL_LOAD" | "AUTOMATIC" = "MANUAL"
  ) {
    const start = new Date(`${dto.startDate}T00:00:00.000Z`);
    const end = new Date(`${dto.endDate}T00:00:00.000Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const integration =
      typeof this.integrations.get === "function"
        ? await this.integrations.get(tenantId, dto.integrationId)
        : (await this.integrations.getCredential(tenantId, dto.integrationId)).integration;
    const adapter = this.registry.get(integration.provider);
    if (days < 1 || days > adapter.capabilities.maxPeriodDays)
      throw new BadRequestException(
        `Periodo deve conter entre 1 e ${adapter.capabilities.maxPeriodDays} dias`
      );
    if (integration.status !== SalesIntegrationStatus.ACTIVE)
      throw new ConflictException("Integracao deve estar ativa");
    const overlap = await this.prisma.salesImportRun.findFirst({
      where: {
        tenantId,
        provider: integration.provider,
        status: { in: ["PENDING", "FETCHING", "IMPORTING"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) throw new ConflictException("Ja existe processamento sobreposto");
    const requestedVia = currentActionOrigin();
    const run = await this.prisma.salesImportRun.create({
      data: {
        tenantId,
        integrationId: integration.id,
        provider: integration.provider,
        channel: integration.channel,
        requestedByUserId: userId,
        startDate: start,
        endDate: end,
        strategy: dto.strategy,
        fixedProductId: dto.fixedProductId,
        counts: EMPTY_COUNTS,
        trigger,
        ...(requestedVia ? { requestedVia } : {}),
      },
    });
    return run;
  }

  /**
   * Fetches the run period from the provider and classifies each movement as new, duplicate (sale
   * already imported, by ExternalSaleIdentity) or rejected.
   *
   * `persistKnownSales: false` (automatic import, spec 030): already imported sales are not stored
   * again as movements; they are returned in `knownSales` so the caller reconciles the order in
   * memory. The provider transaction state is still refreshed for every movement.
   */
  async process(runId: string, tenantId: string, options: ProcessOptions = {}): Promise<ProcessResult> {
    const persistKnownSales = options.persistKnownSales ?? true;
    const knownSales: KnownSale[] = [];
    let latestOccurredAt: Date | null = null;
    const run = await this.prisma.salesImportRun.update({
      where: { id: runId },
      data: { status: "FETCHING", startedAt: new Date() },
      include: {
        integration: { include: { credentials: { where: { status: "ACTIVE" }, take: 1 } } },
      },
    });
    const credential = run.integration.credentials[0];
    if (
      (run.provider !== "IFOOD" && !credential) ||
      (run.provider === "PAGBANK" && !run.integration.externalMerchantId)
    )
      throw new ConflictException("Configuracao incompleta");
    const adapter = this.registry.get(run.provider);
    const token =
      run.provider === "IFOOD"
        ? (await this.requiredIfoodCredentials().getCredential(tenantId, run.integrationId))
            .accessToken
        : typeof this.integrations.getCredential === "function"
          ? (await this.integrations.getCredential(tenantId, run.integrationId)).token
          : this.credentialToken(credential!.secretCiphertext);
    const todayText = businessDate(new Date());
    const today = new Date(`${todayText}T00:00:00.000Z`);
    const effectiveEnd = run.endDate < today ? run.endDate : today;
    const prefetched =
      (run.provider === "MERCADO_PAGO" || run.provider === "IFOOD") && run.startDate <= effectiveEnd
        ? await adapter.fetchRange({
            startDate: run.startDate.toISOString().slice(0, 10),
            endDate: effectiveEnd.toISOString().slice(0, 10),
            merchantId:
              run.provider === "MERCADO_PAGO"
                ? `${tenantId}:${run.integrationId}`
                : (run.integration.externalMerchantId ?? ""),
            credential: token,
          })
        : null;
    const prefetchedDays = new Map(prefetched?.days.map((day) => [day.date, day]) ?? []);
    const counts = { ...EMPTY_COUNTS };
    let ready = 0;
    for (
      let cursor = new Date(run.startDate);
      cursor <= run.endDate;
      cursor = new Date(cursor.getTime() + 86400000)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      const blocked = isDateBlockedForProvider(run.provider, date, todayText);
      const day = await this.prisma.salesImportDay.upsert({
        where: { runId_movementDate: { runId, movementDate: cursor } },
        create: {
          tenantId,
          runId,
          movementDate: cursor,
          status: blocked ? "BLOCKED_DATE" : "FETCHING",
        },
        update: {
          status: blocked ? "BLOCKED_DATE" : "FETCHING",
          errorCode: null,
          errorMessage: null,
          completedAt: null,
        },
      });
      if (blocked) {
        counts.blockedDays += 1;
        continue;
      }
      try {
        const range = prefetched
          ? null
          : await adapter.fetchRange({
              startDate: date,
              endDate: date,
              merchantId: run.integration.externalMerchantId ?? "",
              credential: token,
            });
        const result = prefetched ? prefetchedDays.get(date) : range?.days[0];
        if (!result)
          throw new ConflictException("Provider nao retornou evidencia para o dia solicitado");
        if (!result.validated) {
          counts.blockedDays += 1;
          await this.prisma.salesImportDay.update({
            where: { id: day.id },
            data: {
              status: "BLOCKED_NOT_VALIDATED",
              validated: false,
              pagesFetched: result.pagesFetched,
              totalPages: result.totalPages,
              totalElements: result.totalElements,
              completedAt: new Date(),
            },
          });
          continue;
        }
        await this.prisma.externalSalesMovement.deleteMany({ where: { runId, dayId: day.id } });
        ready += 1;
        counts.found += result.movements.length;
        const known = await this.knownSaleIds(
          tenantId,
          run.provider,
          run.integration.environment,
          result.movements
        );
        for (const movement of result.movements) {
          const providerTransactionStateId = await this.transactionStates.upsertFromMovement({
            tenantId,
            integrationId: run.integrationId,
            provider: run.provider,
            movement,
          });
          if (movement.sale) {
            const occurredAt = new Date(movement.sale.occurredAt);
            if (
              Number.isFinite(occurredAt.getTime()) &&
              (!latestOccurredAt || occurredAt > latestOccurredAt)
            )
              latestOccurredAt = occurredAt;
          }
          const duplicate = Boolean(movement.externalSaleId && known.has(movement.externalSaleId));
          const status: ExternalMovementStatus = duplicate
            ? "DUPLICATE"
            : movement.sale
              ? "NEW"
              : "REJECTED";
          if (status === "NEW") counts.new += 1;
          else if (status === "DUPLICATE") counts.duplicate += 1;
          else counts.rejected += 1;
          if (run.provider === "IFOOD") {
            if (status === "DUPLICATE") counts.existingOrders += 1;
            else if (status === "NEW") counts.historicalCandidates += 1;
            else counts.unknown += 1;
          }
          if (status === "DUPLICATE" && !persistKnownSales) {
            if (movement.sale && movement.externalSaleId)
              knownSales.push({ externalSaleId: movement.externalSaleId, sale: movement.sale });
            continue;
          }
          await this.prisma.externalSalesMovement.create({
            data: {
              tenantId,
              runId,
              dayId: day.id,
              integrationId: run.integrationId,
              provider: run.provider,
              channel: run.channel,
              providerMovementId: movement.providerMovementId,
              externalSaleId: movement.externalSaleId,
              externalEventCode: movement.externalEventCode,
              kind: movement.kind,
              status,
              occurredAt: movement.sale ? new Date(movement.sale.occurredAt) : null,
              grossAmount: movement.sale?.grossAmount,
              netAmount: movement.sale?.netAmount,
              feeAmount: movement.sale?.feeAmount,
              paymentMethod: movement.sale?.paymentMethod,
              installments: movement.sale?.installments,
              normalizedData: movement.sale
                ? (JSON.parse(JSON.stringify(movement.sale)) as Prisma.InputJsonValue)
                : undefined,
              rawPayload: this.secrets.redact(movement.raw) as Prisma.InputJsonValue,
              rejectionCode: movement.rejectionCode,
              rejectionMessage: movement.rejectionMessage,
              providerTransactionStateId,
            },
          });
        }
        await this.prisma.salesImportDay.update({
          where: { id: day.id },
          data: {
            status: SalesImportDayStatus.READY,
            validated: true,
            pagesFetched: result.pagesFetched,
            totalPages: result.totalPages,
            totalElements: result.totalElements,
            completedAt: new Date(),
          },
        });
      } catch (error) {
        counts.blockedDays += 1;
        await this.prisma.salesImportDay.update({
          where: { id: day.id },
          data: {
            status: "FAILED",
            errorCode:
              error instanceof Error && "code" in error ? String(error.code) : "UNAVAILABLE",
            errorMessage: error instanceof Error ? error.message : "Falha externa",
            completedAt: new Date(),
          },
        });
      }
    }
    const completed = await this.prisma.salesImportRun.update({
      where: { id: runId },
      data: {
        status:
          ready > 0 && counts.blockedDays > 0
            ? "PARTIALLY_READY"
            : ready > 0
              ? "PREVIEW_READY"
              : "FAILED",
        counts,
        completedAt: new Date(),
      },
    });
    if (run.provider === "MERCADO_PAGO" && this.audit)
      await this.audit.record({
        tenantId,
        integrationId: run.integrationId,
        actorUserId: run.requestedByUserId,
        action: "MERCADO_PAGO_SYNC_PREVIEW_COMPLETED",
        outcome: completed.status,
        metadata: { runId, trigger: run.trigger },
      });
    return { ...completed, knownSales, latestOccurredAt };
  }

  /** Sale ids of the day that already became orders, in one query per chunk instead of one per movement. */
  private async knownSaleIds(
    tenantId: string,
    provider: SalesProvider,
    environment: SalesIntegrationEnvironment,
    movements: Array<{ externalSaleId?: string | null }>
  ): Promise<Set<string>> {
    const ids = [
      ...new Set(movements.map((movement) => movement.externalSaleId).filter(Boolean) as string[]),
    ];
    const known = new Set<string>();
    for (let index = 0; index < ids.length; index += IDENTITY_CHUNK) {
      const rows = await this.prisma.externalSaleIdentity.findMany({
        where: {
          tenantId,
          provider,
          environment,
          externalSaleId: { in: ids.slice(index, index + IDENTITY_CHUNK) },
        },
        select: { externalSaleId: true },
      });
      for (const row of rows) known.add(row.externalSaleId);
    }
    return known;
  }

  async get(tenantId: string, id: string) {
    const run = await this.prisma.salesImportRun.findFirst({
      where: { id, tenantId },
      include: { days: { orderBy: { movementDate: "asc" } } },
    });
    if (!run) throw new NotFoundException("Execucao nao encontrada");
    return run;
  }

  private credentialToken(ciphertext: string): string {
    const decrypted = this.secrets.decrypt(ciphertext);
    try {
      const envelope = JSON.parse(decrypted) as { ediToken?: string; accessToken?: string };
      return envelope.ediToken ?? envelope.accessToken ?? decrypted;
    } catch {
      return decrypted;
    }
  }

  private requiredIfoodCredentials(): IfoodFinancialCredentialService {
    if (!this.ifoodCredentials)
      throw new ConflictException("Ponte de credencial iFood indisponivel");
    return this.ifoodCredentials;
  }
}

export function isDateBlockedForProvider(
  _provider: "PAGBANK" | "MERCADO_PAGO" | "IFOOD",
  date: string,
  today: string
): boolean {
  return date > today;
}

function businessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
