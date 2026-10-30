import { PaymentMethod, Prisma } from "@prisma/client";
import type { FiscalProfile } from "@prisma/client";
import type { NfceDraftItem, NfceDraftPayment } from "../providers/fiscal-provider.adapter";

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const ZERO = D(0);
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** NFC-e payment codes (tPag) per ERP payment method — research R4. */
export const TPAG_BY_METHOD: Record<PaymentMethod, string> = {
  CASH: "01",
  CREDIT_CARD: "03",
  DEBIT_CARD: "04",
  VOUCHER: "11",
  PIX: "17",
  PIX_MANUAL: "20",
  DIGITAL_WALLET: "18",
  CARD_ON_DELIVERY: "99",
};

export interface ComposerModification {
  type: "REMOVE_INGREDIENT" | "ADD_COMPLEMENT";
  complementId: string | null;
  nameSnapshot: string;
  /** Per unit of the order item. */
  quantity: Prisma.Decimal.Value;
  unitPriceDelta: Prisma.Decimal.Value;
  totalPriceDelta: Prisma.Decimal.Value;
}

export interface ComposerOrderItem {
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPrice: Prisma.Decimal.Value;
  total: Prisma.Decimal.Value;
  baseUnitPrice: Prisma.Decimal.Value | null;
  calculatedUnitPrice: Prisma.Decimal.Value | null;
  chargedUnitPrice: Prisma.Decimal.Value | null;
  modifications: ComposerModification[];
}

export interface ComposerPayment {
  method: PaymentMethod;
  amount: Prisma.Decimal.Value;
}

export interface ComposerInput {
  items: ComposerOrderItem[];
  /** Sale total charged (order total, or the sum of the tab's orders). */
  total: Prisma.Decimal.Value;
  /** Valid allocations (payment neither cancelled nor refunded). */
  payments: ComposerPayment[];
  /** Used for the part of the total not covered by allocations (imports, API orders). */
  fallbackPaymentMethod: PaymentMethod;
  productProfiles: Map<string, FiscalProfile | null>;
  complementProfiles: Map<string, FiscalProfile | null>;
}

export type ComposerResult =
  | { ok: true; items: NfceDraftItem[]; payments: NfceDraftPayment[]; change: string; total: string; adjustment: string }
  | { ok: false; code: "MISSING_FISCAL_DATA" | "EMPTY_SALE"; message: string; missing: string[] };

interface Line {
  code: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  gross: Prisma.Decimal;
  discount: Prisma.Decimal;
  otherExpenses: Prisma.Decimal;
  profile: FiscalProfile;
}

/**
 * Builds NFC-e items and payments from the sale (research R3/R4):
 * - one line per order item at its base price, one line per paid complement;
 * - manual price reductions become the item discount, spread proportionally over the item's
 *   lines; increases become "other expenses" on the main line;
 * - the lines always add up to the charged total (rounding goes to the last line);
 * - payments come from allocations; the uncovered rest uses the order payment method; excess
 *   cash becomes change.
 */
export function composeNfce(input: ComposerInput): ComposerResult {
  const lines: Line[] = [];
  const missing: string[] = [];

  for (const item of input.items) {
    const quantity = D(item.quantity);
    const productProfile = input.productProfiles.get(item.productId) ?? null;
    const complements = item.modifications.filter(
      (modification) => modification.type === "ADD_COMPLEMENT" && D(modification.totalPriceDelta).greaterThan(0)
    );
    const complementPerUnit = complements.reduce((sum, modification) => sum.add(D(modification.totalPriceDelta)), ZERO);
    const charged = D(item.chargedUnitPrice ?? item.unitPrice);
    const base = item.baseUnitPrice !== null ? D(item.baseUnitPrice) : Prisma.Decimal.max(charged.sub(complementPerUnit), ZERO);
    const calculated = item.calculatedUnitPrice !== null ? D(item.calculatedUnitPrice) : base.add(complementPerUnit);
    const adjustment = money(charged.sub(calculated).mul(quantity));

    if (!productProfile) missing.push(item.productNameSnapshot);
    const itemLines: Line[] = [];
    if (productProfile) {
      itemLines.push({
        code: item.productId,
        description: item.productNameSnapshot,
        quantity,
        unitPrice: base,
        gross: money(base.mul(quantity)),
        discount: ZERO,
        otherExpenses: ZERO,
        profile: productProfile,
      });
    }
    for (const modification of complements) {
      const profile =
        (modification.complementId ? input.complementProfiles.get(modification.complementId) : null) ?? productProfile;
      if (!profile) {
        missing.push(modification.nameSnapshot);
        continue;
      }
      const complementQuantity = D(modification.quantity).mul(quantity);
      itemLines.push({
        code: modification.complementId ?? `${item.productId}:complement`,
        description: modification.nameSnapshot,
        quantity: complementQuantity,
        unitPrice: D(modification.unitPriceDelta),
        gross: money(D(modification.totalPriceDelta).mul(quantity)),
        discount: ZERO,
        otherExpenses: ZERO,
        profile,
      });
    }
    if (!itemLines.length) continue;
    if (adjustment.lessThan(0)) spreadDiscount(itemLines, adjustment.abs());
    else if (adjustment.greaterThan(0)) itemLines[0].otherExpenses = itemLines[0].otherExpenses.add(adjustment);
    lines.push(...itemLines);
  }

  if (missing.length) {
    return {
      ok: false,
      code: "MISSING_FISCAL_DATA",
      message: `Sem perfil fiscal: ${[...new Set(missing)].join(", ")}`,
      missing: [...new Set(missing)],
    };
  }
  if (!lines.length) return { ok: false, code: "EMPTY_SALE", message: "Venda sem itens", missing: [] };

  const total = money(D(input.total));
  const composed = lines.reduce((sum, line) => sum.add(net(line)), ZERO);
  const difference = total.sub(composed);
  if (!difference.isZero()) {
    if (difference.lessThan(0)) spreadDiscount(lines, difference.abs());
    else lines[lines.length - 1].otherExpenses = lines[lines.length - 1].otherExpenses.add(difference);
  }

  const { payments, change } = composePayments(input.payments, input.fallbackPaymentMethod, total);
  return {
    ok: true,
    items: lines.map(toDraftItem),
    payments,
    change: change.toFixed(2),
    total: total.toFixed(2),
    adjustment: difference.toFixed(2),
  };
}

