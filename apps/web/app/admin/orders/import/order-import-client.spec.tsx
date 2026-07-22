import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrderImportClient } from "./order-import-client";
import { SalesIntegrationPanel, SalesImportHistory } from "./sales-integration-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("sales integration accessibility", () => {
  it("separates file and API imports into accessible tabs", () => {
    const html = renderToStaticMarkup(
      <OrderImportClient token="session" products={[]} institutions={[]} />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-controls="file-import-panel"');
    expect(html).toContain('aria-controls="api-import-panel"');
    expect(html).toContain('id="api-import-panel"');
    expect(html).toContain('id="file-import-panel"');
    expect(html).toContain("Arquivo");
    expect(html).toContain("API");
  });

  it("provides labeled keyboard controls, responsive grids and status feedback", () => {
    const html = renderToStaticMarkup(<SalesIntegrationPanel token="session" products={[]} />);
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("USER do estabelecimento");
    expect(html).toContain("TOKEN EDI");
    expect(html).toContain('role="status"');
    expect(html).toContain('type="password"');
  });

  it("has an explicit empty history state", () => {
    expect(renderToStaticMarkup(<SalesImportHistory history={[]} />)).toContain(
      "Nenhuma execucao encontrada"
    );
  });
});
