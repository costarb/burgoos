import React from "react";
import type { OperationState } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import { OperationForm } from "../../../components/admin/operation-form";
import { SubmitButton } from "../../../components/admin/submit-button";
import {
  createIngredient,
  getAdminToken,
  getIngredients,
  updateIngredient,
} from "../../../lib/api";

export const dynamic = "force-dynamic";

function numberFromForm(formData: FormData, key: string): number {
  return Number(formData.get(key) ?? 0);
}

function optionalId(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "");
  return value || undefined;
}

export default async function IngredientsPage() {
  const { ingredients, purchaseUnits, suppliers } = await getIngredients();

  async function create(_previousState: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await createIngredient(await getAdminToken(), {
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? ""),
        purchaseUnitId: String(formData.get("purchaseUnitId") ?? ""),
        supplierId: optionalId(formData, "supplierId"),
        purchaseQuantity: numberFromForm(formData, "purchaseQuantity"),
        purchaseCost: numberFromForm(formData, "purchaseCost"),
        currentStock: numberFromForm(formData, "currentStock"),
        minimumStock: numberFromForm(formData, "minimumStock"),
        active: formData.get("active") === "on",
      });
      revalidatePath("/admin/ingredients");
      return { status: "success", message: "Insumo criado com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel criar o insumo.",
      };
    }
  }

  async function update(_previousState: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await updateIngredient(await getAdminToken(), String(formData.get("id") ?? ""), {
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? ""),
        purchaseUnitId: String(formData.get("purchaseUnitId") ?? ""),
        supplierId: optionalId(formData, "supplierId"),
        purchaseQuantity: numberFromForm(formData, "purchaseQuantity"),
        purchaseCost: numberFromForm(formData, "purchaseCost"),
        currentStock: numberFromForm(formData, "currentStock"),
        minimumStock: numberFromForm(formData, "minimumStock"),
        active: formData.get("active") === "on",
      });
      revalidatePath("/admin/ingredients");
      return { status: "success", message: "Insumo salvo com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar o insumo.",
      };
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">CMV</p>
            <h1 className="mt-1 text-3xl font-semibold">Insumos</h1>
            <p className="mt-2 text-slate-600">
              Insumos sao a base das fichas tecnicas: o custo unitario daqui alimenta o CMV de cada
              produto.
            </p>
          </div>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/technical-sheets"
          >
            Montar fichas
          </a>
        </div>
        <OperationForm
          action={create}
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
          feedbackClassName="mt-4"
        >
          <IngredientFields purchaseUnits={purchaseUnits} suppliers={suppliers} />
          <SubmitButton
            className="md:col-span-4"
            disabled={purchaseUnits.length === 0}
            pendingLabel="Criando insumo..."
          >
            Criar insumo
          </SubmitButton>
        </OperationForm>
        <div className="mt-6 space-y-3">
          {ingredients.map((ingredient) => (
            <OperationForm
              action={update}
              className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-4"
              feedbackClassName="mt-2"
              key={ingredient.id}
            >
              <input name="id" type="hidden" value={ingredient.id} />
              <IngredientFields
                ingredient={ingredient}
                purchaseUnits={purchaseUnits}
                suppliers={suppliers}
              />
              <p className="text-sm text-slate-500 md:col-span-3">
                Custo unitario calculado: R$ {ingredient.unitCost}
              </p>
              <SubmitButton className="bg-slate-900 px-3" pendingLabel="Salvando...">
                Salvar
              </SubmitButton>
            </OperationForm>
          ))}
          {ingredients.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Nenhum insumo cadastrado.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function IngredientFields({
  ingredient,
  purchaseUnits,
  suppliers,
}: {
  ingredient?: {
    name: string;
    category: string;
    purchaseUnitId: string;
    supplierId: string | null;
    purchaseQuantity: number;
    purchaseCost: string;
    currentStock: number;
    minimumStock: number;
    active: boolean;
  };
  purchaseUnits: Array<{ id: string; name: string; abbreviation: string; active: boolean }>;
  suppliers: Array<{ id: string; name: string; active: boolean }>;
}) {
  const activeUnits = purchaseUnits.filter(
    (unit) => unit.active || unit.id === ingredient?.purchaseUnitId
  );
  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.active || supplier.id === ingredient?.supplierId
  );

  return (
    <>
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.name ?? ""}
        maxLength={120}
        name="name"
        placeholder="Nome"
        required
      />
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.category ?? ""}
        maxLength={80}
        name="category"
        placeholder="Categoria"
        required
      />
      <select
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.purchaseUnitId ?? ""}
        name="purchaseUnitId"
        required
      >
        <option value="">Unidade</option>
        {activeUnits.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} ({unit.abbreviation})
          </option>
        ))}
      </select>
      <select
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.supplierId ?? ""}
        name="supplierId"
      >
        <option value="">Sem fornecedor</option>
        {activeSuppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.purchaseQuantity ?? ""}
        min={0.001}
        name="purchaseQuantity"
        placeholder="Qtd compra"
        required
        step="0.001"
        type="number"
      />
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.purchaseCost ?? ""}
        min={0}
        name="purchaseCost"
        placeholder="Custo compra"
        required
        step="0.01"
        type="number"
      />
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.currentStock ?? 0}
        min={0}
        name="currentStock"
        placeholder="Estoque atual"
        step="0.001"
        type="number"
      />
      <input
        className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        defaultValue={ingredient?.minimumStock ?? 0}
        min={0}
        name="minimumStock"
        placeholder="Estoque minimo"
        step="0.001"
        type="number"
      />
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={ingredient?.active ?? true} name="active" type="checkbox" />
        Ativo
      </label>
    </>
  );
}
