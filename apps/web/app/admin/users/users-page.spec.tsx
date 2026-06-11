import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./page";

vi.mock("../../../lib/api", () => ({
  createAccessUser: vi.fn(),
  getAccessUsers: vi.fn(async () => ({
    token: "access-token",
    options: {
      stores: [{ id: "store-1", name: "Loja Centro", slug: "loja-centro", active: true }],
      profiles: [
        {
          id: "profile-1",
          name: "Operador",
          scope: "STORE",
          storeId: "store-1",
          status: "ACTIVE",
        },
      ],
    },
    users: [
      {
        id: "user-1",
        login: "ana@example.com",
        name: "Ana",
        email: "ana@example.com",
        phone: null,
        status: "ACTIVE",
        isMaster: false,
        lastLoginAt: null,
        assignments: [
          {
            store: { id: "store-1", name: "Loja Centro", slug: "loja-centro", active: true },
            profile: {
              id: "profile-1",
              name: "Operador",
              scope: "STORE",
              storeId: "store-1",
              status: "ACTIVE",
            },
            canManageStoreAccess: false,
            status: "ACTIVE",
          },
        ],
      },
    ],
  })),
  updateAccessUser: vi.fn(),
}));

vi.mock("../../../lib/auth-client", () => ({
  readAuthSession: vi.fn(() => null),
}));

describe("users page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
  });

  it("renders user maintenance form, filters and listed assignments", async () => {
    const page = await UsersPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Usuarios");
    expect(html).toContain("Novo usuario");
    expect(html).toContain("Buscar usuario");
    expect(html).toContain("Ana");
    expect(html).toContain("Loja Centro / Operador");
    expect(html).toContain("Criar usuario");
    expect(html).toContain("Salvar usuario");
  });
});
