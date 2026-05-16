import React from "react";
import { revalidatePath } from "next/cache";
import {
  getAdminCatalog,
  getAdminToken,
  getIngredients,
  getTechnicalSheet,
  replaceTechnicalSheet,
} from "../../../../lib/api";

export const dynamic = "force-dynamic";

interface PageProps {
  params: {
    productId: string;
  };
}

export default async function TechnicalSheetEditorPage({ params }: PageProps) {
  const token = await getAdminToken();
  const [{ products }, { ingredients }, sheet] = await Promise.all([
    getAdminCatalog(),
    getIngredients(),
    getTechnicalSheet(token, params.productId),
  ]);
  const product = products.find((candidate) => candidate.id === params.productId);

  async function save(formData: FormData) {
    "use server";

    const lines = Array.from({ length: 8 })
      .map((_, index) => {
        const ingredientId = String(formData.get(`ingredientId-${index}`) ?? "");
        const quantityUsed = Number(formData.get(`quantityUsed-${index}`) ?? 0);

        if (!ingredientId || quantityUsed <= 0) {
          return null;
        }

        return {
          ingredientId,
          quantityUsed,
          isPackaging: formData.get(`isPackaging-${index}`) === "on",
          notes: String(formData.get(`notes-${index}`) ?? "") || undefined,
        };
      })
      .filter((line) => line !== null);

    await replaceTechnicalSheet(await getAdminToken(), params.productId, { lines });
    revalidatePath(`/admin/technical-sheets/${params.productId}`);
    revalidatePath("/admin/technical-sheets");
  }

  const rows = Array.from({ length: Math.max(8, sheet.lines.length) });
  const activeIngredientCount = ingredients.filter((ingredient) => ingredient.active).length;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Ficha tecnica</p>
            <h1 className="mt-1 text-3xl font-semibold">{product?.name ?? "Produto"}</h1>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/ingredients"
          >
            Gerenciar insumos
          </a>
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Produto de venda</p>
            <p className="mt-2 font-semibold">{product?.name ?? "Produto"}</p>
            <p className="text-sm text-slate-600">Preco atual R$ {product?.price ?? "0.00"}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Insumos relacionados</p>
            <p className="mt-2 text-2xl font-semibold">{sheet.lines.length}</p>
            <p className="text-sm text-slate-600">
              {activeIngredientCount} insumos ativos disponiveis
            </p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">CMV da ficha</p>
            <p className="mt-2 text-2xl font-semibold">R$ {sheet.ingredientCmv}</p>
            <p className="text-sm text-slate-600">Calculado pelas quantidades usadas</p>
          </article>
        </section>

        <form
          action={save}
          className="mt-8 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Insumos do produto</h2>
              <p className="text-sm text-slate-600">
                Cada linha liga um insumo ao produto e informa quanto desse insumo e usado em uma
                unidade vendida.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {rows.map((_, index) => {
              const line = sheet.lines[index];

              return (
                <div
                  className="grid gap-3 rounded-md border border-slate-100 p-3 md:grid-cols-[1fr_140px_120px_1fr_120px]"
                  key={index}
                >
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    defaultValue={line?.ingredientId ?? ""}
                    name={`ingredientId-${index}`}
                  >
                    <option value="">Selecionar insumo</option>
                    {ingredients
                      .filter(
                        (ingredient) => ingredient.active || ingredient.id === line?.ingredientId
                      )
                      .map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name} · R$ {ingredient.unitCost}
                        </option>
                      ))}
                  </select>
                  <input
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    defaultValue={line?.quantityUsed ?? ""}
                    min={0.001}
                    name={`quantityUsed-${index}`}
                    placeholder="Qtd usada"
                    step="0.001"
                    type="number"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      defaultChecked={line?.isPackaging ?? false}
                      name={`isPackaging-${index}`}
                      type="checkbox"
                    />
                    Embalagem
                  </label>
                  <input
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    defaultValue={line?.notes ?? ""}
                    maxLength={250}
                    name={`notes-${index}`}
                    placeholder="Notas"
                  />
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                    {line ? `R$ ${line.itemCost}` : "Sem custo"}
                  </p>
                </div>
              );
            })}
          </div>
          <button
            className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            disabled={ingredients.length === 0}
            type="submit"
          >
            Salvar ficha tecnica
          </button>
        </form>
      </section>
    </main>
  );
}
