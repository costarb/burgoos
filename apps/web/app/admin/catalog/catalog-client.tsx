"use client";

import type { DeliveryProvider, OperationState, TechnicalSheetSummary } from "@burgoos/types";
import React, { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalShell } from "../../../components/admin/modal-shell";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import {
  AdminCategory,
  AdminCategoryFilters,
  AdminCategoryInput,
  AdminProduct,
  AdminProductFilters,
  AdminProductInput,
  createAdminCategory,
  createAdminProduct,
  deleteAdminCategory,
  listAdminCategories,
  listAdminProducts,
  updateAdminCategory,
  updateAdminProduct,
} from "../../../lib/api";
import { uploadImageAsset } from "../../../lib/image-upload";

interface CatalogClientProps {
  token: string;
  initialCategories: AdminCategory[];
  initialProducts: AdminProduct[];
  initialTechnicalSheets: TechnicalSheetSummary[];
}

type ProductDialogState =
  | {
      mode: "create";
      product?: never;
    }
  | {
      mode: "edit";
      product: AdminProduct;
    };

type CategoryDialogState =
  | {
      mode: "create";
      category?: never;
    }
  | {
      mode: "edit";
      category: AdminCategory;
    };

const emptyFilters: AdminProductFilters = {
  search: "",
  categoryId: "",
  active: "",
  provider: "",
};

const emptyCategoryFilters: AdminCategoryFilters = {
  search: "",
  active: "",
};

const providerLabels: Record<DeliveryProvider, string> = {
  IFOOD: "iFood",
  CUSTOM: "Custom",
};

