import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BrandingPage from "./page";

vi.mock("../../../lib/api", () => ({
  getAdminToken: vi.fn(async () => "owner-token"),
  getBrandingState: vi.fn(async () => ({
    draft: null,
    published: null,
    availableLayouts: [
      {
        key: "classic",
        name: "Classico",
        description: "Menu familiar com categorias em destaque.",
        active: true,
      },
    ],
  })),
  getBrandingHistory: vi.fn(async () => [
    {
      id: "33333333-3333-4333-8333-333333333333",
      status: "PUBLISHED",
      logoUrl: null,
      headerImageUrl: null,
      bodyImageUrl: null,
      footerImageUrl: null,
      primaryColor: "#C92A2A",
      accentColor: "#F59F00",
      neutralTheme: "LIGHT",
      layoutPreset: "classic",
      publishedAt: "2026-06-01T12:00:00.000Z",
    },
  ]),
  publishBranding: vi.fn(),
  restoreBranding: vi.fn(),
  previewBranding: vi.fn(),
  saveBrandingDraft: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("branding settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders logo and color controls", async () => {
    const page = await BrandingPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Identidade visual");
    expect(html).toContain('name="logoUrl"');
    expect(html).toContain('name="logoUpload"');
    expect(html).toContain('name="headerImageUrl"');
    expect(html).toContain('name="bodyImageUrl"');
    expect(html).toContain('name="footerImageUrl"');
    expect(html).toContain('name="primaryColor"');
    expect(html).toContain('name="accentColor"');
    expect(html).toContain('name="neutralTheme"');
    expect(html).toContain('name="layoutPreset"');
    expect(html).toContain("Classico");
    expect(html).toContain("Previsualizacao");
    expect(html).toContain("Produto exemplo");
    expect(html).toContain("Publicacao");
    expect(html).toContain("Restaurar anterior");
    expect(html).toContain("Salvar rascunho");
  });
});
