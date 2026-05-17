import React from "react";
import { getMenuEngineeringReport } from "../../../lib/api";
import { MenuEngineeringClient } from "./menu-engineering-client";

export const dynamic = "force-dynamic";

interface MenuEngineeringPageProps {
  searchParams: {
    dateFrom?: string;
    dateTo?: string;
  };
}

export default async function MenuEngineeringPage({ searchParams }: MenuEngineeringPageProps) {
  const report = await getMenuEngineeringReport(searchParams.dateFrom, searchParams.dateTo);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Menu engineering</p>
            <h1 className="mt-1 text-3xl font-semibold">Classificacao do cardapio</h1>
            <p className="mt-2 text-slate-600">
              Produtos agrupados por volume vendido e margem bruta no periodo.
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
            defaultValue={searchParams.dateFrom ?? ""}
            name="dateFrom"
            type="date"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            defaultValue={searchParams.dateTo ?? ""}
            name="dateTo"
            type="date"
          />
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Filtrar
          </button>
        </form>

        <div className="mt-6">
          <MenuEngineeringClient report={report} />
        </div>
      </section>
    </main>
  );
}
