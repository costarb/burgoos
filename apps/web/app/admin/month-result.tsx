import React from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { FinancialDashboardIndicators } from "@rrfive/types";
import { competenceLabel, formatMoney, formatPercent } from "../../lib/finance-format";

type Sign = "+" | "-" | "=";

/** Current-month result on the Painel, with the same lines as the DRE screen. */
export function MonthResult({ indicators }: { indicators: FinancialDashboardIndicators }) {
  const loss = Number(indicators.estimatedNetProfit) < 0;
  const noFixedCost = Number(indicators.fixedExpenses) === 0;
  const rows: Array<{ sign: Sign; label: string; value: string; hint?: string; loss?: boolean }> = [
    { sign: "+", label: "Receita liquida", value: indicators.netRevenue },
    { sign: "-", label: "CMV", value: indicators.cmv },
    { sign: "-", label: "Taxas de plataforma e pagamento", value: indicators.salesFees },
    { sign: "-", label: "Impostos (estimados)", value: indicators.taxes },
    {
      sign: "=",
      label: "Margem de contribuicao",
      value: indicators.grossProfit,
      hint: formatPercent(indicators.contributionMarginRate),
    },
    { sign: "-", label: "Despesas variaveis", value: indicators.variableExpenses },
    { sign: "-", label: "Custos fixos", value: indicators.fixedExpenses },
    {
      sign: "=",
      label: loss ? "Resultado liquido (prejuizo)" : "Resultado liquido",
      value: indicators.estimatedNetProfit,
      hint: formatPercent(indicators.netMarginRate),
      loss,
    },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold first-letter:uppercase">
          Resultado de {competenceLabel(indicators.competence)}
        </h2>
        <Link
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950"
          href={`/admin/reports/dre?competence=${indicators.competence}`}
        >
          Ver DRE
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
      <dl className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {rows.map((row) => (
          <div
            className={`grid grid-cols-[1rem_1fr_auto] items-baseline gap-2 px-4 py-2.5 text-sm ${
              row.sign === "=" ? "bg-slate-50 font-semibold" : ""
            }`}
            key={row.label}
          >
            <span aria-hidden className="font-mono text-slate-400">
              {row.sign === "-" ? "−" : row.sign}
            </span>
            <dt className={row.sign === "=" ? "text-slate-900" : "text-slate-600"}>
              {row.label}
              {row.hint ? (
                <span className="ml-2 text-xs font-normal text-slate-500">{row.hint}</span>
              ) : null}
            </dt>
            <dd className={`tabular-nums ${row.loss ? "text-red-700" : "text-slate-950"}`}>
              {formatMoney(row.value)}
            </dd>
          </div>
        ))}
      </dl>
      {noFixedCost ? (
        <p
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="status"
        >
          Nenhum custo fixo lancado neste mes. O resultado fica maior ate que aluguel, salarios e
          demais custos fixos sejam lancados em Contas a pagar.
        </p>
      ) : null}
    </div>
  );
}
