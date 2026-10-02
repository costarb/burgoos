import React from "react";
import type { FinancialDreCategoryExpense, FinancialDreSummary } from "@rrfive/types";
import { formatMoney, formatPercent, salesFeesBreakdown } from "../../../../lib/finance-format";

export function payablesLink(competence: string, categoryId: string): string {
  const params = new URLSearchParams({
    competenceMonth: competence,
    categoryId,
    competenceIncludesDueDate: "true",
  });
  return `/admin/finance/payables?${params.toString()}`;
}

type Sign = "+" | "-" | "=";

interface LineProps {
  sign: Sign;
  label: string;
  value: string;
  hint?: string;
  categories?: FinancialDreCategoryExpense[];
  competence?: string;
}

function StatementLine({ sign, label, value, hint, categories, competence }: LineProps) {
  const total = sign === "=";
  const content = (
    <>
      <span className="w-5 text-center font-mono text-slate-400" aria-hidden="true">
        {sign === "-" ? "−" : sign}
      </span>
      <span className={total ? "font-semibold text-slate-900" : "text-slate-600"}>
        {label}
        {hint ? <span className="ml-2 text-xs font-normal text-slate-500">{hint}</span> : null}
      </span>
      <span
        className={`text-right tabular-nums ${total ? "font-semibold" : ""} ${
          Number(value) < 0 ? "text-red-700" : ""
        }`}
      >
        {formatMoney(value)}
      </span>
    </>
  );
  const row = `grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-3 px-4 py-3 text-sm ${
    total ? "bg-slate-50" : ""
  }`;

  if (!categories || !competence) {
    return <div className={`${row} border-b border-slate-100 last:border-b-0`}>{content}</div>;
  }

  return (
    <details className="group border-b border-slate-100 last:border-b-0">
      <summary className={`${row} cursor-pointer list-none hover:bg-slate-50`}>{content}</summary>
      <div className="bg-slate-50 px-4 pb-3 pl-12">
        {categories.length === 0 ? (
          <p className="py-2 text-xs text-slate-500">
            Nenhuma conta lancada para esta competencia.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {categories.map((category) => (
              <li
                className="flex items-baseline justify-between gap-3 py-2 text-xs"
                key={category.categoryId}
              >
                <a
                  className="font-medium text-slate-700 underline-offset-2 hover:underline"
                  href={payablesLink(competence, category.categoryId)}
                >
                  {category.categoryName}
                  <span className="ml-1 text-slate-500">
                    ({category.count} {category.count === 1 ? "conta" : "contas"})
                  </span>
                </a>
                <span className="tabular-nums text-slate-700">{formatMoney(category.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "loss" | "muted";
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          tone === "loss" ? "text-red-700" : tone === "muted" ? "text-slate-500" : ""
        }`}
      >
        {value}
      </p>
    </article>
  );
}

export function DreStatement({ summary }: { summary: FinancialDreSummary }) {
  const loss = Number(summary.estimatedNetProfit) < 0;
  const byClass = (dreClass: FinancialDreCategoryExpense["dreClass"]) =>
    summary.expensesByCategory.filter((category) => category.dreClass === dreClass);
  const noFixedCost = Number(summary.fixedExpenses) === 0;
  const variance = Number(summary.fixedCostVariance);

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicator
          label={loss ? "Prejuizo do mes" : "Resultado liquido"}
          tone={loss ? "loss" : undefined}
          value={formatMoney(summary.estimatedNetProfit)}
        />
        <Indicator
          label="Margem liquida"
          tone={loss ? "loss" : undefined}
          value={formatPercent(summary.netMarginRate)}
        />
        <Indicator
          label="Margem de contribuicao"
          value={formatPercent(summary.contributionMarginRate)}
        />
        <Indicator
          label="Ponto de equilibrio"
          tone={summary.breakEvenRevenue === null ? "muted" : undefined}
          value={
            summary.breakEvenRevenue === null
              ? "Nao atingivel"
              : formatMoney(summary.breakEvenRevenue)
          }
        />
      </div>

      {noFixedCost ? (
        <p
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          Nenhum custo fixo lancado para esta competencia. Lance as contas fixas (aluguel,
          salarios...) em Contas a pagar ou confira a classificacao das categorias.
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
        <StatementLine label="Receita bruta" sign="+" value={summary.grossRevenue} />
        <StatementLine label="Descontos" sign="-" value={summary.discounts} />
        <StatementLine label="Receita liquida" sign="=" value={summary.netRevenue} />
        <StatementLine label="CMV" sign="-" value={summary.cmv} />
        <StatementLine
          hint={salesFeesBreakdown(summary)}
          label="Taxas de plataforma e pagamento"
          sign="-"
          value={summary.salesFees}
        />
        <StatementLine
          label={`Impostos (estimados ${formatPercent(summary.taxRate)})`}
          sign="-"
          value={summary.taxes}
        />
        <StatementLine
          hint={formatPercent(summary.contributionMarginRate)}
          label="Margem de contribuicao"
          sign="="
          value={summary.grossProfit}
        />
        <StatementLine
          categories={byClass("VARIABLE_EXPENSE")}
          competence={summary.competence}
          label="Despesas variaveis"
          sign="-"
          value={summary.variableExpenses}
        />
        <StatementLine
          categories={byClass("FIXED_COST")}
          competence={summary.competence}
          label="Custos fixos"
          sign="-"
          value={summary.fixedExpenses}
        />
        <StatementLine
          hint={formatPercent(summary.netMarginRate)}
          label={loss ? "Resultado liquido (prejuizo)" : "Resultado liquido"}
          sign="="
          value={summary.estimatedNetProfit}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <p className="text-slate-500">Custo fixo previsto (configuracao)</p>
          <p className="mt-1 font-semibold tabular-nums">{formatMoney(summary.plannedFixedCost)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <p className="text-slate-500">Diferenca lancado x previsto</p>
          <p className={`mt-1 font-semibold tabular-nums ${variance > 0 ? "text-red-700" : ""}`}>
            {variance > 0 ? "+" : ""}
            {formatMoney(summary.fixedCostVariance)}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
          <p className="text-slate-500">Recebido liquido (adquirente)</p>
          <p className="mt-1 font-semibold tabular-nums">
            {formatMoney(summary.acquiredNetRevenue)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        O custo fixo previsto e apenas referencia e nao entra no resultado. Insumos, taxas ja
        descontadas nos pedidos e investimentos ficam fora do DRE pela classificacao das categorias.
      </p>
    </>
  );
}
