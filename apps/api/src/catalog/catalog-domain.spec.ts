import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service";

describe("CatalogService domain resolution", () => {
  it("resolves www to the canonical active tenant and reuses its menu", async () => {
    const prisma = {
      tenant: {
        findFirst: vi.fn().mockResolvedValue({ slug: "loja-centro" }),
      },
    };
    const service = new CatalogService(prisma as never, {} as never);
    const menu = { tenant: { slug: "loja-centro" }, categories: [] };
    vi.spyOn(service, "getPublicMenu").mockResolvedValue(menu as never);

    await expect(
      service.getPublicMenuByDomain("www.LOJA-CENTRO.com.br", "https://api.example.com")
    ).resolves.toBe(menu);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { publicDomain: "loja-centro.com.br", active: true },
      select: { slug: true },
    });
    expect(service.getPublicMenu).toHaveBeenCalledWith(
      "loja-centro",
      "https://api.example.com"
    );
  });

  it("does not fall back when the domain is unknown or malformed", async () => {
    const prisma = { tenant: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new CatalogService(prisma as never, {} as never);

    await expect(service.getPublicMenuByDomain("unknown.example.com")).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.getPublicMenuByDomain("https://invalid.example.com")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
