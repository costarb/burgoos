import React from "react";
import { getFinancialDre } from "../../../../lib/api";

export const dynamic = "force-dynamic";

interface DrePageProps {
  searchParams: {
    start?: string;
    end?: string;
  };
}

export default async function DrePage({ searchParams }: DrePageProps) {
  const summary = await getFinancialDre(searchParams.start, searchParams.end);

  const rows = [
    ["Receita bruta", summary.grossRevenue],
    ["Descontos", summary.discounts],
    ["Receita liquida", summary.netRevenue],
    ["CMV", summary.cmv],
    ["Taxas e impostos", summary.feesAndTaxes],
    ["Lucro bruto", summary.grossProfit],
    ["Custos fixos", summary.fixedExpenses],
    ["Lucro liquido estimado", summary.estimatedNetProfit],
    ["Ponto de equilibrio", summary.breakEvenRevenue],
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">DRE</p>
            <h1 className="mt-1 text-3xl font-semibold">Resultado do periodo</h1>
            <p className="mt-2 text-slate-600">
              Baseado em pedidos entregues com snapshot de CMV, taxas e configuracoes financeiras.
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin"
          >
            Painel
          </a>
        </div>

        <form className="mt-8 flex flex-wrap gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={searchParams.start ?? ""}
            name="start"
            type="date"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={searchParams.end ?? ""}
            name="end"
            type="date"
          />
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Filtrar
          </button>
        </form>

        <div className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white">
          {rows.map(([label, value]) => (
            <div
              className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={label}
            >
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold">R$ {value}</span>
            </div>
          ))}
        </div>

        <article className="mt-6 rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Margem liquida estimada</p>
          <p className="mt-2 text-3xl font-semibold">{(summary.netMarginRate * 100).toFixed(1)}%</p>
        </article>
      </section>
    </main>
  );
}
