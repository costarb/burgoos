"use client";

import type { MenuEngineeringItem, MenuEngineeringReport } from "@burgoos/types";

const classificationLabels: Record<MenuEngineeringItem["classification"], string> = {
  STAR: "Estrela",
  WORKHORSE: "Cavalo",
  PUZZLE: "Quebra-cabeca",
  DOG: "Abacaxi",
};

const classificationStyles: Record<MenuEngineeringItem["classification"], string> = {
  STAR: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WORKHORSE: "border-amber-200 bg-amber-50 text-amber-700",
  PUZZLE: "border-sky-200 bg-sky-50 text-sky-700",
  DOG: "border-rose-200 bg-rose-50 text-rose-700",
};

interface MenuEngineeringClientProps {
  report: MenuEngineeringReport;
}

export function MenuEngineeringClient({ report }: MenuEngineeringClientProps) {
  if (report.items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        Ainda nao ha pedidos entregues com snapshots de lucratividade neste periodo.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {report.insufficientData ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Dados insuficientes para uma classificacao confiavel. Acompanhe mais produtos vendidos no
          periodo antes de tomar decisoes de cardapio.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Volume medio" value={report.averageVolume.toFixed(1)} />
        <Metric label="Margem media" value={`${(report.averageMarginRate * 100).toFixed(1)}%`} />
        <Metric label="Produtos avaliados" value={String(report.items.length)} />
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
          <span>Produto</span>
          <span>Volume</span>
          <span>Receita</span>
          <span>CMV</span>
          <span>Margem</span>
          <span>Classe</span>
        </div>
        {report.items.map((item) => (
          <div
            className="grid grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
            key={item.productId}
          >
            <span className="font-medium text-slate-900">{item.productName}</span>
            <span>{item.volumeSold}</span>
            <span>R$ {item.revenue}</span>
            <span>R$ {item.cmv}</span>
            <span>{(item.marginRate * 100).toFixed(1)}%</span>
            <span
              className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${
                classificationStyles[item.classification]
              }`}
            >
              {classificationLabels[item.classification]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
