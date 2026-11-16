import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalesIntegrationPanel } from "./sales-integration-panel";

const api = vi.hoisted(() => ({
  listSalesIntegrations: vi.fn(),
  listSalesImportRuns: vi.fn(),
  listSalesProviders: vi.fn(),
  getAdminToken: vi.fn(),
  getAdminCatalog: vi.fn(),
  listProductOptions: vi.fn(),
  listPaymentInstitutions: vi.fn(),
}));

vi.mock("../../../../lib/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const run = (id: string, trigger: "MANUAL" | "AUTOMATIC") => ({
  id,
  provider: "PAGBANK",
  channel: "API",
  startDate: "2026-11-15",
  endDate: "2026-11-15",
  status: "COMPLETED",
  trigger,
  counts: { found: 1, new: 1, duplicate: 0, rejected: 0, imported: 1, failed: 0, blockedDays: 0 },
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-11-15",
  completedAt: "2026-11-15",
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("sales import screen load (spec 030)", () => {
  afterEach(() => vi.clearAllMocks());

  it("page loads product options and institutions, never the full catalog", async () => {
    api.getAdminToken.mockResolvedValue("jwt");
    api.listProductOptions.mockResolvedValue([{ id: "p1", name: "Dogao", price: "22.00", active: true }]);
    api.listPaymentInstitutions.mockResolvedValue([]);
    const { default: Page } = await import("./page");

    await Page();

    expect(api.listProductOptions).toHaveBeenCalledWith("jwt", { active: true });
    expect(api.listPaymentInstitutions).toHaveBeenCalledWith("jwt", { active: "true" });
    expect(api.getAdminCatalog).not.toHaveBeenCalled();
  });

  it("loads the history only when opened, manual runs first, and filters by origin", async () => {
    api.listSalesIntegrations.mockResolvedValue([]);
    api.listSalesProviders.mockResolvedValue([]);
    api.listSalesImportRuns
      .mockResolvedValueOnce({ items: [run("manual-1", "MANUAL")], total: 1 })
      .mockResolvedValueOnce({ items: [run("auto-1", "AUTOMATIC")], total: 1 });
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<SalesIntegrationPanel token="jwt" products={[]} />));
    await flush();

    expect(api.listSalesIntegrations).toHaveBeenCalledTimes(1);
    expect(api.listSalesImportRuns).not.toHaveBeenCalled();

    const details = container.querySelector<HTMLDetailsElement>('[data-testid="sales-import-history"]')!;
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
    await flush();
    expect(api.listSalesImportRuns).toHaveBeenCalledWith("jwt", 1, "MANUAL");
    expect(container.textContent).toContain("2026-11-15");

    const automatic = [...container.querySelectorAll("button")].find((button) => button.textContent === "Automaticas")!;
    await act(async () => automatic.click());
    await flush();
    expect(api.listSalesImportRuns).toHaveBeenLastCalledWith("jwt", 1, "AUTOMATIC");
    expect(container.textContent).toContain("Automatico");
    await act(async () => root.unmount());
  });

  it("switching the provider does not reload integrations, providers or history", async () => {
    api.listSalesIntegrations.mockResolvedValue([]);
    api.listSalesProviders.mockResolvedValue([
      { provider: "PAGBANK", channels: ["API"], maxPeriodDays: 31 },
      { provider: "MERCADO_PAGO", channels: ["API"], maxPeriodDays: 31 },
    ]);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<SalesIntegrationPanel token="jwt" products={[]} />));
    await flush();
    const select = container.querySelector<HTMLSelectElement>("select");
    if (select) {
      await act(async () => {
        select.value = "MERCADO_PAGO";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flush();
    }
    expect(api.listSalesIntegrations).toHaveBeenCalledTimes(1);
    expect(api.listSalesProviders).toHaveBeenCalledTimes(1);
    expect(api.listSalesImportRuns).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