function net(line: Line) {
  return line.gross.sub(line.discount).add(line.otherExpenses);
}

/** Distributes a discount proportionally to the line values; the last line absorbs rounding. */
function spreadDiscount(lines: Line[], discount: Prisma.Decimal) {
  const available = lines.reduce((sum, line) => sum.add(line.gross.sub(line.discount)), ZERO);
  if (available.lessThanOrEqualTo(0)) return;
  const capped = Prisma.Decimal.min(discount, available);
  let remaining = capped;
  lines.forEach((line, index) => {
    const room = line.gross.sub(line.discount);
    const share =
      index === lines.length - 1 ? remaining : Prisma.Decimal.min(money(capped.mul(room).div(available)), room);
    const applied = Prisma.Decimal.min(share, room);
    line.discount = line.discount.add(applied);
    remaining = remaining.sub(applied);
  });
  if (remaining.greaterThan(0)) {
    for (const line of lines) {
      const room = line.gross.sub(line.discount);
      const applied = Prisma.Decimal.min(room, remaining);
      line.discount = line.discount.add(applied);
      remaining = remaining.sub(applied);
      if (remaining.lessThanOrEqualTo(0)) break;
    }
  }
}

function composePayments(payments: ComposerPayment[], fallback: PaymentMethod, total: Prisma.Decimal) {
  const byMethod = new Map<PaymentMethod, Prisma.Decimal>();
  for (const payment of payments) {
    const amount = money(D(payment.amount));
    if (amount.lessThanOrEqualTo(0)) continue;
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? ZERO).add(amount));
  }
  const paid = [...byMethod.values()].reduce((sum, amount) => sum.add(amount), ZERO);
  if (paid.lessThan(total)) {
    byMethod.set(fallback, (byMethod.get(fallback) ?? ZERO).add(total.sub(paid)));
  }
  let change = ZERO;
  const excess = Prisma.Decimal.max(paid.sub(total), ZERO);
  if (excess.greaterThan(0)) {
    const cash = byMethod.get("CASH");
    if (cash && cash.greaterThanOrEqualTo(excess)) {
      change = excess;
    } else {
      // Non-cash overpayment cannot be change: trim it from the largest method so payments match the total.
      const [largest] = [...byMethod.entries()].sort((a, b) => b[1].comparedTo(a[1]));
      byMethod.set(largest[0], largest[1].sub(excess));
    }
  }
  return {
    payments: [...byMethod.entries()]
      .filter(([, amount]) => amount.greaterThan(0))
      .map(([method, amount]) => ({ method, tPag: TPAG_BY_METHOD[method], amount: amount.toFixed(2) })),
    change,
  };
}

function toDraftItem(line: Line): NfceDraftItem {
  return {
    code: line.code,
    description: line.description.slice(0, 120),
    quantity: line.quantity.toFixed(4),
    unitPrice: line.unitPrice.toDecimalPlaces(10).toString(),
    grossAmount: line.gross.toFixed(2),
    discount: line.discount.toFixed(2),
    freight: "0.00",
    otherExpenses: line.otherExpenses.toFixed(2),
    ncm: line.profile.ncm,
    cfop: line.profile.cfop,
    csosn: line.profile.csosn,
    origin: line.profile.origin,
    unit: line.profile.commercialUnit,
    cest: line.profile.cest,
    benefitCode: line.profile.benefitCode,
  };
}
