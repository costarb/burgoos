import { DeliveryProvider, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "../src/catalog/catalog.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";

describe("catalog product management", () => {
  it("filters by external mapping and serializes platform IDs", async () => {
    const prisma = prismaMock();
    prisma.product.findMany.mockResolvedValue([
      product({
        externalMappings: [
          {
            id: "mapping-1",
            tenantId,
            productId,
            provider: DeliveryProvider.IFOOD,
            externalProductId: "IFOOD-123",
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          },
        ],
      }),
    ]);
    const service = new CatalogService(prisma as never, {} as never);

    const products = await service.listProducts(tenantId, {
      search: "IFOOD-123",
      provider: DeliveryProvider.IFOOD,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          externalMappings: { some: { provider: DeliveryProvider.IFOOD } },
        }),
        include: expect.objectContaining({ externalMappings: expect.any(Object) }),
      })
    );
    expect(products[0]).toMatchObject({
      id: productId,
      price: "29.90",
      externalMappings: [{ provider: "IFOOD", externalProductId: "IFOOD-123" }],
    });
  });

  it("lists lean product options without image or relations, scoped to the tenant", async () => {
    const prisma = prismaMock();
    prisma.product.findMany.mockResolvedValue([
      { id: productId, name: "Dogao", price: new Prisma.Decimal("22.5"), active: true },
    ]);
    const service = new CatalogService(prisma as never, {} as never);

    const options = await service.listProductOptions(tenantId, true);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { tenantId, active: true },
      select: { id: true, name: true, price: true, active: true },
      orderBy: { name: "asc" },
    });
    expect(options).toEqual([{ id: productId, name: "Dogao", price: "22.50", active: true }]);
    expect(Object.keys(options[0])).not.toContain("imageUrl");

    await service.listProductOptions(tenantId);
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { tenantId } }));
  });

  it("updates base64 image and replaces external mappings", async () => {
    const prisma = prismaMock();
    prisma.category.findFirst.mockResolvedValue({ id: categoryId });
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.product.update.mockResolvedValue(product({ imageUrl: "old" }));
    prisma.product.findUniqueOrThrow.mockResolvedValue(
      product({
        imageUrl: "data:image/png;base64,AAAA",
        externalMappings: [
          {
            id: "mapping-2",
            tenantId,
            productId,
            provider: DeliveryProvider.IFOOD,
            externalProductId: "IFOOD-999",
            createdAt: new Date("2026-07-01T00:00:00.000Z"),
            updatedAt: new Date("2026-07-01T00:00:00.000Z"),
          },
        ],
      })
    );
    const service = new CatalogService(prisma as never, {} as never);

    const updated = await service.updateProduct(tenantId, productId, {
      categoryId,
      name: "Produto editado",
      description: "Descricao",
      price: 32.5,
      imageUrl: "data:image/png;base64,AAAA",
      active: true,
      externalMappings: [{ provider: DeliveryProvider.IFOOD, externalProductId: "IFOOD-999" }],
    });

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: "data:image/png;base64,AAAA",
          price: expect.any(Prisma.Decimal),
        }),
      })
    );
    expect(prisma.productExternalMapping.deleteMany).toHaveBeenCalledWith({
      where: { tenantId, productId },
    });
    expect(prisma.productExternalMapping.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId,
          productId,
          provider: DeliveryProvider.IFOOD,
          externalProductId: "IFOOD-999",
        },
      ],
    });
    expect(updated.externalMappings).toEqual([
      { id: "mapping-2", provider: "IFOOD", externalProductId: "IFOOD-999" },
    ]);
  });
});

function prismaMock() {
  return {
    category: {
      findFirst: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    productExternalMapping: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: productId,
    tenantId,
    categoryId,
    name: "Burgo Classico",
    description: "Pao, burger e queijo",
    price: new Prisma.Decimal("29.90"),
    imageUrl: null,
    active: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    externalMappings: [],
    ...overrides,
  };
}