export function CatalogClient({
  token,
  initialCategories,
  initialProducts,
  initialTechnicalSheets,
}: CatalogClientProps) {
  const router = useRouter();
  const [productCategories, setProductCategories] = useState(initialCategories);
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [activeTab, setActiveTab] = useState<"products" | "categories">("products");
  const [filters, setFilters] = useState<AdminProductFilters>(emptyFilters);
  const [categoryFilters, setCategoryFilters] =
    useState<AdminCategoryFilters>(emptyCategoryFilters);
  const [dialog, setDialog] = useState<ProductDialogState | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState | null>(null);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const categoryById = useMemo(
    () => new Map(productCategories.map((category) => [category.id, category])),
    [productCategories]
  );
  const technicalSheetByProductId = useMemo(
    () => new Map(initialTechnicalSheets.map((sheet) => [sheet.productId, sheet])),
    [initialTechnicalSheets]
  );

  async function run(message: string, action: () => Promise<void>, successMessage: string) {
    if (busy) {
      return;
    }

    setBusy(true);
    setOperation({ status: "pending", message });

    try {
      await action();
      setOperation({ status: "success", message: successMessage });
    } catch (caughtError) {
      setOperation({
        status: "error",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Nao foi possivel concluir a operacao.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function refreshProducts(nextFilters = filters) {
    const updatedProducts = await listAdminProducts(token, nextFilters);
    setProducts(updatedProducts);
  }

  async function refreshCategories(nextFilters = categoryFilters) {
    const updatedCategories = await listAdminCategories(token, nextFilters);
    setCategories(updatedCategories);
  }

  async function refreshProductCategories() {
    const updatedCategories = await listAdminCategories(token, emptyCategoryFilters);
    setProductCategories(updatedCategories);
  }

  async function submitCategory(payload: AdminCategoryInput) {
    await run(
      categoryDialog?.mode === "edit" ? "Salvando categoria." : "Criando categoria.",
      async () => {
        if (categoryDialog?.mode === "edit") {
          await updateAdminCategory(token, categoryDialog.category.id, payload);
        } else {
          await createAdminCategory(token, payload);
        }
        await refreshCategories();
        await refreshProductCategories();
        setCategoryDialog(null);
        router.refresh();
      },
      categoryDialog?.mode === "edit" ? "Categoria atualizada." : "Categoria criada."
    );
  }

  async function removeCategory(category: AdminCategory) {
    await run(
      "Excluindo categoria.",
      async () => {
        await deleteAdminCategory(token, category.id);
        await refreshCategories();
        await refreshProductCategories();
        router.refresh();
      },
      "Categoria excluida."
    );
  }

  async function applyCategoryFilters() {
    await run(
      "Aplicando filtros de categorias.",
      async () => {
        await refreshCategories(categoryFilters);
      },
      "Filtros aplicados."
    );
  }

  async function clearCategoryFilters() {
    setCategoryFilters(emptyCategoryFilters);
    await run(
      "Limpando filtros de categorias.",
      async () => {
        await refreshCategories(emptyCategoryFilters);
      },
      "Filtros limpos."
    );
  }

  async function applyFilters() {
    await run(
      "Aplicando filtros de produtos.",
      async () => {
        await refreshProducts(filters);
      },
      "Filtros aplicados."
    );
  }

  async function clearFilters() {
    setFilters(emptyFilters);
    await run(
      "Limpando filtros de produtos.",
      async () => {
        await refreshProducts(emptyFilters);
      },
      "Filtros limpos."
    );
  }

  async function submitProduct(payload: AdminProductInput) {
    await run(
      dialog?.mode === "edit" ? "Salvando produto." : "Criando produto.",
      async () => {
        if (dialog?.mode === "edit") {
          await updateAdminProduct(token, dialog.product.id, payload);
        } else {
          await createAdminProduct(token, payload);
        }
        await refreshProducts();
        setDialog(null);
        router.refresh();
      },
      dialog?.mode === "edit" ? "Produto atualizado." : "Produto criado."
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-tomato">Catalogo</p>
            <h1 className="mt-1 text-3xl font-semibold">Categorias e produtos</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy || productCategories.length === 0}
              onClick={() => setDialog({ mode: "create" })}
              type="button"
            >
              Novo produto
            </button>
            <a
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
              href="/piloto"
            >
              Ver cardapio
            </a>
          </div>
        </div>

        <OperationFeedback
          className="mt-4"
          onDismiss={() => setOperation({ status: "idle" })}
          state={operation}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex gap-2">
            <TabButton active={activeTab === "products"} onClick={() => setActiveTab("products")}>
              Produtos
            </TabButton>
            <TabButton
              active={activeTab === "categories"}
              onClick={() => setActiveTab("categories")}
            >
              Categorias
            </TabButton>
          </div>
          {activeTab === "categories" ? (
            <button
              className="mb-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              disabled={busy}
              onClick={() => setCategoryDialog({ mode: "create" })}
              type="button"
            >
              Nova categoria
            </button>
          ) : null}
        </div>

        {activeTab === "products" ? (
          <>
            {productCategories.length === 0 ? (
              <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Cadastre ao menos uma categoria para incluir produtos no cardapio.
              </section>
            ) : null}

            <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Consulta de produtos</h2>
                  <p className="text-sm text-slate-500">
                    Pesquise por nome, descricao, categoria, status ou codigo externo.
                  </p>
                </div>
                <a className="text-sm font-semibold text-tomato" href="/admin/ingredients">
                  Ver insumos
                </a>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_0.8fr_0.8fr_auto_auto]">
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Nome, descricao ou codigo externo"
                  value={filters.search ?? ""}
                />
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  value={filters.categoryId ?? ""}
                >
                  <option value="">Todas as categorias</option>
                  {productCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, active: event.target.value }))
                  }
                  value={filters.active ?? ""}
                >
                  <option value="">Todos status</option>
                  <option value="true">Ativos</option>
                  <option value="false">Inativos</option>
                </select>
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      provider: event.target.value as DeliveryProvider | "",
                    }))
                  }
                  value={filters.provider ?? ""}
                >
                  <option value="">Todas plataformas</option>
                  {Object.entries(providerLabels).map(([provider, label]) => (
                    <option key={provider} value={provider}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={busy}
                  onClick={applyFilters}
                  type="button"
                >
                  Filtrar
                </button>
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={clearFilters}
                  type="button"
                >
                  Limpar
                </button>
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_0.9fr_1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
                <span>Produto</span>
                <span>Categoria</span>
                <span>Preco</span>
                <span>Status</span>
                <span>Plataformas</span>
                <span>Acoes</span>
              </div>
              {products.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">Nenhum produto encontrado.</p>
              ) : (
                products.map((product) => {
                  const sheet = technicalSheetByProductId.get(product.id);

                  return (
                    <article
                      className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_0.7fr_0.9fr_1fr_auto] md:items-center"
                      key={product.id}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductImage imageUrl={product.imageUrl} name={product.name} />
                        <div className="min-w-0">
                          <p className="font-semibold">{product.name}</p>
                          <p className="line-clamp-2 text-sm text-slate-500">
                            {product.description || "Sem descricao"}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">
                        {categoryById.get(product.categoryId)?.name ?? "Sem categoria"}
                      </p>
                      <p className="text-sm font-semibold">R$ {product.price}</p>
                      <div className="space-y-2">
                        <StatusBadge active={product.active} />
                        <a
                          className={
                            sheet?.complete
                              ? "block w-fit rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-800"
                              : "block w-fit rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                          }
                          href={`/admin/technical-sheets/${product.id}`}
                        >
                          {sheet?.complete
                            ? `${sheet.lineCount} insumos - CMV R$ ${sheet.ingredientCmv}`
                            : "Ficha pendente"}
                        </a>
                      </div>
                      <ExternalMappingsList product={product} />
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                        onClick={() => setDialog({ mode: "edit", product })}
                        type="button"
                      >
                        Editar
                      </button>
                    </article>
                  );
                })
              )}
            </section>
          </>
        ) : (
          <>
            <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Consulta de categorias</h2>
                <p className="text-sm text-slate-500">
                  Organize as secoes do cardapio e controle quais ficam visiveis.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setCategoryFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Buscar categoria"
                  value={categoryFilters.search ?? ""}
                />
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setCategoryFilters((current) => ({
                      ...current,
                      active: event.target.value,
                    }))
                  }
                  value={categoryFilters.active ?? ""}
                >
                  <option value="">Todos status</option>
                  <option value="true">Ativas</option>
                  <option value="false">Inativas</option>
                </select>
                <button
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={busy}
                  onClick={applyCategoryFilters}
                  type="button"
                >
                  Filtrar
                </button>
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={clearCategoryFilters}
                  type="button"
                >
                  Limpar
                </button>
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.4fr_0.5fr_0.6fr_0.6fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
                <span>Categoria</span>
                <span>Ordem</span>
                <span>Produtos</span>
                <span>Status</span>
                <span>Acoes</span>
              </div>
              {categories.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">Nenhuma categoria encontrada.</p>
              ) : (
                categories.map((category) => (
                  <article
                    className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_0.5fr_0.6fr_0.6fr_auto] md:items-center"
                    key={category.id}
                  >
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-sm text-slate-500">
                        {category.active
                          ? "Visivel no cardapio publico"
                          : "Oculta no cardapio publico"}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">{category.sortOrder}</p>
                    <p className="text-sm text-slate-600">{category.productCount ?? 0}</p>
                    <StatusBadge active={category.active} />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                        onClick={() => setCategoryDialog({ mode: "edit", category })}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                        disabled={busy || (category.productCount ?? 0) > 0}
                        onClick={() => {
                          if (window.confirm("Excluir categoria?")) {
                            void removeCategory(category);
                          }
                        }}
                        type="button"
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </>
        )}

        {dialog ? (
          <ProductEditorDialog
            busy={busy}
            categories={productCategories}
            mode={dialog.mode}
            onClose={() => setDialog(null)}
            onSubmit={submitProduct}
            product={dialog.mode === "edit" ? dialog.product : null}
            token={token}
          />
        ) : null}
        {categoryDialog ? (
          <CategoryEditorDialog
            busy={busy}
            category={categoryDialog.mode === "edit" ? categoryDialog.category : null}
            mode={categoryDialog.mode}
            onClose={() => setCategoryDialog(null)}
            onSubmit={submitCategory}
          />
        ) : null}
      </section>
    </main>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`border-b-2 px-3 py-3 text-sm font-semibold ${
        active
          ? "border-tomato text-slate-950"
          : "border-transparent text-slate-500 hover:text-slate-900"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function CategoryEditorDialog({
  mode,
  category,
  busy,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  category?: AdminCategory | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: AdminCategoryInput) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [active, setActive] = useState(category?.active ?? true);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      name: name.trim(),
      sortOrder: Number(sortOrder || 0),
      active,
    });
  }

  return (
    <ModalShell
      busy={busy}
      description={
        mode === "create"
          ? "Inclua uma secao para organizar os produtos no cardapio."
          : "Atualize nome, ordem e visibilidade da categoria."
      }
      onClose={onClose}
      title={mode === "create" ? "Nova categoria" : "Editar categoria"}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <label className="text-sm">
            Nome
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="text-sm">
            Ordem
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              min={0}
              onChange={(event) => setSortOrder(event.target.value)}
              required
              step={1}
              type="number"
              value={sortOrder}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              type="checkbox"
            />
            <span>Categoria ativa no cardapio</span>
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {mode === "create" ? "Incluir categoria" : "Salvar alteracoes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ProductEditorDialog({
  mode,
  product,
  categories,
  busy,
  onClose,
  onSubmit,
  token,
}: {
  mode: "create" | "edit";
  product?: AdminProduct | null;
  categories: AdminCategory[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: AdminProductInput) => Promise<void>;
  token: string;
}) {
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [externalMappings, setExternalMappings] = useState<Record<DeliveryProvider, string>>({
    IFOOD:
      product?.externalMappings.find((mapping) => mapping.provider === "IFOOD")
        ?.externalProductId ?? "",
    CUSTOM:
      product?.externalMappings.find((mapping) => mapping.provider === "CUSTOM")
        ?.externalProductId ?? "",
  });
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);

    if (!file) {
      return;
    }

    try {
      setImageUrl(await uploadImageAsset(token, file, "PRODUCT_IMAGE"));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      categoryId,
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price),
      imageUrl: imageUrl.trim() || null,
      active,
      externalMappings: Object.entries(externalMappings)
        .map(([provider, externalProductId]) => ({
          provider: provider as DeliveryProvider,
          externalProductId: externalProductId.trim(),
        }))
        .filter((mapping) => mapping.externalProductId.length > 0),
    });
  }

  return (
    <ModalShell
      busy={busy}
      description={
        mode === "create"
          ? "Inclua o produto sem sair da consulta atual."
          : "Atualize dados do produto, imagem e codigos de plataformas externas."
      }
      onClose={onClose}
      title={mode === "create" ? "Novo produto" : "Editar produto"}
    >
      <form className="grid gap-4 lg:grid-cols-[1fr_260px]" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Categoria
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => setCategoryId(event.target.value)}
              required
              value={categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nome
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="text-sm">
            Preco
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              min={0}
              onChange={(event) => setPrice(event.target.value)}
              required
              step="0.01"
              type="number"
              value={price}
            />
          </label>
          <label className="flex items-end gap-2 text-sm text-slate-700">
            <input
              checked={active}
              className="mb-3"
              onChange={(event) => setActive(event.target.checked)}
              type="checkbox"
            />
            <span className="pb-2">Ativo no cardapio</span>
          </label>
          <label className="text-sm md:col-span-2">
            Descricao
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
          <fieldset className="rounded-md border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold">Codigos externos</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(providerLabels).map(([provider, label]) => (
                <label className="text-sm" key={provider}>
                  {label}
                  <input
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    maxLength={120}
                    onChange={(event) =>
                      setExternalMappings((current) => ({
                        ...current,
                        [provider]: event.target.value,
                      }))
                    }
                    value={externalMappings[provider as DeliveryProvider]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="space-y-3">
          <ProductImage imageUrl={imageUrl || null} large name={name || "Produto"} />
          <label className="block text-sm">
            Upload de imagem
            <input
              accept="image/*"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => {
                void handleFileChange(event);
              }}
              type="file"
            />
          </label>
          <label className="block text-sm">
            URL ou chave da imagem
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
              onChange={(event) => setImageUrl(event.target.value)}
              value={imageUrl}
            />
          </label>
          {fileError ? <p className="text-sm text-red-700">{fileError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {mode === "create" ? "Incluir produto" : "Salvar alteracoes"}
            </button>
          </div>
        </aside>
      </form>
    </ModalShell>
  );
}

function ProductImage({
  imageUrl,
  name,
  large = false,
}: {
  imageUrl: string | null;
  name: string;
  large?: boolean;
}) {
  const sizeClass = large ? "h-44 w-full" : "h-14 w-14";

  if (!imageUrl) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-400`}
      >
        Sem imagem
      </div>
    );
  }

  return (
    <img
      alt={name}
      className={`${sizeClass} shrink-0 rounded-md border border-slate-200 object-cover`}
      src={imageUrl}
    />
  );
}

function ExternalMappingsList({ product }: { product: AdminProduct }) {
  if (product.externalMappings.length === 0) {
    return <p className="text-sm text-slate-500">Sem vinculos</p>;
  }

  return (
    <div className="space-y-1 text-sm">
      {product.externalMappings.map((mapping) => (
        <p key={`${mapping.provider}-${mapping.externalProductId}`}>
          <span className="font-semibold">{providerLabels[mapping.provider]}:</span>{" "}
          {mapping.externalProductId}
        </p>
      ))}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`block w-fit rounded-md border px-2 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
