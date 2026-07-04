import React from "react";
import type { StoreOpenMode } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlatformAdminToken, getPlatformStore, updatePlatformStore } from "../../../../lib/api";

export const dynamic = "force-dynamic";

interface StoreDetailPageProps {
  params: {
    storeId: string;
  };
}

async function updateStoreAction(storeId: string, formData: FormData) {
  "use server";

  const token = await getPlatformAdminToken();
  const active = formData.get("active") === "on";
  const openMode = String(formData.get("openMode") ?? "FORCE_CLOSED") as StoreOpenMode;
  const operatingHoursText = String(formData.get("operatingHours") ?? "{}").trim() || "{}";

  await updatePlatformStore(token, storeId, {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    active,
    openMode,
    operatingHours: JSON.parse(operatingHoursText) as Record<string, unknown>,
  });

  revalidatePath(`/platform/stores/${storeId}`);
  revalidatePath("/platform/stores");
}

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const token = await getPlatformAdminToken();
  let store;

  try {
    store = await getPlatformStore(token, params.storeId);
  } catch (error) {
    if (isPlatformForbidden(error)) {
      redirect("/admin");
    }

    throw error;
  }
  const updateAction = updateStoreAction.bind(null, params.storeId);
  const operatingHours = JSON.stringify(store.operatingHours ?? {}, null, 2);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-4xl">
        <a className="text-sm font-semibold text-ink" href="/platform/stores">
          Voltar para lojas
        </a>
        <h1 className="mt-4 text-3xl font-semibold">{store.name}</h1>
        <p className="mt-2 text-slate-600">/{store.slug}</p>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Responsavel</p>
            <p className="mt-2 font-semibold">{store.owner?.name ?? "Nao definido"}</p>
            <p className="text-sm text-slate-600">{store.owner?.email}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Operacao</p>
            <p className="mt-2 font-semibold">{store.active ? "Ativa" : "Inativa"}</p>
            <p className="text-sm text-slate-600">
              {store.isOpen ? "Aberta" : "Fechada"} · {openModeLabel(store.openMode)}
            </p>
          </article>
        </section>

        <form
          action={updateAction}
          className="mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Configuracao da loja</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">
              Nome publico
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                defaultValue={store.name}
                name="name"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Slug
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                defaultValue={store.slug}
                name="slug"
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Telefone
              <input
                className="rounded-md border border-slate-300 px-3 py-2"
                defaultValue={store.phone}
                name="phone"
                required
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input defaultChecked={store.active} name="active" type="checkbox" />
                Loja ativa
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Abertura
                <select
                  className="rounded-md border border-slate-300 px-3 py-2"
                  defaultValue={store.openMode}
                  name="openMode"
                >
                  <option value="SCHEDULE">Seguir agenda</option>
                  <option value="FORCE_OPEN">Forcar aberta</option>
                  <option value="FORCE_CLOSED">Forcar fechada</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Agenda de horarios
              <textarea
                className="min-h-36 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                defaultValue={operatingHours}
                name="operatingHours"
              />
            </label>
          </div>
          <button className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
            Salvar configuracao
          </button>
        </form>

        <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Prontidao</h2>
          <ul className="mt-3 grid gap-2">
            {store.readiness?.checks.map((check) => (
              <li key={check.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{check.message}</span>
                <span
                  className={
                    check.passed ? "font-semibold text-green-700" : "font-semibold text-red-700"
                  }
                >
                  {check.passed ? "OK" : "Pendente"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}

function openModeLabel(openMode: StoreOpenMode): string {
  const labels: Record<StoreOpenMode, string> = {
    SCHEDULE: "segue agenda",
    FORCE_OPEN: "abertura forcada",
    FORCE_CLOSED: "fechamento forcado",
  };

  return labels[openMode];
}

function isPlatformForbidden(error: unknown): boolean {
  return error instanceof Error && error.message.includes("[403] /api/platform/stores");
}
