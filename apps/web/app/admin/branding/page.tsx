import React from "react";
import { revalidatePath } from "next/cache";
import {
  getAdminToken,
  getBrandingHistory,
  getBrandingState,
  publishBranding,
  restoreBranding,
  saveBrandingDraft,
} from "../../../lib/api";
import type { StoreLayoutPresetKey } from "@burgoos/types";

export const dynamic = "force-dynamic";

async function saveDraftAction(formData: FormData) {
  "use server";

  const token = await getAdminToken();

  await saveBrandingDraft(token, {
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    primaryColor: String(formData.get("primaryColor") ?? "#C92A2A"),
    accentColor: String(formData.get("accentColor") ?? "#F59F00"),
    neutralTheme: String(formData.get("neutralTheme") ?? "LIGHT") as "LIGHT",
    layoutPreset: String(formData.get("layoutPreset") ?? "classic") as StoreLayoutPresetKey,
  });

  revalidatePath("/admin/branding");
}

async function publishAction() {
  "use server";

  const token = await getAdminToken();
  await publishBranding(token);
  revalidatePath("/admin/branding");
}

async function restoreAction() {
  "use server";

  const token = await getAdminToken();
  await restoreBranding(token);
  revalidatePath("/admin/branding");
}

export default async function BrandingPage() {
  const token = await getAdminToken();
  const [state, history] = await Promise.all([getBrandingState(token), getBrandingHistory(token)]);
  const current = state.draft ?? state.published;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold">Identidade visual</h1>
        <p className="mt-2 text-slate-600">Logo, cores e tema da loja.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <form
            action={saveDraftAction}
            className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
          >
            <label className="grid gap-1 text-sm font-medium">
              Logo URL
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                defaultValue={current?.logoUrl ?? ""}
                name="logoUrl"
                placeholder="https://..."
                type="url"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Cor principal
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 py-2"
                  defaultValue={current?.primaryColor ?? "#C92A2A"}
                  name="primaryColor"
                  type="color"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Cor de destaque
                <input
                  className="h-11 rounded-md border border-slate-300 px-3 py-2"
                  defaultValue={current?.accentColor ?? "#F59F00"}
                  name="accentColor"
                  type="color"
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Tema neutro
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                defaultValue={current?.neutralTheme ?? "LIGHT"}
                name="neutralTheme"
              >
                <option value="LIGHT">Claro</option>
                <option value="DARK">Escuro</option>
                <option value="SYSTEM_DEFAULT">Padrao do sistema</option>
              </select>
            </label>
            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold">Layout</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {state.availableLayouts.length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhum layout disponivel.</p>
                ) : (
                  state.availableLayouts.map((layout) => (
                    <label
                      className="grid min-h-28 cursor-pointer gap-2 rounded-md border border-slate-300 p-3 text-sm"
                      key={layout.key}
                    >
                      <input
                        defaultChecked={(current?.layoutPreset ?? "classic") === layout.key}
                        name="layoutPreset"
                        type="radio"
                        value={layout.key}
                      />
                      <span className="font-semibold">{layout.name}</span>
                      <span className="text-slate-600">{layout.description}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>
            <button
              className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
              type="submit"
            >
              Salvar rascunho
            </button>
          </form>

          <aside className="h-fit rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Previsualizacao</h2>
            <div
              className="mt-4 rounded-md border border-slate-200 p-4"
              style={{ borderTopColor: current?.primaryColor ?? "#C92A2A", borderTopWidth: 6 }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: current?.primaryColor ?? "#C92A2A" }}
              >
                /loja
              </p>
              <p className="mt-2 text-xl font-bold">Produto exemplo</p>
              <p className="mt-1 text-sm text-slate-600">
                Layout {current?.layoutPreset ?? "classic"}
              </p>
              <button
                className="mt-4 rounded-md px-3 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: current?.accentColor ?? "#F59F00" }}
                type="button"
              >
                Adicionar
              </button>
            </div>
          </aside>
        </div>

        <section className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Publicacao</h2>
              <p className="text-sm text-slate-600">
                Rascunhos so aparecem no cardapio publico depois da publicacao.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={publishAction}>
                <button
                  className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                  disabled={!state.draft}
                  type="submit"
                >
                  Publicar
                </button>
              </form>
              <form action={restoreAction}>
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:text-slate-400"
                  disabled={history.filter((item) => item.status === "ARCHIVED").length === 0}
                  type="submit"
                >
                  Restaurar anterior
                </button>
              </form>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Layout</th>
                  <th className="px-3 py-2 font-semibold">Publicado em</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={3}>
                      Nenhuma publicacao ainda.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr className="border-t border-slate-200" key={item.id}>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2">{item.layoutPreset}</td>
                      <td className="px-3 py-2">
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleString("pt-BR")
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
