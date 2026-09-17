import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IfoodFinancialPanel, isIfoodPeriodValid } from "./ifood-financial-panel";
import { SalesProviderSelector } from "./sales-provider-selector";

describe("iFood financial preview UI", () => {
  it("offers iFood in the provider selector with its 90-day capability", () => {
    const html = renderToStaticMarkup(
      <SalesProviderSelector
        providers={[
          {
            provider: "IFOOD",
            channels: ["API"],
            maxPeriodDays: 90,
            supportsPreview: true,
            requiredSettings: ["deliveryIntegrationId"],
          },
        ]}
        selectedProvider="IFOOD"
        onChange={() => undefined}
      />
    );
    expect(html).toContain("IFOOD");
    expect(html).toContain("90 dias");
  });

  it("renders accessible period and strategy controls for an active connection", () => {
    const html = renderToStaticMarkup(
      <IfoodFinancialPanel
        token="token"
        products={[{ id: "product-1", name: "Venda iFood" } as never]}
        integration={
          {
            id: "sales-1",
            provider: "IFOOD",
            status: "ACTIVE",
            deliveryIntegrationId: "delivery-1",
          } as never
        }
        onIntegrationChange={() => undefined}
        onCompleted={async () => undefined}
      />
    );
    expect(html).toContain('aria-label="Data inicial iFood"');
    expect(html).toContain('aria-label="Data final iFood"');
    expect(html).toContain('aria-label="Atribuicao iFood"');
    expect(html).toContain("Consultar vendas iFood");
    expect(html).toContain('aria-live="polite"');
  });

  it("validates periods from one through 90 inclusive days", () => {
    expect(isIfoodPeriodValid("2026-01-01", "2026-01-01")).toBe(true);
    expect(isIfoodPeriodValid("2026-01-01", "2026-03-31")).toBe(true);
    expect(isIfoodPeriodValid("2026-01-01", "2026-04-01")).toBe(false);
    expect(isIfoodPeriodValid("2026-02-01", "2026-01-01")).toBe(false);
  });
});
