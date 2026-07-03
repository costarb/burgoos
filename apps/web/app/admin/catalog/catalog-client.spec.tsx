import type { TechnicalSheetSummary } from "@burgoos/types";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminCategory, AdminProduct } from "../../../lib/api";
import { CatalogClient } from "./catalog-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CatalogClient", () => {
  it("renders product consultation, external codes and edit action", () => {
    const html = renderToStaticMarkup(
      <CatalogClient
        initialCategories={categories}
        initialProducts={products}
        initialTechnicalSheets={technicalSheets}
        token="token"
      />
    );

    expect(html).toContain("Consulta de produtos");
    expect(html).toContain("Novo produto");
    expect(html).toContain("IFOOD-123");
    expect(html).toContain("Editar");
    expect(html).toContain("Filtrar");
  });
});

const categories: AdminCategory[] = [
  {
    id: "category-1",
    name: "Hamburgueres",
    sortOrder: 0,
    active: true,
  },
];

const products: AdminProduct[] = [
  {
    id: "product-1",
    categoryId: "category-1",
    name: "Burgo Classico",
    description: "Pao, burger e queijo",
    price: "29.90",
    imageUrl: "data:image/png;base64,AAAA",
    active: true,
    externalMappings: [
      {
        id: "mapping-1",
        provider: "IFOOD",
        externalProductId: "IFOOD-123",
      },
    ],
  },
];

const technicalSheets: TechnicalSheetSummary[] = [
  {
    productId: "product-1",
    complete: true,
    lineCount: 2,
    ingredientCmv: "10.00",
  },
];
