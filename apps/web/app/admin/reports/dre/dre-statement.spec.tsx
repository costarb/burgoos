import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinancialDreSummary } from "@rrfive/types";
import { describe, expect, it } from "vitest";
import { filtersFromSearchParams } from "../../finance/payables/payables-url-filters";
import { competenceLabel } from "../../../../lib/finance-format";
import { DreStatement, payablesLink } from "./dre-statement";

const summary: FinancialDreSummary = {
  competence: "2026-09",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  grossRevenue: "15000.00",
  discounts: "300.00",
  netRevenue: "14700.00",
  acquiredNetRevenue: "14100.00",
  cmv: "4410.00",
  feesAndTaxes: "1470.00",
  salesFees: "1050.00",
  taxes: "420.00",
  taxRate: 0.06,
  realSalesFees: "900.00",
  estimatedSalesFees: "150.00",
  realFeeOrderCount: 120,
  estimatedFeeOrderCount: 1,
  grossProfit: "8820.00",
  contributionMarginRate: 0.6,
  variableExpenses: "500.00",
  fixedExpenses: "3000.00",
  estimatedNetProfit: "5320.00",
  netMarginRate: 0.3619,
  breakEvenRevenue: "5300.48",
  plannedFixedCost: "5000.00",
  fixedCostVariance: "-2000.00",
  expensesByCategory: [
    {
      categoryId: "cat-rent",
      categoryName: "Aluguel",
      dreClass: "FIXED_COST",
      amount: "3000.00",
      count: 1,
    },
    {
      categoryId: "cat-svc",
      categoryName: "Prestador",
      dreClass: "VARIABLE_EXPENSE",
      amount: "500.00",
      count: 2,
    },
  ],
};

function render(value: FinancialDreSummary) {
  return renderToStaticMarkup(<DreStatement summary={value} />)
    .split(String.fromCharCode(160))
    .join(" ");
}

describe("DreStatement", () => {
  it("shows the competence lines, margins and the planned fixed cost as reference", () => {
    const html = render(summary);

    expect(html).toContain("Margem de contribuicao");
    expect(html).toContain("Taxas de plataforma e pagamento");
    expect(html).toContain("R$ 900,00 reais em 120 pedidos · R$ 150,00 estimadas em 1 pedido");
    expect(html).toContain("Impostos (estimados 6%)");
    expect(html).toContain("Despesas variaveis");
    expect(html).toContain("Custos fixos");
    expect(html).toContain("R$ 5.320,00");
    expect(html).toContain("R$ 5.300,48");
    expect(html).toContain("Custo fixo previsto (configuracao)");
    expect(html).toContain("R$ 5.000,00");
    expect(html).toContain("-R$ 2.000,00");
    expect(html).not.toContain("Nenhum custo fixo lancado");
    expect(html).toContain(`href="${payablesLink("2026-09", "cat-rent").replace(/&/g, "&amp;")}"`);
    expect(html).toContain("(2 contas)");
  });

  it("highlights a loss, unreachable break-even and a month without fixed costs", () => {
    const html = render({
      ...summary,
      fixedExpenses: "0.00",
      estimatedNetProfit: "-120.00",
      netMarginRate: -0.1,
      breakEvenRevenue: null,
      expensesByCategory: [],
    });

    expect(html).toContain("Prejuizo do mes");
    expect(html).toContain("Resultado liquido (prejuizo)");
    expect(html).toContain("Nao atingivel");
    expect(html).toContain("Nenhum custo fixo lancado para esta competencia");
  });

  it("names the month and builds the payables link the payables page understands", () => {
    expect(competenceLabel("2026-09")).toBe("setembro de 2026");

    const url = new URL(payablesLink("2026-09", "cat-rent"), "http://localhost");
    expect(filtersFromSearchParams(Object.fromEntries(url.searchParams))).toMatchObject({
      competenceMonth: "2026-09",
      categoryIds: ["cat-rent"],
      competenceIncludesDueDate: true,
    });
    expect(
      filtersFromSearchParams({ competenceMonth: "2026-9", competenceIncludesDueDate: "true" })
    ).toMatchObject({
      competenceMonth: "",
      competenceIncludesDueDate: false,
    });
  });
});
