import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DomainPublicMenuPage from "./page";

const { headerValues, getPublicMenuByDomain } = vi.hoisted(() => ({
  headerValues: new Map<string, string | null>(),
  getPublicMenuByDomain: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => ({ get: (name: string) => headerValues.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("../../../lib/api", () => ({ getPublicMenuByDomain }));
vi.mock("../[slug]/public-menu-client", () => ({
  PublicMenuClient: ({ menu }: { menu: { tenant: { name: string } } }) => <p>{menu.tenant.name}</p>,
}));

describe("domain public menu page", () => {
  beforeEach(() => {
    headerValues.clear();
    getPublicMenuByDomain.mockReset();
  });

  it("prefers the forwarded host and normalizes www and port", async () => {
    headerValues.set("x-forwarded-host", "www.loja.example.com:443, proxy.internal");
    getPublicMenuByDomain.mockResolvedValue({ tenant: { name: "Loja correta" }, categories: [] });

    const html = renderToStaticMarkup(await DomainPublicMenuPage());
    expect(getPublicMenuByDomain).toHaveBeenCalledWith("loja.example.com");
    expect(html).toContain("Loja correta");
  });

  it("fails closed when the domain has no active store", async () => {
    headerValues.set("host", "unknown.example.com");
    getPublicMenuByDomain.mockResolvedValue(null);
    await expect(DomainPublicMenuPage()).rejects.toThrow("NOT_FOUND");
  });
});
