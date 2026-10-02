import React from "react";
import { getFinancialDre } from "../../../../lib/api";
import { competenceLabel, DreStatement } from "./dre-statement";

export const dynamic = "force-dynamic";

interface DrePageProps {
  searchParams: {
    competence?: string;
    /** Legacy links (`?start=AAAA-MM-DD`) open the month of the start date. */
    start?: string;
  };
}

export default async function DrePage({ searchParams }: DrePageProps) {
  const competence = searchParams.competence || searchParams.start?.slice(0, 7) || undefined;
  const summary = await getFinancialDre(competence);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">DRE</p>
            <h1 className="mt-1 text-3xl font-semibold first-letter:uppercase">
              {competenceLabel(summary.competence)}
            </h1>
            <p className="mt-2 text-slate-600">
              Vendas entregues no mes e despesas lancadas em contas a pagar para a competencia (sem competencia,
              vale o vencimento).
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin"
          >
            Painel
          </a>
        </div>

        <form className="mt-8 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-medium text-slate-700" htmlFor="dre-competence">
            Competencia
          </label>
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={summary.competence}
            id="dre-competence"
            name="competence"
            required
            type="month"
          />
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Ver mes
          </button>
        </form>

        <DreStatement summary={summary} />
      </section>
    </main>
  );
}
