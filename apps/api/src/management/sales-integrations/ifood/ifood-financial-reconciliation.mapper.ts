import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  IfoodFinancialEvent,
  IfoodSettlement,
  IfoodSettlementClosingItem,
} from "./ifood-financial.types";

export interface NormalizedIfoodFinancialEvent {
  providerEventKey: string;
  externalOrderId: string | null;
  name: string;
  trigger: string | null;
  description: string | null;
  competence: string | null;
  amount: number;
  hasTransferImpact: boolean;
  baseAmount: number | null;
  feePercentage: number | null;
  expectedPaymentDate: Date | null;
  occurredAt: Date;
  settlementExternalId: string | null;
  rawPayload: Prisma.InputJsonValue;
}

export interface NormalizedIfoodSettlement {
  externalSettlementId: string;
  product: string | null;
  type: string;
  status: string;
  calculationStart: Date | null;
  calculationEnd: Date | null;
  expectedPaymentDate: Date | null;
  paidAt: Date | null;
  grossAmount: number | null;
  netAmount: number;
  rawPayload: Prisma.InputJsonValue;
}

export function mapIfoodFinancialEvent(event: IfoodFinancialEvent): NormalizedIfoodFinancialEvent {
  const occurredAt = date(event.reference?.date) ?? new Date();
  const stable = JSON.stringify({
    name: event.name,
    trigger: event.trigger,
    reference: event.reference,
    amount: event.amount.value,
    impact: event.hasTransferImpact,
    settlement: event.settlement?.id,
  });
  return {
    providerEventKey: createHash("sha256").update(stable).digest("hex"),
    externalOrderId: event.reference?.type === "ORDER" ? (event.reference.id ?? null) : null,
    name: event.name,
    trigger: event.trigger ?? null,
    description: event.description ?? null,
    competence: event.competence ?? null,
    amount: Number(event.amount.value),
    hasTransferImpact: event.hasTransferImpact,
    baseAmount: nullableNumber(event.billing?.baseValue),
    feePercentage: nullableNumber(event.billing?.feePercentage),
    expectedPaymentDate: date(event.settlement?.expectedDate),
    occurredAt,
    settlementExternalId: event.settlement?.id ?? null,
    rawPayload: event as Prisma.InputJsonValue,
  };
}

export function mapIfoodSettlements(settlements: IfoodSettlement[]): NormalizedIfoodSettlement[] {
  return settlements.flatMap((settlement) =>
    settlement.closingItems.map((item) => mapClosingItem(settlement, item))
  );
}

function mapClosingItem(
  settlement: IfoodSettlement,
  item: IfoodSettlementClosingItem
): NormalizedIfoodSettlement {
  return {
    externalSettlementId: `${settlement.id}:${item.id}`,
    product: settlement.product ?? null,
    type: item.type,
    status: item.status,
    calculationStart: date(settlement.calculationPeriod?.beginDate),
    calculationEnd: date(settlement.calculationPeriod?.endDate),
    expectedPaymentDate: date(item.expectedPaymentDate),
    paidAt: date(item.paymentDate),
    grossAmount: nullableNumber(item.grossAmount),
    netAmount: Number(item.amount),
    rawPayload: { ...settlement, closingItems: [item] } as Prisma.InputJsonValue,
  };
}

function nullableNumber(value: unknown): number | null {
  const number = Number(value);
  return value === undefined || value === null || !Number.isFinite(number) ? null : number;
}

function date(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
