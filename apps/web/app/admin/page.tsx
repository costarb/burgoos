import { getAdminDailySummary } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const summary = await getAdminDailySummary();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold">Painel BurgoOS</h1>
        <p className="mt-2 text-slate-600">
          Operacao piloto com catalogo, pedidos e fila em tempo real.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            href="/admin/orders"
          >
            Pedidos
          </a>
          <a
            className="rounded-md bg-tomato px-4 py-2 text-sm font-semibold text-white"
            href="/admin/catalog"
          >
            Catalogo
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/settings"
          >
            Configuracoes
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/purchase-units"
          >
            Unidades
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/suppliers"
          >
            Fornecedores
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/order-platforms"
          >
            Plataformas
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/ingredients"
          >
            Insumos
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/technical-sheets"
          >
            Fichas tecnicas
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/pricing"
          >
            Precificacao
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/admin/inventory"
          >
            Estoque
          </a>
          <a
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            href="/piloto"
          >
            Cardapio publico
          </a>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pedidos entregues hoje</p>
            <p className="mt-2 text-3xl font-semibold">{summary.orderCount}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Receita bruta hoje</p>
            <p className="mt-2 text-3xl font-semibold">R$ {summary.grossRevenue}</p>
          </article>
        </section>
      </section>
    </main>
  );
}
