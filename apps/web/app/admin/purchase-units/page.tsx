import { PurchaseUnitKind } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import {
  createPurchaseUnit,
  getAdminToken,
  getPurchaseUnits,
  updatePurchaseUnit,
} from "../../../lib/api";

export const dynamic = "force-dynamic";

const kinds: PurchaseUnitKind[] = ["WEIGHT", "VOLUME", "COUNT", "PACKAGE"];

export default async function PurchaseUnitsPage() {
  const { purchaseUnits } = await getPurchaseUnits();

  async function create(formData: FormData) {
    "use server";

    await createPurchaseUnit(await getAdminToken(), {
      name: String(formData.get("name") ?? ""),
      abbreviation: String(formData.get("abbreviation") ?? ""),
      kind: String(formData.get("kind") ?? "COUNT") as PurchaseUnitKind,
      active: formData.get("active") === "on",
    });
    revalidatePath("/admin/purchase-units");
  }

  async function update(formData: FormData) {
    "use server";

    const id = String(formData.get("id") ?? "");
    await updatePurchaseUnit(await getAdminToken(), id, {
      name: String(formData.get("name") ?? ""),
      abbreviation: String(formData.get("abbreviation") ?? ""),
      kind: String(formData.get("kind") ?? "COUNT") as PurchaseUnitKind,
      active: formData.get("active") === "on",
    });
    revalidatePath("/admin/purchase-units");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase text-tomato">Dominios</p>
        <h1 className="mt-1 text-3xl font-semibold">Unidades de compra</h1>
        <form
          action={create}
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_140px_160px_100px]"
        >
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={80}
            name="name"
            placeholder="Nome"
            required
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            maxLength={12}
            name="abbreviation"
            placeholder="Sigla"
            required
          />
          <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" name="kind">
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="active" type="checkbox" />
            Ativa
          </label>
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white md:col-span-4"
            type="submit"
          >
            Criar unidade
          </button>
        </form>
        <div className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {purchaseUnits.map((unit) => (
            <form
              action={update}
              className="grid gap-3 p-4 md:grid-cols-[1fr_120px_160px_100px_100px]"
              key={unit.id}
            >
              <input name="id" type="hidden" value={unit.id} />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={unit.name}
                name="name"
                required
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={unit.abbreviation}
                name="abbreviation"
                required
              />
              <select
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={unit.kind}
                name="kind"
              >
                {kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input defaultChecked={unit.active} name="active" type="checkbox" />
                Ativa
              </label>
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                type="submit"
              >
                Salvar
              </button>
            </form>
          ))}
          {purchaseUnits.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma unidade cadastrada.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
