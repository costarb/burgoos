import type { OperationState, PurchaseUnitKind } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import { OperationForm } from "../../../components/admin/operation-form";
import { SubmitButton } from "../../../components/admin/submit-button";
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

  async function create(_previousState: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      await createPurchaseUnit(await getAdminToken(), {
        name: String(formData.get("name") ?? ""),
        abbreviation: String(formData.get("abbreviation") ?? ""),
        kind: String(formData.get("kind") ?? "COUNT") as PurchaseUnitKind,
        active: formData.get("active") === "on",
      });
      revalidatePath("/admin/purchase-units");
      return { status: "success", message: "Unidade criada com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel criar a unidade.",
      };
    }
  }

  async function update(_previousState: OperationState, formData: FormData): Promise<OperationState> {
    "use server";

    try {
      const id = String(formData.get("id") ?? "");
      await updatePurchaseUnit(await getAdminToken(), id, {
        name: String(formData.get("name") ?? ""),
        abbreviation: String(formData.get("abbreviation") ?? ""),
        kind: String(formData.get("kind") ?? "COUNT") as PurchaseUnitKind,
        active: formData.get("active") === "on",
      });
      revalidatePath("/admin/purchase-units");
      return { status: "success", message: "Unidade salva com sucesso." };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel salvar a unidade.",
      };
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase text-tomato">Dominios</p>
        <h1 className="mt-1 text-3xl font-semibold">Unidades de compra</h1>
        <OperationForm
          action={create}
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_140px_160px_100px]"
          feedbackClassName="mt-4"
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
          <SubmitButton className="md:col-span-4" pendingLabel="Criando unidade...">
            Criar unidade
          </SubmitButton>
        </OperationForm>
        <div className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {purchaseUnits.map((unit) => (
            <OperationForm
              action={update}
              className="grid gap-3 p-4 md:grid-cols-[1fr_120px_160px_100px_100px]"
              feedbackClassName="px-4 pb-4"
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
              <SubmitButton className="bg-slate-900 px-3" pendingLabel="Salvando...">
                Salvar
              </SubmitButton>
            </OperationForm>
          ))}
          {purchaseUnits.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma unidade cadastrada.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
