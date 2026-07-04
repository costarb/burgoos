import React from "react";
import type { OperationState } from "@burgoos/types";
import { revalidatePath } from "next/cache";
import { OperationForm } from "../../../components/admin/operation-form";
import { SubmitButton } from "../../../components/admin/submit-button";
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

async function saveDraftAction(
  _previousState: OperationState,
  formData: FormData
): Promise<OperationState> {
  "use server";

  try {
    const token = await getAdminToken();

    await saveBrandingDraft(token, {
      logoUrl: await readImageAsset(formData, "logoUrl", "logoUpload"),
      headerImageUrl: await readImageAsset(formData, "headerImageUrl", "headerImageUpload"),
      bodyImageUrl: await readImageAsset(formData, "bodyImageUrl", "bodyImageUpload"),
      footerImageUrl: await readImageAsset(formData, "footerImageUrl", "footerImageUpload"),
      primaryColor: String(formData.get("primaryColor") ?? "#C92A2A"),
      accentColor: String(formData.get("accentColor") ?? "#F59F00"),
      neutralTheme: String(formData.get("neutralTheme") ?? "LIGHT") as "LIGHT",
      layoutPreset: String(formData.get("layoutPreset") ?? "classic") as StoreLayoutPresetKey,
      showProductImages: formData.get("showProductImages") === "on",
      showProductDescriptions: formData.get("showProductDescriptions") === "on",
      orderingEnabled: formData.get("orderingEnabled") === "on",
    });

    revalidatePath("/admin/branding");
    return { status: "success", message: "Rascunho salvo com sucesso." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Nao foi possivel salvar o rascunho.",
    };
  }
}

async function publishAction(): Promise<OperationState> {
  "use server";

  try {
    const token = await getAdminToken();
    await publishBranding(token);
    revalidatePath("/admin/branding");
    return { status: "success", message: "Identidade visual publicada." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Nao foi possivel publicar.",
    };
  }
}

async function restoreAction(): Promise<OperationState> {
  "use server";

  try {
    const token = await getAdminToken();
    await restoreBranding(token);
    revalidatePath("/admin/branding");
    return { status: "success", message: "Versao anterior restaurada." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Nao foi possivel restaurar.",
    };
  }
}

async function publishFormAction(
  _previousState: OperationState,
  _formData: FormData
): Promise<OperationState> {
  "use server";

  return publishAction();
}

async function restoreFormAction(
  _previousState: OperationState,
  _formData: FormData
): Promise<OperationState> {
  "use server";

  return restoreAction();
}

