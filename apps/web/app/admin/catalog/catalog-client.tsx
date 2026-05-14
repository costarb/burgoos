"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminCategory,
  AdminProduct,
  createAdminCategory,
  createAdminProduct,
} from "../../../lib/api";

interface CatalogClientProps {
  token: string;
  initialCategories: AdminCategory[];
  initialProducts: AdminProduct[];
}

export function CatalogClient({ token, initialCategories, initialProducts }: CatalogClientProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [categoryName, setCategoryName] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState("0");
  const [categoryActive, setCategoryActive] = useState(true);
  const [productCategoryId, setProductCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productActive, setProductActive] = useState(true);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setCategorySubmitting(true);

    try {
      const category = await createAdminCategory(token, {
        name: categoryName.trim(),
        sortOrder: Number(categorySortOrder || 0),
        active: categoryActive,
      });

      setCategories((current) =>
        [...current, category].sort(
          (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
        )
      );
      setProductCategoryId((current) => current || category.id);
      setCategoryName("");
      setCategorySortOrder("0");
      setCategoryActive(true);
      setMessage("Categoria criada.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao criar categoria.");
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setProductSubmitting(true);

    try {
      const product = await createAdminProduct(token, {
        categoryId: productCategoryId,
        name: productName.trim(),
        description: productDescription.trim() || undefined,
        price: Number(productPrice),
        imageUrl: productImageUrl.trim() || undefined,
        active: productActive,
      });

      setProducts((current) =>
        [...current, product].sort((left, right) => {
          const leftCategory = categoryById.get(left.categoryId)?.sortOrder ?? 0;
          const rightCategory = categoryById.get(right.categoryId)?.sortOrder ?? 0;
          return leftCategory - rightCategory || left.name.localeCompare(right.name);
        })
      );
      setProductName("");
      setProductDescription("");
      setProductPrice("");
      setProductImageUrl("");
      setProductActive(true);
      setMessage("Produto criado.");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao criar produto.");
    } finally {
      setProductSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Catalogo</p>
            <h1 className="mt-1 text-3xl font-semibold">Categorias e produtos</h1>
          </div>
          <a
            className="rounded-md bg-tomato px-4 py-2 text-sm font-semibold text-white"
            href="/piloto"
          >
            Ver cardapio
          </a>
        </div>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">{message}</p>
        ) : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-[320px_1fr]">
          <form
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={handleCreateCategory}
          >
            <h2 className="text-lg font-semibold">Nova categoria</h2>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                maxLength={80}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Nome"
                required
                value={categoryName}
              />
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                min={0}
                onChange={(event) => setCategorySortOrder(event.target.value)}
                placeholder="Ordem"
                type="number"
                value={categorySortOrder}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={categoryActive}
                  onChange={(event) => setCategoryActive(event.target.checked)}
                  type="checkbox"
                />
                Ativa no cardapio
              </label>
              <button
                className="w-full rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                disabled={categorySubmitting}
                type="submit"
              >
                {categorySubmitting ? "Criando..." : "Criar categoria"}
              </button>
            </div>
          </form>

          <form
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={handleCreateProduct}
          >
            <h2 className="text-lg font-semibold">Novo produto</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                disabled={categories.length === 0}
                onChange={(event) => setProductCategoryId(event.target.value)}
                required
                value={productCategoryId}
              >
                {categories.length === 0 ? (
                  <option value="">Crie uma categoria antes</option>
                ) : null}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                maxLength={120}
                onChange={(event) => setProductName(event.target.value)}
                placeholder="Nome"
                required
                value={productName}
              />
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                min={0}
                onChange={(event) => setProductPrice(event.target.value)}
                placeholder="Preco"
                required
                step="0.01"
                type="number"
                value={productPrice}
              />
              <input
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setProductImageUrl(event.target.value)}
                placeholder="URL da imagem"
                type="url"
                value={productImageUrl}
              />
              <textarea
                className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                maxLength={500}
                onChange={(event) => setProductDescription(event.target.value)}
                placeholder="Descricao"
                value={productDescription}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={productActive}
                  onChange={(event) => setProductActive(event.target.checked)}
                  type="checkbox"
                />
                Ativo no cardapio
              </label>
              <button
                className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300 md:justify-self-end"
                disabled={productSubmitting || categories.length === 0}
                type="submit"
              >
                {productSubmitting ? "Criando..." : "Criar produto"}
              </button>
            </div>
          </form>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <section>
            <h2 className="text-lg font-semibold">Categorias</h2>
            <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {categories.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Nenhuma categoria criada.</p>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-slate-500">Ordem {category.sortOrder}</p>
                    </div>
                    <span className="text-sm text-slate-600">
                      {category.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                ))
              )}
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
                    <th className="px-4 py-3 font-semibold">Preco</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={4}>
                        Nenhum produto criado.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-slate-500">{product.description}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {categoryById.get(product.categoryId)?.name ?? "Sem categoria"}
                        </td>
                        <td className="px-4 py-3 font-semibold">R$ {product.price}</td>
                        <td className="px-4 py-3">{product.active ? "Ativo" : "Inativo"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
