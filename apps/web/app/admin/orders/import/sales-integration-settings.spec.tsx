import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SalesIntegrationPanel } from "./sales-integration-panel";

describe("sales integration settings", () => {
  it("uses USER and a write-only password TOKEN with accessible feedback", () => {
    const html = renderToStaticMarkup(<SalesIntegrationPanel token="session" products={[]} />);
    expect(html).toContain("USER do estabelecimento");
    expect(html).toContain('type="password"');
    expect(html).toContain("TOKEN EDI");
    expect(html).toContain('role="status"');
  });
});
