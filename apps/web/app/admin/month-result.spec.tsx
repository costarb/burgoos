import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinancialDashboardIndicators } from "@rrfive/types";
import { describe, expect, it } from "vitest";
import { MonthResult } from "./month-result";

const indicators: FinancialDashboardIndicators = {
  competence: "2026-10",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  grossRevenue: "15000.00",
  netRevenue: "14700.00",
  cmv: "4410.00",
  salesFees: "1050.00",
  taxes: "420.00",
  grossProfit: "8820.00",
  contributionMarginRate: 0.6,
  variableExpenses: "500.00",
  fixedExpenses: "3000.00",
  plannedFixedCost: "5000.00",
  estimatedNetProfit: "5320.00",
  netMarginRate: 0.3619,
  deliveredOrderCount: 135,
  priceReviewCount: 0,
  stockAlertCount: 0,
};

function render(value: FinancialDashboardIndicators) {
  return renderToStaticMarkup(<MonthResult indicators={value} />)
    .split(String.fromCharCode(160))
    .join(" ");
}

describe("MonthResult", () => {
  it("shows the month and the same lines as the DRE, linking to it", () => {
    const html = render(indicators);

    expect(html).toContain("Resultado de outubro de 2026");
    expect(html).toContain('href="/admin/reports/dre?competence=2026-10"');
    for (const label of [
      "Receita liquida",
      "CMV",
      "Taxas de plataforma e pagamento",
      "Impostos (estimados)",
      "Margem de contribuicao",
      "Despesas variaveis",
      "Custos fixos",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("R$ 8.820,00");
    expect(html).toContain("R$ 5.320,00");
    expect(html).not.toContain("Nenhum custo fixo");
    expect(html).not.toContain("text-red-700");
  });

  it("highlights a loss and warns when no fixed cost was launched", () => {
    const html = render({
      ...indicators,
      fixedExpenses: "0.00",
      estimatedNetProfit: "-120.00",
      netMarginRate: -0.1,
    });

    expect(html).toContain("Resultado liquido (prejuizo)");
    expect(html).toContain("text-red-700");
    expect(html).toContain("Nenhum custo fixo lancado neste mes");
  });
});
