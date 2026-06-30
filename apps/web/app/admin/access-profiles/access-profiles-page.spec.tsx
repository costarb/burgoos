import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccessProfilesPage from "./page";

vi.mock("../../../lib/api", () => ({
  createAccessProfile: vi.fn(),
  duplicateAccessProfile: vi.fn(),
  getAccessProfiles: vi.fn(async () => ({
    token: "access-token",
    stores: [{ id: "store-1", name: "Loja Centro", slug: "loja-centro", active: true }],
    permissions: [
      {
        area: "Acessos",
        screens: [
          {
            screen: "Usuarios",
            permissions: [
              {
                key: "access.users.manage",
                area: "Acessos",
                screen: "Usuarios",
                action: "MANAGE",
                description: "Gerenciar usuarios",
                sensitive: true,
              },
            ],
          },
        ],
      },
    ],
    profiles: [
      {
        id: "profile-1",
        name: "Admin local",
        description: "Gerencia acessos da loja",
        scope: "STORE",
        storeId: "store-1",
        status: "ACTIVE",
        permissions: [
          {
            key: "access.users.manage",
            area: "Acessos",
            screen: "Usuarios",
            action: "MANAGE",
            description: "Gerenciar usuarios",
            sensitive: true,
          },
        ],
      },
    ],
  })),
  updateAccessProfile: vi.fn(),
}));

describe("access profiles page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
  });

  it("renders profile list, permission grouping and actions", async () => {
    const page = await AccessProfilesPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Perfis de acesso");
    expect(html).toContain("Novo perfil");
    expect(html).toContain("Admin local");
    expect(html).toContain("Acessos");
    expect(html).toContain("Usuarios");
    expect(html).toContain("access.users.manage");
    expect(html).toContain("sensivel");
    expect(html).toContain("Duplicar");
    expect(html).toContain("Desativar");
  });
});
