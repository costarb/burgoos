import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentReleaseSource, SalesImportRunStatus } from "@prisma/client";
import {
  HistoricalOrderImportService,
  NormalizedHistoricalSale,
} from "../../ordering/historical-order-import.service";
import { PrismaService } from "../../platform/database/prisma.service";
import { ExternalSaleIdentityService } from "./external-sale-identity.service";

@Injectable()
export class SalesImportConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historical: HistoricalOrderImportService,
    private readonly identities: ExternalSaleIdentityService
  ) {}

  async confirm(tenantId: string, runId: string, resume = false) {
    const run = await this.prisma.salesImportRun.findFirst({
      where: { id: runId, tenantId },
      include: { integration: true },
    });
    if (!run) throw new NotFoundException("Execucao nao encontrada");
    const terminal: SalesImportRunStatus[] = [SalesImportRunStatus.COMPLETED];
    if (terminal.includes(run.status)) return run;
    if (run.status === SalesImportRunStatus.IMPORTING && !resume) return run;

    const ready: SalesImportRunStatus[] = [
      SalesImportRunStatus.PREVIEW_READY,
      SalesImportRunStatus.PARTIALLY_READY,
      SalesImportRunStatus.COMPLETED_WITH_ERRORS,
    ];
    if (run.status !== SalesImportRunStatus.IMPORTING && !ready.includes(run.status)) {
      throw new ConflictException("Execucao nao esta pronta para importar");
    }
    if (run.status !== SalesImportRunStatus.IMPORTING) {
      const claimed = await this.prisma.salesImportRun.updateMany({
        where: { id: runId, tenantId, status: { in: ready } },
        data: { status: "IMPORTING", completedAt: null },
      });
      if (claimed.count === 0) {
        return this.prisma.salesImportRun.findFirstOrThrow({ where: { id: runId, tenantId } });
      }
    }

    const movements = await this.prisma.externalSalesMovement.findMany({
      where: { tenantId, runId, status: { in: ["NEW", "FAILED", "DUPLICATE"] }, kind: "SALE" },
      orderBy: { occurredAt: "asc" },
    });
    const counts = run.counts as Record<string, number>;
    let imported = Number(counts.imported ?? 0);
    let failed = 0;
    let duplicate = Number(counts.duplicate ?? 0);

    for (const movement of movements) {
      const sale = movement.normalizedData as unknown as NormalizedHistoricalSale;
      if (!movement.externalSaleId || !sale?.occurredAt) {
        failed += 1;
        continue;
      }
      const identityKey = {
        tenantId,
        provider: run.provider,
        environment: run.integration?.environment ?? ("PRODUCTION" as const),
        integrationId: run.integrationId,
        externalSaleId: movement.externalSaleId,
      };
      if (movement.status === "DUPLICATE") {
        await this.reconcileExistingOrder(identityKey, sale);
        continue;
      }
      if (!(await this.identities.claim(identityKey, run.channel))) {
        duplicate += 1;
        await this.prisma.externalSalesMovement.update({
          where: { id: movement.id },
          data: { status: "DUPLICATE" },
        });
        continue;
      }

      try {
        const result = await this.historical.importNormalizedSale(tenantId, sale, {
          strategy: run.strategy as "PRICE_WEIGHTED" | "FIXED_PRODUCT",
          fixedProductId: run.fixedProductId ?? undefined,
          orderPlatformName: run.provider === "MERCADO_PAGO" ? "MERCADO_PAGO" : "PAGBANK_EDI",
          onOrderCreated: (client, orderId) =>
            this.identities.linkOrder(client, identityKey, movement.id, orderId),
        });
        const orderId = result.imported[0]?.orderId;
        if (!orderId) throw new Error("Venda nao gerou pedido");
        imported += 1;
      } catch {
        failed += 1;
        await this.identities.release(identityKey);
        await this.prisma.$transaction([
          this.prisma.externalSalesMovement.update({
            where: { id: movement.id },
            data: {
              status: "FAILED",
              rejectionCode: "IMPORT_FAILED",
              rejectionMessage: "Falha ao criar pedido historico",
            },
          }),
        ]);
      }
    }

    return this.prisma.salesImportRun.update({
      where: { id: runId },
      data: {
        status: failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        counts: { ...counts, imported, failed, duplicate },
        completedAt: new Date(),
      },
    });
  }

  private async reconcileExistingOrder(
    identityKey: {
      tenantId: string;
      provider: "PAGBANK" | "MERCADO_PAGO";
      environment: "TEST" | "PRODUCTION";
      integrationId: string;
      externalSaleId: string;
    },
    sale: NormalizedHistoricalSale
  ): Promise<void> {
    const identity = await this.prisma.externalSaleIdentity.findUnique({
      where: {
        tenantId_provider_environment_externalSaleId: {
          tenantId: identityKey.tenantId,
          provider: identityKey.provider,
          environment: identityKey.environment,
          externalSaleId: identityKey.externalSaleId,
        },
      },
      select: { orderId: true },
    });
    if (!identity?.orderId) return;
    const releaseDate = sale.expectedReleaseAt ? new Date(sale.expectedReleaseAt) : null;
    await this.prisma.order.update({
      where: { id: identity.orderId },
      data: {
        paymentGrossAmount: sale.grossAmount,
        ...(sale.feeAmount === undefined ? {} : { paymentFeeAmount: sale.feeAmount }),
        ...(sale.netAmount === undefined ? {} : { paymentNetAmount: sale.netAmount }),
        ...(releaseDate && Number.isFinite(releaseDate.getTime())
          ? {
              paymentReleaseExpectedAt: releaseDate,
              paymentReleaseSource: PaymentReleaseSource.EXTRACT,
            }
          : {}),
      },
    });
  }
}
