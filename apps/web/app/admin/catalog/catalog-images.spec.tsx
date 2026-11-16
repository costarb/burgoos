import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminCategory, AdminProduct } from "../../../lib/api";
import { imagePreviewUrl } from "../../../lib/image-upload";
import { CatalogClient } from "./catalog-client";
import { LegacyImageMigrationCard } from "./legacy-image-migration-card";

const api = vi.hoisted(() => ({
  updateAdminProduct: vi.fn(),
  listAdminProducts: vi.fn(),
  getLegacyImageMigration: vi.fn(),
  requestLegacyImageMigration: vi.fn(),
}));

vi.mock("../../../lib/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tenantId = "11111111-1111-4111-8111-111111111111";
const key = `images/${tenantId}/product/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
const signed = `https://bucket.example/${key}?X-Amz-Signature=abc`;

const categories: AdminCategory[] = [{ id: "category-1", name: "Lanches", sortOrder: 0, active: true }];
const product: AdminProduct = {
  id: "product-1",
  categoryId: "category-1",
  name: "Dogao",
  description: "",
  price: "22.00",
  imageUrl: signed,
  imageAssetKey: key,
  active: true,
  externalMappings: [],
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

function button(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
  if (!found) throw new Error(`button ${text} not found`);
  return found;
}

describe("catalog images (spec 030, US4)", () => {
  it("previews the signed URL and saves the stored key, never the signed URL", async () => {
    api.getLegacyImageMigration.mockResolvedValue({ status: "IDLE", pending: 0, migrated: 0, failed: 0 });
    api.updateAdminProduct.mockResolvedValue(product);
    api.listAdminProducts.mockResolvedValue([product]);
    const view = await render(
      <CatalogClient initialCategories={categories} initialProducts={[product]} initialTechnicalSheets={[]} token="t" />
    );

    expect(view.querySelector(`img[src="${signed}"]`)).not.toBeNull();
    expect(view.querySelector('[data-testid="legacy-image-migration"]')).toBeNull();

    await act(async () => button(view, "Editar").click());
    const imageLabel = [...view.querySelectorAll("form label")].find((label) =>
      label.textContent?.includes("URL ou chave da imagem")
    );
    const textarea = imageLabel?.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe(key);
    expect(view.querySelector(`form img[src="${signed}"]`)).not.toBeNull();

    await act(async () => button(view, "Salvar alteracoes").click());
    expect(api.updateAdminProduct).toHaveBeenCalledWith("t", "product-1", expect.objectContaining({ imageUrl: key }));
  });

  it("offers the migration while images are still in the database", async () => {
    api.getLegacyImageMigration.mockResolvedValue({ status: "IDLE", pending: 36, migrated: 0, failed: 0 });
    api.requestLegacyImageMigration.mockResolvedValue({ jobId: "job-1", status: "QUEUED" });
    const view = await render(<LegacyImageMigrationCard token="t" />);

    expect(view.textContent).toContain("36 imagens ainda estao no banco");
    api.getLegacyImageMigration.mockResolvedValue({ status: "QUEUED", pending: 36, migrated: 0, failed: 0 });
    await act(async () => button(view, "Migrar imagens antigas").click());

    expect(api.requestLegacyImageMigration).toHaveBeenCalledWith("t");
    expect(view.textContent).toContain("Migrando as imagens");
  });

  it("computes the preview of each kind of value", () => {
    const initial = { value: key, url: signed };
    expect(imagePreviewUrl(key, initial, null)).toBe(signed);
    expect(imagePreviewUrl("https://cdn.example/a.png", initial, null)).toBe("https://cdn.example/a.png");
    expect(imagePreviewUrl("images/x/product/new.png", initial, { key: "images/x/product/new.png", url: "blob:1" })).toBe(
      "blob:1"
    );
    expect(imagePreviewUrl("images/x/product/other.png", initial, null)).toBeNull();
    expect(imagePreviewUrl("", initial, null)).toBeNull();
  });
});
