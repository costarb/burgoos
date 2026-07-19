import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SalesIntegrationPanel, SalesImportHistory } from "./sales-integration-panel";

describe("sales integration accessibility", () => {
  it("provides labeled keyboard controls, responsive grids and status feedback", () => {
    const html = renderToStaticMarkup(<SalesIntegrationPanel token="session" products={[]} />);
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("USER do estabelecimento");
    expect(html).toContain("TOKEN EDI");
    expect(html).toContain('role="status"');
    expect(html).toContain('type="password"');
  });

  it("has an explicit empty history state", () => {
    expect(renderToStaticMarkup(<SalesImportHistory history={[]} />)).toContain("Nenhuma execucao encontrada");
  });
});
