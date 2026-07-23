import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StoresPage from "./page";

vi.mock("../../../lib/api", () => ({
  getPlatformAdminToken: vi.fn(async () => "platform-token"),
  listPlatformStores: vi.fn(async () => [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Loja Centro",
      slug: "loja-centro",
      publicDomain: "loja-centro.example.com",
      publicMenuUrl: "https://loja-centro.example.com/cardapio",
      active: true,
      isOpen: false,
      openMode: "FORCE_CLOSED",
      phone: "(11) 99999-9999",
      city: "Sao Paulo",
      state: "SP",
      readiness: {
        ready: true,
        checks: [],
      },
    },
  ]),
  createPlatformStore: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("platform stores page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders store filters, list and maintenance actions", async () => {
    const page = await StoresPage({ searchParams: {} });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Lojas");
    expect(html).toContain("Nova loja");
    expect(html).toContain("Filtrar");
    expect(html).toContain("Loja Centro");
    expect(html).toContain("loja-centro");
    expect(html).toContain("loja-centro.example.com");
    expect(html).toContain("Editar");
    expect(html).toContain("Desativar");
  });
});
