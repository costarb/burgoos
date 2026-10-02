import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteSkeleton } from "./route-skeleton";

describe("RouteSkeleton", () => {
  it("renders the list variant with repeated rows", () => {
    const html = renderToStaticMarkup(<RouteSkeleton variant="list" />);

    expect(html).toContain('role="presentation"');
    const rowMatches = html.match(/border-b border-slate-100 px-4 py-3/g) ?? [];
    expect(rowMatches.length).toBeGreaterThan(1);
  });

  it("renders the panel variant with metric cards and a chart block", () => {
    const html = renderToStaticMarkup(<RouteSkeleton variant="panel" />);

    const cardMatches = html.match(/rounded-md border border-slate-200 bg-white p-4/g) ?? [];
    expect(cardMatches.length).toBe(4);
    expect(html).toContain("h-64");
  });

  it("renders without external data and hides itself from assistive tech", () => {
    const html = renderToStaticMarkup(<RouteSkeleton variant="list" />);
    expect(html).toContain('aria-hidden="true"');
  });
});