async function readImageAsset(
  formData: FormData,
  textFieldName: string,
  fileFieldName: string
): Promise<string | null> {
  const uploaded = formData.get(fileFieldName);

  if (uploaded instanceof File && uploaded.size > 0) {
    if (!uploaded.type.startsWith("image/")) {
      throw new Error("Arquivo de imagem invalido.");
    }

    const base64 = Buffer.from(await uploaded.arrayBuffer()).toString("base64");
    return `data:${uploaded.type};base64,${base64}`;
  }

  const textValue = String(formData.get(textFieldName) ?? "").trim();
  return textValue || null;
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
          <OperationForm
            action={saveDraftAction}
            className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
            feedbackClassName="mt-4"
          >
            <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold">Imagens da pagina</legend>
              <ImageAssetField
                currentValue={current?.logoUrl ?? ""}
                fileName="logoUpload"
                label="Logo"
                name="logoUrl"
              />
              <ImageAssetField
                currentValue={current?.headerImageUrl ?? ""}
                fileName="headerImageUpload"
                label="Imagem de header"
                name="headerImageUrl"
              />
              <ImageAssetField
                currentValue={current?.bodyImageUrl ?? ""}
                fileName="bodyImageUpload"
                label="Imagem de body"
                name="bodyImageUrl"
              />
              <ImageAssetField
                currentValue={current?.footerImageUrl ?? ""}
                fileName="footerImageUpload"
                label="Imagem de footer"
                name="footerImageUrl"
              />
            </fieldset>
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
            <fieldset className="grid gap-3 rounded-md border border-slate-200 p-4">
              <legend className="px-1 text-sm font-semibold">Cardapio publico</legend>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  defaultChecked={current?.showProductImages ?? false}
                  name="showProductImages"
                  type="checkbox"
                />
                <span>
                  <span className="block font-medium">Mostrar fotos dos produtos</span>
                  <span className="text-slate-600">
                    Exibe a imagem cadastrada no produto quando ela existir.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  defaultChecked={current?.showProductDescriptions ?? false}
                  name="showProductDescriptions"
                  type="checkbox"
                />
                <span>
                  <span className="block font-medium">Mostrar descricoes</span>
                  <span className="text-slate-600">
                    Mostra o texto descritivo abaixo do nome do produto.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  defaultChecked={current?.orderingEnabled ?? true}
                  name="orderingEnabled"
                  type="checkbox"
                />
                <span>
                  <span className="block font-medium">Permitir pedidos pelo cardapio</span>
                  <span className="text-slate-600">
                    Desmarque para usar a pagina apenas como vitrine do cardapio.
                  </span>
                </span>
              </label>
            </fieldset>
            <SubmitButton className="w-fit" pendingLabel="Salvando rascunho...">
              Salvar rascunho
            </SubmitButton>
          </OperationForm>

          <aside className="h-fit rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Previsualizacao</h2>
            <div
              className="mt-4 rounded-md border border-slate-200 p-4"
              style={{ borderTopColor: current?.primaryColor ?? "#C92A2A", borderTopWidth: 6 }}
            >
              <ImagePreview imageUrl={current?.headerImageUrl ?? null} label="Header" />
              <p
                className="text-sm font-semibold"
                style={{ color: current?.primaryColor ?? "#C92A2A" }}
              >
                /loja
              </p>
              {current?.logoUrl ? (
                <img
                  alt=""
                  className="mt-3 h-12 w-12 rounded-md border border-slate-200 object-contain"
                  src={current.logoUrl}
                />
              ) : null}
              <p className="mt-2 text-xl font-bold">Produto exemplo</p>
              <ImagePreview imageUrl={current?.bodyImageUrl ?? null} label="Body" />
              <p className="mt-1 text-sm text-slate-600">
                Layout {current?.layoutPreset ?? "classic"}
              </p>
              {current?.showProductDescriptions ? (
                <p className="mt-2 text-sm text-slate-600">Descricao visivel no cardapio.</p>
              ) : null}
              {(current?.orderingEnabled ?? true) ? (
                <button
                  className="mt-4 rounded-md px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: current?.accentColor ?? "#F59F00" }}
                  type="button"
                >
                  Adicionar
                </button>
              ) : (
                <p className="mt-4 rounded-md bg-slate-100 p-2 text-sm text-slate-600">
                  Modo somente consulta
                </p>
              )}
              <ImagePreview imageUrl={current?.footerImageUrl ?? null} label="Footer" />
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
              <OperationForm action={publishFormAction}>
                <SubmitButton
                  className="disabled:bg-slate-300"
                  disabled={!state.draft}
                  pendingLabel="Publicando..."
                >
                  Publicar
                </SubmitButton>
              </OperationForm>
              <OperationForm action={restoreFormAction}>
                <SubmitButton
                  className="border border-slate-300 bg-white text-slate-800 disabled:text-slate-400"
                  disabled={history.filter((item) => item.status === "ARCHIVED").length === 0}
                  pendingLabel="Restaurando..."
                >
                  Restaurar anterior
                </SubmitButton>
              </OperationForm>
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

function ImageAssetField({
  currentValue,
  fileName,
  label,
  name,
}: {
  currentValue: string;
  fileName: string;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
      <label className="grid gap-1 text-sm font-medium">
        {label}
        <textarea
          className="min-h-16 rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={currentValue}
          name={name}
          placeholder="https://... ou data:image/..."
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Upload
        <input
          accept="image/*"
          className="rounded-md border border-slate-300 bg-white px-3 py-2"
          name={fileName}
          type="file"
        />
      </label>
      {currentValue ? (
        <img
          alt=""
          className="h-20 w-full rounded-md border border-slate-200 bg-white object-contain"
          src={currentValue}
        />
      ) : null}
    </div>
  );
}

function ImagePreview({ imageUrl, label }: { imageUrl: string | null; label: string }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <img
      alt={label}
      className="mb-3 mt-3 h-auto w-full rounded-md border border-slate-200 object-contain"
      src={imageUrl}
    />
  );
}
