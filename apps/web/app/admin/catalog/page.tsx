import { getAdminCatalog } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage() {
  const { categories, products } = await getAdminCatalog();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Catálogo</p>
            <h1 className="mt-1 text-3xl font-semibold">Categorias e produtos</h1>
          </div>
          <a
            className="rounded-md bg-tomato px-4 py-2 text-sm font-semibold text-white"
            href="/piloto"
          >
            Ver cardápio
          </a>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <section>
            <h2 className="text-lg font-semibold">Categorias</h2>
            <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-slate-500">Ordem {category.sortOrder}</p>
                  </div>
                  <span className="text-sm text-slate-600">
                    {category.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Produtos</h2>
            <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 font-semibold">Categoria</th>
                    <th className="px-4 py-3 font-semibold">Preço</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-slate-500">{product.description}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {categories.find((category) => category.id === product.categoryId)?.name ??
                          "Sem categoria"}
                      </td>
                      <td className="px-4 py-3 font-semibold">R$ {product.price}</td>
                      <td className="px-4 py-3">{product.active ? "Ativo" : "Inativo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
