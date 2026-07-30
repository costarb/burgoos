import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { CounterCatalogService } from "./counter-catalog.service";

describe("CounterCatalogService", () => {
  it("exposes active products, non-packaging ingredients and enabled complements", async () => {
    const prisma = {
      category: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "category-1",
            name: "Lanches",
            sortOrder: 1,
            products: [
              {
                id: "product-1",
                categoryId: "category-1",
                name: "Dogao",
                description: "Completo",
                price: new Decimal("20.00"),
                imageUrl: null,
                active: true,
                technicalSheets: [
                  {
                    lines: [
                      { ingredient: { id: "ingredient-1", name: "Cebola" }, isPackaging: false },
                      { ingredient: { id: "ingredient-2", name: "Embalagem" }, isPackaging: true },
                    ],
                  },
                ],
                complementAssignments: [
                  {
                    active: true,
                    maxQuantity: 2,
                    complement: {
                      id: "complement-1",
                      name: "Bacon",
                      description: null,
                      price: new Decimal("4.50"),
                      maxQuantity: 3,
                      active: true,
                    },
                  },
                  {
                    active: true,
                    maxQuantity: 1,
                    complement: {
                      id: "complement-2",
                      name: "Indisponivel",
                      description: null,
                      price: new Decimal("1.00"),
                      maxQuantity: 1,
                      active: false,
                    },
                  },
                ],
              },
            ],
          },
        ]),
      },
    };

    const result = await new CounterCatalogService(prisma as never).getCatalog("tenant-1");

    expect(result.categories[0].products[0].ingredients).toEqual([
      { id: "ingredient-1", name: "Cebola", removable: true },
    ]);
    expect(result.categories[0].products[0].complements).toEqual([
      {
        id: "complement-1",
        name: "Bacon",
        description: null,
        price: "4.50",
        maxQuantity: 2,
        active: true,
      },
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", active: true } }),
    );
  });
});
