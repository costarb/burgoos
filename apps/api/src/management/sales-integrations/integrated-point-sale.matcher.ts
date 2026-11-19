import { ChargeStatus, Prisma, SalesInputChannel, SalesIntegrationEnvironment } from "@prisma/client";
import type { PrismaService } from "../../platform/database/prisma.service";
import type { NormalizedHistoricalSale } from "./sales-provider.adapter";

/** How long an approved PDV charge and the Mercado Pago payment may be apart. */
const MATCH_BEFORE_MS = 30 * 60_000;
const MATCH_AFTER_MS = 5 * 60_000;
/** A payment from a PDV terminal waits this long for its charge to be approved before importing. */
const DEFER_MS = 15 * 60_000;

const PAID_STATUSES: ChargeStatus[] = [
  ChargeStatus.APPROVED,
  ChargeStatus.PARTIALLY_REFUNDED,
  ChargeStatus.REFUNDED,
];

export type IntegratedPointSaleResult = "linked" | "defer" | null;

interface MovementLike {
  externalSaleId?: string | null;
  sale?: NormalizedHistoricalSale | null;
  raw?: unknown;
}

interface RunLike {
  integrationId: string;
  channel: SalesInputChannel;
  environment: SalesIntegrationEnvironment;
}

/**
 * A sale charged through the POS on a Mercado Pago Point (Orders API) also shows up in the Mercado
 * Pago payments the automatic import reads, with an id the charge does not keep. Without this, the
 * import creates a second order (and a second NFC-e) for the same sale.
 *
 * It recognizes the payment by the terminal serial, the amount and the time of an approved POS
 * charge and links the payment id to that order, so the import treats it as already known (and
 * fills in the Mercado Pago fees on the POS order). While the charge is not approved yet, a recent
 * payment from a PDV terminal is deferred instead of imported.
 */
export class IntegratedPointSaleMatcher {
  constructor(private readonly prisma: PrismaService) {}

  async match(
    tenantId: string,
    run: RunLike,
    movement: MovementLike,
    now = new Date()
  ): Promise<IntegratedPointSaleResult> {
    const serial = pointSerial(movement.raw);
    if (!serial || !movement.externalSaleId || !movement.sale) return null;
    const terminal = await this.prisma.paymentTerminal.findFirst({
      where: { tenantId, providerTerminalId: { endsWith: `__${serial}` } },
      select: { id: true, operatingMode: true },
    });
    if (!terminal) return null;

    const occurredAt = new Date(movement.sale.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) return null;
    const charge = await this.prisma.paymentCharge.findFirst({
      where: {
        tenantId,
        terminalId: terminal.id,
        status: { in: PAID_STATUSES },
        amount: new Prisma.Decimal(movement.sale.grossAmount),
        createdAt: {
          gte: new Date(occurredAt.getTime() - MATCH_BEFORE_MS),
          lte: new Date(occurredAt.getTime() + MATCH_AFTER_MS),
        },
      },
      orderBy: { createdAt: "desc" },
      select: { orderId: true },
    });
    if (charge) {
      await this.prisma.externalSaleIdentity.upsert({
        where: {
          tenantId_provider_environment_externalSaleId: {
            tenantId,
            provider: "MERCADO_PAGO",
            environment: run.environment,
            externalSaleId: movement.externalSaleId,
          },
        },
        create: {
          tenantId,
          provider: "MERCADO_PAGO",
          environment: run.environment,
          externalSaleId: movement.externalSaleId,
          integrationId: run.integrationId,
          firstChannel: run.channel,
          orderId: charge.orderId,
          importedAt: now,
        },
        update: {},
      });
      return "linked";
    }
    const isPdv = terminal.operatingMode?.toUpperCase() === "PDV";
    return isPdv && now.getTime() - occurredAt.getTime() < DEFER_MS ? "defer" : null;
  }
}

/** Serial of the Point that took a Mercado Pago payment, from the raw payment. */
function pointSerial(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const payment = raw as {
    point_of_interaction?: { type?: string; device?: { serial_number?: string } };
    additional_info?: { poi_id?: string };
  };
  if (payment.point_of_interaction?.type?.toUpperCase() !== "POINT") return null;
  return payment.point_of_interaction.device?.serial_number ?? payment.additional_info?.poi_id ?? null;
}
