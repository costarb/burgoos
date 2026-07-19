import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SalesImportHistory } from "./sales-integration-panel";

describe("sales import history", () => {
  it("renders empty, status, counts and safe error states", () => {
    expect(renderToStaticMarkup(<SalesImportHistory history={[]} />)).toContain("Nenhuma execucao");
    const html = renderToStaticMarkup(<SalesImportHistory history={[{ id: "run", provider: "PAGBANK", channel: "API", startDate: "2026-07-01", endDate: "2026-07-02", status: "COMPLETED_WITH_ERRORS", counts: { found: 2, new: 2, duplicate: 0, rejected: 0, imported: 1, failed: 1, blockedDays: 0 }, errorCode: "PROCESSING_FAILED", errorMessage: "Falha segura", createdAt: "2026-07-03", completedAt: "2026-07-03" }]} />);
    expect(html).toContain("COMPLETED_WITH_ERRORS");
    expect(html).toContain("1 importadas");
    expect(html).toContain("Falha segura");
  });
});
