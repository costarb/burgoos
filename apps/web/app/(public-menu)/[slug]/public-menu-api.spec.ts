import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicMenu } from "../../../lib/api";

const publicMenuPayload = {
  tenant: {
    name: "Loja Piloto",
    slug: "piloto",
    phone: null,
    isOpen: true,
    address: null,
    socialLinks: null,
    branding: {
      logoUrl: null,
      headerImageUrl: null,
      bodyImageUrl: null,
      footerImageUrl: null,
      primaryColor: "#111827",
      accentColor: "#ef4444",
      neutralTheme: "light",
      layoutPreset: "CLASSIC",
      showProductImages: true,
      showProductDescriptions: true,
      orderingEnabled: true,
    },
  },
  categories: [],
};

describe("getPublicMenu", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns null when the public tenant does not exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 }))
    );

    await expect(getPublicMenu("missing")).resolves.toBeNull();
  });

  it("retries transient public menu errors before returning the menu", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("service unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json(publicMenuPayload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicMenu("piloto")).resolves.toMatchObject({
      tenant: {
        slug: "piloto",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("includes the public endpoint status when loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 }))
    );

    await expect(getPublicMenu("piloto")).rejects.toThrow("[401] /api/public/tenants/piloto/menu");
  });
});
