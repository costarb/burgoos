import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalesRunSummary } from "./sales-integration-panel";

const run = { id: "run", provider: "PAGBANK", channel: "API", startDate: "2026-07-01", endDate: "2026-07-02", status: "PARTIALLY_READY", counts: { found: 3, new: 1, duplicate: 1, rejected: 1, imported: 0, failed: 0, blockedDays: 1 }, days: [{ date: "2026-07-02", status: "BLOCKED_NOT_VALIDATED", validated: false, pagesFetched: 1, totalPages: 1, totalElements: 0, errorCode: null, errorMessage: "Dados ainda incompletos" }], errorCode: null, errorMessage: null, createdAt: "2026-07-03", completedAt: "2026-07-03" };

describe("sales import preview", () => {
  it("shows consolidated counts and daily integrity before confirmation", () => {
    const html = renderToStaticMarkup(<SalesRunSummary run={run as never} busy={false} onConfirm={vi.fn()} />);
    expect(html).toContain("PARTIALLY_READY");
    expect(html).toContain("novas 1");
    expect(html).toContain("BLOCKED_NOT_VALIDATED");
    expect(html).toContain("Confirmar importacao");
  });
});
