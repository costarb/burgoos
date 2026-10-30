import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SalesIntegrationView } from "@rrfive/types";
import { SalesAutoImportCard } from "./sales-auto-import-card";

const updateSalesAutoImport = vi.fn();
vi.mock("../../../../lib/api", () => ({ updateSalesAutoImport: (...args: unknown[]) => updateSalesAutoImport(...args) }));

describe("SalesAutoImportCard", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChange = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    updateSalesAutoImport.mockReset();
    onChange.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const integration = (overrides: Partial<SalesIntegrationView> = {}): SalesIntegrationView =>
    ({
      id: "int-1",
      provider: "MERCADO_PAGO",
      channel: "API",
      status: "ACTIVE",
      displayName: "Mercado Pago",
      externalMerchantId: null,
      settings: {},
      hasCredential: true,
      credentialFingerprint: null,
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: "",
      updatedAt: "",
      autoImport: { enabled: false, strategy: "PRICE_WEIGHTED", fixedProductId: null },
      autoImportHealth: { lastSuccessAt: null, lastAttemptAt: null, consecutiveFailures: 0, lastErrorCode: null, lagSeconds: null, degraded: false },
      ...overrides,
    }) as SalesIntegrationView;

  async function render(value: SalesIntegrationView) {
    await act(async () =>
      root.render(
        <SalesAutoImportCard integration={value} onChange={onChange} products={[{ id: "prod-1", name: "Hot Dog" } as never]} token="jwt" />
      )
    );
  }

  const button = (label: string) =>
    [...container.querySelectorAll("button")].find((element) => element.textContent === label) as HTMLButtonElement;

  it("turns on the automatic import with a fixed product", async () => {
    const enabled = integration({ autoImport: { enabled: true, strategy: "FIXED_PRODUCT", fixedProductId: "prod-1" } });
    updateSalesAutoImport.mockResolvedValue(enabled);
    await render(integration());
    expect(container.querySelector("[data-testid='sales-auto-import-status']")?.textContent).toBe("Desligada");

    await act(async () => {
      const select = container.querySelector("select") as HTMLSelectElement;
      select.value = "FIXED_PRODUCT";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(button("Ligar importacao automatica").disabled).toBe(true);
    await act(async () => {
      const product = container.querySelector("select[aria-label='Produto fixo da importacao automatica']") as HTMLSelectElement;
      product.value = "prod-1";
      product.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => button("Ligar importacao automatica").click());

    expect(updateSalesAutoImport).toHaveBeenCalledWith("jwt", "int-1", { enabled: true, strategy: "FIXED_PRODUCT", fixedProductId: "prod-1" });
    expect(onChange).toHaveBeenCalledWith(enabled);
  });

  it("shows degraded health with failures and lag", async () => {
    await render(
      integration({
        autoImport: { enabled: true, strategy: "PRICE_WEIGHTED", fixedProductId: null },
        autoImportHealth: {
          lastSuccessAt: "2026-10-30T15:00:00.000Z",
          lastAttemptAt: "2026-10-30T15:06:00.000Z",
          consecutiveFailures: 3,
          lastErrorCode: "AUTHENTICATION",
          lagSeconds: 1200,
          degraded: true,
        },
      })
    );

    expect(container.querySelector("[data-testid='sales-auto-import-status']")?.textContent).toBe("Com falhas");
    const health = container.querySelector("[data-testid='sales-auto-import-health']")?.textContent ?? "";
    expect(health).toContain("20 min");
    expect(health).toContain("3 (AUTHENTICATION)");
  });
});
