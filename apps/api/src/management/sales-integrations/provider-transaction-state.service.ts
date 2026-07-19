import { Injectable } from "@nestjs/common";
import { Prisma, ProviderResourceType, SalesProvider } from "@prisma/client";
import { PrismaService } from "../../platform/database/prisma.service";
import { ProviderMovement } from "./sales-provider.adapter";

@Injectable()
export class ProviderTransactionStateService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromMovement(input: {
    tenantId: string;
    integrationId: string;
    provider: SalesProvider;
    movement: ProviderMovement;
  }): Promise<string | null> {
    if (!input.movement.externalSaleId || input.provider !== "MERCADO_PAGO") return null;
    const raw = input.movement.raw;
    const status = stringValue(raw.status) ?? input.movement.externalEventCode ?? "unknown";
    const resourceType = ProviderResourceType.PAYMENT;
    const incomingUpdatedAt = dateValue(raw.date_last_updated);
    const existing = await this.prisma.providerTransactionState.findUnique({
      where: {
        integrationId_resourceType_providerResourceId: {
          integrationId: input.integrationId,
          resourceType,
          providerResourceId: input.movement.externalSaleId,
        },
      },
      select: { id: true, orderId: true, updatedAtProvider: true },
    });
    if (
      existing?.updatedAtProvider &&
      incomingUpdatedAt &&
      incomingUpdatedAt < existing.updatedAtProvider
    )
      return existing.id;
    const attentionRequired = Boolean(existing?.orderId && status !== "approved");
    const state = await this.prisma.providerTransactionState.upsert({
      where: {
        integrationId_resourceType_providerResourceId: {
          integrationId: input.integrationId,
          resourceType,
          providerResourceId: input.movement.externalSaleId,
        },
      },
      create: {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        provider: input.provider,
        resourceType,
        providerResourceId: input.movement.externalSaleId,
        externalSaleId: input.movement.externalSaleId,
        status,
        statusDetail: stringValue(raw.status_detail),
        grossAmount: input.movement.sale?.grossAmount,
        feeAmount: input.movement.sale?.feeAmount,
        netAmount: input.movement.sale?.netAmount,
        createdAtProvider: dateValue(raw.date_created),
        approvedAtProvider: dateValue(raw.date_approved),
        updatedAtProvider: incomingUpdatedAt,
        normalizedData: json(input.movement.sale ?? {}),
        rawPayload: json(raw),
        lastSynchronizedAt: new Date(),
        attentionRequired,
      },
      update: {
        status,
        statusDetail: stringValue(raw.status_detail),
        grossAmount: input.movement.sale?.grossAmount,
        feeAmount: input.movement.sale?.feeAmount,
        netAmount: input.movement.sale?.netAmount,
        createdAtProvider: dateValue(raw.date_created),
        approvedAtProvider: dateValue(raw.date_approved),
        updatedAtProvider: incomingUpdatedAt,
        normalizedData: json(input.movement.sale ?? {}),
        rawPayload: json(raw),
        lastSynchronizedAt: new Date(),
        attentionRequired,
      },
      select: { id: true },
    });
    return state.id;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function dateValue(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
