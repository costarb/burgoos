import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalesIntegrationPanel } from "./sales-integration-panel";

const api = vi.hoisted(() => ({
  listSalesIntegrations: vi.fn(),
  listSalesImportRuns: vi.fn(),
  listSalesProviders: vi.fn(),
  updateSalesIntegration: vi.fn(),
  saveSalesCredential: vi.fn(),
  setSalesIntegrationStatus: vi.fn(),
}));

vi.mock("../../../../lib/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ...api,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("sales integration settings", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses USER and a write-only password TOKEN with accessible feedback", () => {
    const html = renderToStaticMarkup(<SalesIntegrationPanel token="session" products={[]} />);
    expect(html).toContain("USER do estabelecimento");
    expect(html).toContain('type="password"');
    expect(html).toContain("TOKEN EDI");
    expect(html).toContain('role="status"');
  });

  it("persists a changed USER when the PagBank integration already exists", async () => {
    const integration = {
      id: "integration-id",
      provider: "PAGBANK",
      channel: "API",
      environment: "PRODUCTION",
      credentialMode: "PROVIDER_TOKEN",
      status: "ACTIVE",
      publicStatus: "CONNECTED",
      displayName: "PagBank EDI",
      externalMerchantId: "old-user",
      settings: {},
      hasCredential: true,
      scopes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    api.listSalesIntegrations.mockResolvedValue([integration]);
    api.listSalesImportRuns.mockResolvedValue({ items: [] });
    api.listSalesProviders.mockResolvedValue([]);
    api.updateSalesIntegration.mockResolvedValue({
      ...integration,
      externalMerchantId: "correct-user",
    });
    api.setSalesIntegrationStatus.mockResolvedValue({
      ...integration,
      externalMerchantId: "correct-user",
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<SalesIntegrationPanel token="session" products={[]} />);
      await Promise.resolve();
    });
    const user = container.querySelector<HTMLInputElement>('input[name="merchantId"]');
    const form = user?.closest("form");
    expect(user).not.toBeNull();
    user!.value = "correct-user";
    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(api.updateSalesIntegration).toHaveBeenCalledWith(
      "session",
      "integration-id",
      expect.objectContaining({ externalMerchantId: "correct-user" })
    );
    await act(async () => root.unmount());
  });
});
