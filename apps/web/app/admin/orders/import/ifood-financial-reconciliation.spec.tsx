import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  IfoodReconciliationFileSummary,
  IfoodReconciliationSummary,
} from "./ifood-financial-panel";

describe("iFood financial reconciliation UI", () => {
  it("shows progress, impact divergence and on-demand file download", () => {
    const progress = renderToStaticMarkup(
      <IfoodReconciliationSummary
        items={[
          {
            id: "run",
            status: "COMPLETED",
            trigger: "MANUAL",
            startDate: "2026-09-01",
            endDate: "2026-09-07",
            counts: { sales: 1, events: 2, settlements: 1, divergent: 1 },
            errorCode: null,
            errorMessage: null,
          },
        ]}
      />
    );
    const file = renderToStaticMarkup(
      <IfoodReconciliationFileSummary
        integrationId="integration"
        file={{
          requestId: "file",
          competence: "2026-09",
          status: "READY",
          reused: false,
          orderCount: 1,
          lineCount: 2,
          expiresAt: null,
          errorCode: null,
          errorMessage: null,
        }}
      />
    );
    expect(progress).toContain("Eventos 2");
    expect(progress).toContain("divergências 1");
    expect(progress).toContain("tolerância de R$ 0,01");
    expect(file).toContain("Baixar CSV compactado");
    expect(file).toContain("/reconciliation-files/file/download");
  });
});
