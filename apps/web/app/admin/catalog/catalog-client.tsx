"use client";

import type { DeliveryProvider, OperationState, TechnicalSheetSummary } from "@burgoos/types";
import React, { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalShell } from "../../../components/admin/modal-shell";
import { OperationFeedback } from "../../../components/admin/operation-feedback";
import {
  AdminCategory,
  AdminProduct,
  AdminProductFilters,
  AdminProductInput,
  createAdminCategory,
  createAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from "../../../lib/api";

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

const emptyFilters: AdminProductFilters = {
  search: "",
  categoryId: "",
  active: "",
  provider: "",
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
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [filters, setFilters] = useState<AdminProductFilters>(emptyFilters);
  const [dialog, setDialog] = useState<ProductDialogState | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState("0");
  const [categoryActive, setCategoryActive] = useState(true);
  const [operation, setOperation] = useState<OperationState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
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

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    await run(
      "Criando categoria.",
      async () => {
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
        setCategoryName("");
        setCategorySortOrder("0");
        setCategoryActive(true);
        router.refresh();
      },
      "Categoria criada."
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
              disabled={busy || categories.length === 0}
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

        {categories.length === 0 ? (
          <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Cadastre ao menos uma categoria para incluir produtos no cardapio.
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
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
                disabled={busy}
                type="submit"
              >
                Criar categoria
              </button>
            </div>
          </form>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
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
                {categories.map((category) => (
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
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <section>
            <h2 className="text-lg font-semibold">Categorias</h2>
            <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {categories.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Nenhuma categoria criada.</p>
              ) : (
                categories.map((category) => (
                  <div className="flex items-center justify-between gap-3 p-4" key={category.id}>
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

          <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
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
        </div>

        {dialog ? (
          <ProductEditorDialog
            busy={busy}
            categories={categories}
            mode={dialog.mode}
            onClose={() => setDialog(null)}
            onSubmit={submitProduct}
            product={dialog.mode === "edit" ? dialog.product : null}
          />
        ) : null}
      </section>
    </main>
  );
}

function ProductEditorDialog({
  mode,
  product,
  categories,
  busy,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  product?: AdminProduct | null;
  categories: AdminCategory[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: AdminProductInput) => Promise<void>;
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

    if (!file.type.startsWith("image/")) {
      setFileError("Arquivo de imagem invalido.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setImageUrl(dataUrl);
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
            URL ou base64
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nao foi possivel carregar a imagem."));
    reader.readAsDataURL(file);
  });
}
