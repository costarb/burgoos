import React from "react";
import { getAdminCatalog } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function TechnicalSheetsPage() {
  const { products, categories, technicalSheets } = await getAdminCatalog();
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const sheetByProductId = new Map(technicalSheets.map((sheet) => [sheet.productId, sheet]));

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase text-tomato">CMV</p>
        <h1 className="mt-1 text-3xl font-semibold">Fichas tecnicas</h1>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">1. Insumos</p>
            <p className="mt-1 text-sm text-slate-700">Cadastre custos e unidades em Insumos.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">2. Produto</p>
            <p className="mt-1 text-sm text-slate-700">Escolha o produto do cardapio.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">3. Quantidade usada</p>
            <p className="mt-1 text-sm text-slate-700">Relacione cada insumo e calcule o CMV.</p>
          </div>
        </div>

        <div className="mt-8 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {products.map((product) => {
            const sheet = sheetByProductId.get(product.id);

            return (
              <a
                className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
                href={`/admin/technical-sheets/${product.id}`}
                key={product.id}
              >
                <span>
                  <span className="block font-medium">{product.name}</span>
                  <span className="text-sm text-slate-500">
                    {categoryById.get(product.categoryId) ?? "Sem categoria"} - R$ {product.price}
                  </span>
                </span>
                <span
                  className={
                    sheet?.complete
                      ? "rounded-md bg-green-50 px-3 py-1 text-sm font-medium text-green-800"
                      : "rounded-md bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
                  }
                >
                  {sheet?.complete
                    ? `${sheet.lineCount} insumos - CMV R$ ${sheet.ingredientCmv}`
                    : "Pendente: relacionar insumos"}
                </span>
              </a>
            );
          })}
          {products.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Cadastre produtos antes de montar fichas tecnicas.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
