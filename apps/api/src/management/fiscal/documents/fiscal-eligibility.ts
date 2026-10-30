import type { FiscalConfiguration } from "@prisma/client";
import type { FiscalSale } from "./fiscal-sale.loader";

export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

export function businessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type IneligibleReason =
  | "DISABLED"
  | "SOURCE_NOT_ELIGIBLE"
  | "PART_OF_TAB"
  | "CANCELLED"
  | "ZERO_TOTAL"
  | "NOT_PAID"
  | "NOT_SAME_DAY"
  | "RETROACTIVE_CONFIRMATION_REQUIRED";

export type EligibilityResult = { eligible: true; retroactive: boolean } | { eligible: false; reason: IneligibleReason; message: string };

const MESSAGES: Record<IneligibleReason, string> = {
  DISABLED: "Emissao fiscal desativada para a empresa",
  SOURCE_NOT_ELIGIBLE: "Origem do pedido nao emite NFC-e",
  PART_OF_TAB: "Pedido pertence a uma comanda; emita a NFC-e da comanda",
  CANCELLED: "Venda cancelada",
  ZERO_TOTAL: "Venda sem valor",
  NOT_PAID: "Venda ainda nao esta paga",
  NOT_SAME_DAY: "Venda de dia anterior: emissao somente manual",
  RETROACTIVE_CONFIRMATION_REQUIRED: "Venda de dia anterior: confirme o risco de rejeicao para emitir",
};

const fail = (reason: IneligibleReason): EligibilityResult => ({ eligible: false, reason, message: MESSAGES[reason] });

/**
 * Automatic emission only for paid sales of the current business day; manual emission of an
 * older sale requires explicit confirmation (spec FR-011/FR-012).
 */
export function evaluateEligibility(
  configuration: Pick<FiscalConfiguration, "enabled" | "eligibleSources">,
  sale: FiscalSale,
  mode: { trigger: "AUTOMATIC" | "MANUAL"; confirmRetroactive?: boolean; now?: Date }
): EligibilityResult {
  if (!configuration.enabled) return fail("DISABLED");
  if (sale.target.type === "ORDER" && sale.partOfTab) return fail("PART_OF_TAB");
  if (!configuration.eligibleSources.includes(sale.source) || sale.marketplace) return fail("SOURCE_NOT_ELIGIBLE");
  if (sale.cancelled) return fail("CANCELLED");
  if (sale.total.lessThanOrEqualTo(0)) return fail("ZERO_TOTAL");
  if (!sale.paid) return fail("NOT_PAID");
  const retroactive = businessDate(sale.saleOccurredAt) < businessDate(mode.now ?? new Date());
  if (retroactive && mode.trigger === "AUTOMATIC") return fail("NOT_SAME_DAY");
  if (retroactive && !mode.confirmRetroactive) return fail("RETROACTIVE_CONFIRMATION_REQUIRED");
  return { eligible: true, retroactive };
}
