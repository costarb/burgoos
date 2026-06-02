import React from "react";
import { getPlatformAdminToken, getPlatformStore } from "../../../../lib/api";

export const dynamic = "force-dynamic";

interface StoreDetailPageProps {
  params: {
    storeId: string;
  };
}

export default async function StoreDetailPage({ params }: StoreDetailPageProps) {
  const token = await getPlatformAdminToken();
  const store = await getPlatformStore(token, params.storeId);

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
            <p className="text-sm text-slate-600">{store.isOpen ? "Aberta" : "Fechada"}</p>
          </article>
        </section>

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
