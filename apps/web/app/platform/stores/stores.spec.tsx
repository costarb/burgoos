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
      active: true,
      isOpen: false,
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

  it("renders store list and onboarding form fields", async () => {
    const page = await StoresPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Lojas");
    expect(html).toContain("Loja Centro");
    expect(html).toContain("loja-centro");
    expect(html).toContain('name="name"');
    expect(html).toContain('name="slug"');
    expect(html).toContain('name="ownerEmail"');
    expect(html).toContain("Criar loja");
  });
});
