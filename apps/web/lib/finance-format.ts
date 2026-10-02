const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const monthName = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMoney(value: string | number): string {
  return money.format(Number(value));
}

export function formatPercent(fraction: number): string {
  return percent.format(fraction);
}

/** `2026-09` → `setembro de 2026`. */
export function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-").map(Number);
  return monthName.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "R$ 4,31 reais em 1 pedido · R$ 3,50 estimadas em 1 pedido" (omits empty parts). */
export function salesFeesBreakdown(summary: {
  realSalesFees: string;
  realFeeOrderCount: number;
  estimatedSalesFees: string;
  estimatedFeeOrderCount: number;
}): string {
  const orders = (count: number) => `${count} ${count === 1 ? "pedido" : "pedidos"}`;
  const parts = [
    summary.realFeeOrderCount > 0
      ? `${formatMoney(summary.realSalesFees)} reais em ${orders(summary.realFeeOrderCount)}`
      : null,
    summary.estimatedFeeOrderCount > 0
      ? `${formatMoney(summary.estimatedSalesFees)} estimadas em ${orders(summary.estimatedFeeOrderCount)}`
      : null,
  ];
  return parts.filter(Boolean).join(" · ");
}
