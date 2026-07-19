import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalesRunSummary } from "./sales-integration-panel";

describe("sales import confirmation", () => {
  it("shows grouped imported, duplicate, rejected and failed outcomes", () => {
    const html = renderToStaticMarkup(<SalesRunSummary busy={false} onConfirm={vi.fn()} run={{ id: "run", provider: "PAGBANK", channel: "API", startDate: "2026-07-01", endDate: "2026-07-01", status: "COMPLETED_WITH_ERRORS", counts: { found: 4, new: 2, duplicate: 1, rejected: 1, imported: 1, failed: 1, blockedDays: 0 }, errorCode: null, errorMessage: null, createdAt: "2026-07-02", completedAt: "2026-07-02" }} />);
    expect(html).toContain("duplicadas 1");
    expect(html).toContain("rejeitadas 1");
    expect(html).toContain("falhas 1");
    expect(html).not.toContain("Confirmar importacao");
  });
});
