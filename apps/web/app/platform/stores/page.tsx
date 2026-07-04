import React from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPlatformStore, getPlatformAdminToken, listPlatformStores } from "../../../lib/api";

export const dynamic = "force-dynamic";

async function createStoreAction(formData: FormData) {
  "use server";

  const token = await getPlatformAdminToken();

  await createPlatformStore(token, {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    openMode: formData.get("openMode") === "FORCE_OPEN" ? "FORCE_OPEN" : "FORCE_CLOSED",
    owner: {
      name: String(formData.get("ownerName") ?? ""),
      email: String(formData.get("ownerEmail") ?? ""),
      temporaryPassword: String(formData.get("temporaryPassword") ?? ""),
    },
  });

  revalidatePath("/platform/stores");
}

export default async function StoresPage() {
  const token = await getPlatformAdminToken();
  let stores;

  try {
    stores = await listPlatformStores(token);
  } catch (error) {
    if (isPlatformForbidden(error)) {
      redirect("/admin");
    }

    throw error;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-3xl font-semibold">Lojas</h1>
          <p className="mt-2 text-slate-600">Cadastro e acompanhamento das lojas configuradas.</p>

          <div className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Operacao</th>
                  <th className="px-4 py-3 font-semibold">Pronta</th>
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={5}>
                      Nenhuma loja cadastrada.
                    </td>
                  </tr>
                ) : (
                  stores.map((store) => (
                    <tr key={store.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <a className="font-semibold text-ink" href={`/platform/stores/${store.id}`}>
                          {store.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{store.slug}</td>
                      <td className="px-4 py-3">{store.active ? "Ativa" : "Inativa"}</td>
                      <td className="px-4 py-3">{store.isOpen ? "Aberta" : "Fechada"}</td>
                      <td className="px-4 py-3">{store.readiness?.ready ? "Sim" : "Nao"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form
          action={createStoreAction}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Criar loja</h2>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">
              Nome publico
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                name="name"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Slug
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                name="slug"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Telefone
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                name="phone"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Responsavel
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                name="ownerName"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              E-mail
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                name="ownerEmail"
                required
                type="email"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Senha temporaria
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                name="temporaryPassword"
                required
                type="password"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Operacao inicial
              <select className="rounded-md border border-slate-300 px-3 py-2" name="openMode">
                <option value="FORCE_CLOSED">Criar fechada</option>
                <option value="FORCE_OPEN">Criar aberta</option>
              </select>
            </label>
          </div>
          <button
            className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            type="submit"
          >
            Criar loja
          </button>
        </form>
      </section>
    </main>
  );
}

function isPlatformForbidden(error: unknown): boolean {
  return error instanceof Error && error.message.includes("[403] /api/platform/stores");
}
