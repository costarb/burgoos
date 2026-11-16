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

  it("keeps the legacy base64 image already stored and replaces external mappings", async () => {
    const prisma = prismaMock();
    prisma.category.findFirst.mockResolvedValue({ id: categoryId });
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.product.findUnique.mockResolvedValue({ imageUrl: "data:image/png;base64,AAAA" });
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
    // The base64 stays in imageUrl until the migration but is not repeated in imageAssetKey.
    expect(updated).toMatchObject({ imageUrl: "data:image/png;base64,AAAA", imageAssetKey: null });
  });

  describe("bucket images (spec 030, US4)", () => {
    const oldKey = `images/${tenantId}/product/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
    const newKey = `images/${tenantId}/product/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`;

    function setup(current: string | null = oldKey) {
      const prisma = prismaMock();
      prisma.category.findFirst.mockResolvedValue({ id: categoryId });
      prisma.product.findFirst.mockResolvedValue({ id: productId });
      prisma.product.findUnique.mockResolvedValue({ imageUrl: current });
      prisma.product.update.mockImplementation(async ({ data }: { data: { imageUrl?: string | null } }) =>
        product({ imageUrl: data.imageUrl ?? current })
      );
      prisma.product.count.mockResolvedValue(0);
      const storage = {
        createReadUrl: vi.fn(async (key: string) => `https://signed.example/${key}?sig=1`),
        delete: vi.fn(async () => undefined),
      };
      const service = new CatalogService(prisma as never, {} as never, storage as never);
      return { prisma, storage, service };
    }

    it("returns a signed URL for <img> and the raw key for the form", async () => {
      const { prisma, service } = setup();
      prisma.product.findMany.mockResolvedValue([
        product({ imageUrl: oldKey }),
        product({ id: "p-http", imageUrl: "https://cdn.example/a.png" }),
        product({ id: "p-none", imageUrl: null }),
      ]);

      const [stored, external, none] = await service.listProducts(tenantId);

      expect(stored).toMatchObject({ imageUrl: `https://signed.example/${oldKey}?sig=1`, imageAssetKey: oldKey });
      expect(external).toMatchObject({ imageUrl: "https://cdn.example/a.png", imageAssetKey: "https://cdn.example/a.png" });
      expect(none).toMatchObject({ imageUrl: null, imageAssetKey: null });
    });

    it("refuses a new base64 image and a key of another store", async () => {
      const { service } = setup();
      await expect(
        service.updateProduct(tenantId, productId, { imageUrl: "data:image/png;base64,BBBB" })
      ).rejects.toThrow("Envie a imagem pelo upload");
      await expect(
        service.updateProduct(tenantId, productId, {
          imageUrl: "images/99999999-9999-4999-8999-999999999999/product/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png",
        })
      ).rejects.toThrow("imagem de outra loja");
      await expect(
        service.createProduct(tenantId, { categoryId, name: "Novo", price: 10, imageUrl: "data:image/png;base64,AAAA" })
      ).rejects.toThrow("Envie a imagem pelo upload");
    });

    it("removes the replaced image from the bucket when no product uses it", async () => {
      const { prisma, storage, service } = setup();

      await service.updateProduct(tenantId, productId, { imageUrl: newKey });

      expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageUrl: newKey }) }));
      expect(prisma.product.count).toHaveBeenCalledWith({ where: { tenantId, imageUrl: oldKey } });
      expect(storage.delete).toHaveBeenCalledWith(oldKey);
    });

    it("keeps the old file when another product uses it, when the image is unchanged and when delete fails", async () => {
      const shared = setup();
      shared.prisma.product.count.mockResolvedValue(1);
      await shared.service.updateProduct(tenantId, productId, { imageUrl: "" });
      expect(shared.storage.delete).not.toHaveBeenCalled();

      const unchanged = setup();
      await unchanged.service.updateProduct(tenantId, productId, { imageUrl: oldKey, name: "Outro nome" });
      await unchanged.service.updateProduct(tenantId, productId, { name: "Sem imagem no corpo" });
      expect(unchanged.storage.delete).not.toHaveBeenCalled();

      const failing = setup();
      failing.storage.delete.mockRejectedValueOnce(new Error("bucket down"));
      await expect(failing.service.updateProduct(tenantId, productId, { imageUrl: newKey })).resolves.toMatchObject({
        imageAssetKey: newKey,
      });
    });
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
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
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
