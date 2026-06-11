import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin-shell";

const usePathname = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ refresh, replace }),
}));

vi.mock("../../lib/auth-client", () => ({
  readAuthSession: vi.fn(() => ({
    accessToken: "access-token",
    accessTokenExpiresAt: "2026-06-10T22:00:00.000Z",
    activeStoreId: "store-1",
    allowedStores: [
      {
        id: "store-1",
        name: "Loja Centro",
        slug: "loja-centro",
        active: true,
      },
    ],
    permissions: [],
    refreshToken: "refresh-token",
    user: {
      id: "user-1",
      email: "admin@burgoos.local",
      login: "admin@burgoos.local",
      name: "Admin",
      status: "ACTIVE",
      isMaster: true,
    },
  })),
  writeAuthSession: vi.fn(),
}));

describe("admin shell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("React", React);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    replace.mockReset();
    refresh.mockReset();
    usePathname.mockReturnValue("/admin/orders/import");
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  async function renderShell() {
    await act(async () => {
      root.render(
        <AdminShell>
          <main>Conteudo</main>
        </AdminShell>
      );
    });

    return container.innerHTML;
  }

  it("renders grouped navigation and current route", async () => {
    const html = await renderShell();

    expect(html).toContain("Operacao");
    expect(html).toContain("Cardapio e custos");
    expect(html).toContain("Financeiro");
    expect(html).toContain("Importar pedidos");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Conteudo");
  });

  it("exposes implemented financial routes only", async () => {
    const html = await renderShell();

    expect(html).toContain("/admin/finance/payables");
    expect(html).toContain("/admin/finance/cash-flow");
  });
});
