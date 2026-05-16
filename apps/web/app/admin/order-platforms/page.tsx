import { revalidatePath } from "next/cache";
import {
  createOrderPlatform,
  getAdminToken,
  getOrderPlatforms,
  updateOrderPlatform,
} from "../../../lib/api";

export const dynamic = "force-dynamic";

function numberFromForm(formData: FormData, key: string): number {
  return Number(formData.get(key) ?? 0);
}

export default async function OrderPlatformsPage() {
  const { orderPlatforms } = await getOrderPlatforms();

  async function create(formData: FormData) {
    "use server";

    await createOrderPlatform(await getAdminToken(), {
      name: String(formData.get("name") ?? ""),
      feeRate: numberFromForm(formData, "feeRate"),
      paymentFeeRate: numberFromForm(formData, "paymentFeeRate"),
      active: formData.get("active") === "on",
    });
    revalidatePath("/admin/order-platforms");
  }

  async function update(formData: FormData) {
    "use server";

    await updateOrderPlatform(await getAdminToken(), String(formData.get("id") ?? ""), {
      name: String(formData.get("name") ?? ""),
      feeRate: numberFromForm(formData, "feeRate"),
      paymentFeeRate: numberFromForm(formData, "paymentFeeRate"),
      active: formData.get("active") === "on",
    });
    revalidatePath("/admin/order-platforms");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase text-tomato">Dominios</p>
        <h1 className="mt-1 text-3xl font-semibold">Plataformas de pedido</h1>
        <form
          action={create}
          className="mt-8 grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_160px_160px_100px]"
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
            min={0}
            max={1}
            name="feeRate"
            placeholder="Taxa canal"
            required
            step="0.0001"
            type="number"
          />
          <input
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            min={0}
            max={1}
            name="paymentFeeRate"
            placeholder="Taxa pagamento"
            step="0.0001"
            type="number"
          />
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="active" type="checkbox" />
            Ativa
          </label>
          <button
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white md:col-span-4"
            type="submit"
          >
            Criar plataforma
          </button>
        </form>
        <div className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {orderPlatforms.map((platform) => (
            <form
              action={update}
              className="grid gap-3 p-4 md:grid-cols-[1fr_140px_140px_100px_100px]"
              key={platform.id}
            >
              <input name="id" type="hidden" value={platform.id} />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={platform.name}
                name="name"
                required
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={platform.feeRate}
                max={1}
                min={0}
                name="feeRate"
                required
                step="0.0001"
                type="number"
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                defaultValue={platform.paymentFeeRate}
                max={1}
                min={0}
                name="paymentFeeRate"
                step="0.0001"
                type="number"
              />
              <label className="flex items-center gap-2 text-sm">
                <input defaultChecked={platform.active} name="active" type="checkbox" />
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
          {orderPlatforms.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma plataforma cadastrada.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
