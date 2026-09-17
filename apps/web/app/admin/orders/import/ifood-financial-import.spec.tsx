import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IfoodFinancialPanel, IfoodRunSummary } from "./ifood-financial-panel";

const run = (status: string, counts: Record<string, number>) =>
  ({
    id: "run",
    provider: "IFOOD",
    channel: "API",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    status,
    counts: {
      found: 2,
      new: 1,
      duplicate: 1,
      rejected: 0,
      imported: 0,
      failed: 0,
      blockedDays: 0,
      ...counts,
    },
  }) as never;

describe("iFood financial import UI", () => {
  it("requires a consolidated product for an active integration", () => {
    const html = renderToStaticMarkup(
      <IfoodFinancialPanel
        token="token"
        products={[{ id: "product", name: "Venda iFood consolidada" } as never]}
        integration={{ id: "integration", provider: "IFOOD", status: "ACTIVE" } as never}
        onIntegrationChange={vi.fn()}
        onCompleted={vi.fn()}
      />
    );
    expect(html).toContain('name="fixedProductId"');
    expect(html).toContain("required");
    expect(html).toContain("Produto consolidado");
  });

  it("shows enriched and created totals after confirmation", () => {
    const html = renderToStaticMarkup(
      <IfoodRunSummary
        run={run("COMPLETED", { enriched: 1, created: 1, reconciled: 1 })}
        busy={false}
        onConfirm={vi.fn()}
      />
    );
    expect(html).toContain("Enriquecidos 1");
    expect(html).toContain("criados 1");
    expect(html).not.toContain("Confirmar importacao");
  });

  it("warns that repeated historical candidates are consolidated", () => {
    const html = renderToStaticMarkup(
      <IfoodRunSummary
        run={run("PREVIEW_READY", { historicalCandidates: 1 })}
        busy={false}
        onConfirm={vi.fn()}
      />
    );
    expect(html).toContain("unico item consolidado");
    expect(html).toContain("Confirmar importacao");
  });
});
