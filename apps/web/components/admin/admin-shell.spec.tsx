import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin-shell";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("admin shell", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/admin/orders/import");
  });

  it("renders grouped navigation and current route", () => {
    const html = renderToStaticMarkup(
      <AdminShell>
        <main>Conteudo</main>
      </AdminShell>,
    );

    expect(html).toContain("Operacao");
    expect(html).toContain("Cardapio e custos");
    expect(html).toContain("Financeiro");
    expect(html).toContain("Importar pedidos");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Conteudo");
  });

  it("exposes implemented financial routes only", () => {
    const html = renderToStaticMarkup(
      <AdminShell>
        <main>Conteudo</main>
      </AdminShell>,
    );

    expect(html).toContain("/admin/finance/payables");
    expect(html).toContain("/admin/finance/cash-flow");
  });
});
