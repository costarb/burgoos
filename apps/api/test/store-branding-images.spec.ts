import { describe, expect, it, vi } from "vitest";
import { StoreBrandingService } from "../src/customer-experience/branding/store-branding.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const oldKey = `images/${tenantId}/branding-header/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`;
const newKey = `images/${tenantId}/branding-header/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp`;
const legacy = "data:image/png;base64,AAAA";

function configuration(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    tenantId,
    status: "DRAFT",
    logoUrl: null,
    headerImageUrl: null,
    bodyImageUrl: null,
    footerImageUrl: null,
    primaryColor: "#C92A2A",
    accentColor: "#F59F00",
    neutralTheme: "LIGHT",
    layoutPresetKey: "classic",
    showProductImages: true,
    showProductDescriptions: true,
    orderingEnabled: false,
    publishedAt: null,
    ...overrides,
  };
}

function dto(overrides: Record<string, unknown> = {}) {
  return {
    primaryColor: "#C92A2A",
    accentColor: "#FFFFFF",
    neutralTheme: "LIGHT",
    layoutPreset: "classic",
    logoUrl: null,
    headerImageUrl: null,
    bodyImageUrl: null,
    footerImageUrl: null,
    ...overrides,
  };
}

function setup(rows: { draft?: Record<string, unknown> | null; published?: Record<string, unknown> | null } = {}) {
  const draft = rows.draft === undefined ? configuration({ headerImageUrl: oldKey }) : rows.draft;
  const published = rows.published ?? null;
  const prisma = {
    storeVisualConfiguration: {
      findFirst: vi.fn(async ({ where }: { where: { status: string } }) =>
        where.status === "DRAFT" ? draft : published
      ),
      findMany: vi.fn(async () => [draft, published].filter(Boolean)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => configuration({ ...draft, ...data })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => configuration(data)),
      count: vi.fn(async () => 0),
    },
    layoutPreset: {
      findUnique: vi.fn(async () => ({ key: "classic", active: true })),
      findMany: vi.fn(async () => []),
    },
  };
  const storage = {
    createReadUrl: vi.fn(async (key: string) => `https://signed.example/${key}`),
    delete: vi.fn(async () => undefined),
  };
  const service = new StoreBrandingService(prisma as never, storage as never);
  return { prisma, storage, service };
}

describe("store branding images (spec 030, US4)", () => {
  it("returns signed URLs for bucket keys and the raw key for the form", async () => {
    const { service } = setup({ draft: configuration({ headerImageUrl: oldKey, logoUrl: legacy }) });

    const state = await service.getState(tenantId);

    expect(state.draft).toMatchObject({
      headerImageUrl: `https://signed.example/${oldKey}`,
      headerImageAssetKey: oldKey,
      logoUrl: legacy,
      logoAssetKey: null,
    });
  });

  it("accepts an uploaded key of the store (the admin upload sends keys)", async () => {
    const { prisma, service } = setup();

    const view = await service.saveDraft(tenantId, "user-1", dto({ headerImageUrl: newKey }) as never);

    expect(prisma.storeVisualConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ headerImageUrl: newKey }) })
    );
    expect(view).toMatchObject({ headerImageAssetKey: newKey, headerImageUrl: `https://signed.example/${newKey}` });
  });

  it("refuses new base64 values and keeps the legacy one already stored", async () => {
    const { prisma, service } = setup({
      draft: configuration({ headerImageUrl: null }),
      published: configuration({ id: "pub-1", status: "PUBLISHED", headerImageUrl: legacy }),
    });

    await expect(
      service.saveDraft(tenantId, "user-1", dto({ logoUrl: "data:image/png;base64,BBBB" }) as never)
    ).rejects.toThrow("Envie a imagem pelo upload");

    await service.saveDraft(tenantId, "user-1", dto({ headerImageUrl: legacy }) as never);
    expect(prisma.storeVisualConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ headerImageUrl: legacy }) })
    );
  });

  it("removes the replaced draft image only when no version of the store uses it", async () => {
    const unused = setup();
    await unused.service.saveDraft(tenantId, "user-1", dto({ headerImageUrl: newKey }) as never);
    expect(unused.storage.delete).toHaveBeenCalledWith(oldKey);

    const published = setup();
    published.prisma.storeVisualConfiguration.count.mockResolvedValue(1);
    await published.service.saveDraft(tenantId, "user-1", dto({ headerImageUrl: null }) as never);
    expect(published.storage.delete).not.toHaveBeenCalled();

    const unchanged = setup();
    await unchanged.service.saveDraft(tenantId, "user-1", dto({ headerImageUrl: oldKey }) as never);
    expect(unchanged.storage.delete).not.toHaveBeenCalled();
  });
});
