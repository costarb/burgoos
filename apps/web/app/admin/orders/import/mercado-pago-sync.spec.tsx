import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoConnectionPanel } from "./mercado-pago-connection-panel";

vi.mock("../../../../lib/api", () => ({
  createSalesIntegration: vi.fn(),
  startMercadoPagoOAuth: vi.fn(),
  connectMercadoPagoFixedToken: vi.fn(),
  confirmSalesImportRun: vi.fn(),
  disconnectMercadoPago: vi.fn(),
  syncMercadoPago: vi.fn(),
  getSalesImportRun: vi.fn(),
  listSalesImportMovements: vi.fn(),
}));

describe("Mercado Pago synchronization UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  it("offers 30/60/90 initial periods and a custom range when connected", () => {
    const integration = {
      id: "integration",
      provider: "MERCADO_PAGO",
      channel: "API",
      status: "ACTIVE",
      publicStatus: "CONNECTED",
      displayName: "Mercado Pago",
      externalMerchantId: null,
      settings: {},
      hasCredential: true,
      credentialFingerprint: null,
      lastValidationAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as const;
    act(() =>
      root.render(
        <MercadoPagoConnectionPanel token="jwt" integration={integration} onChange={vi.fn()} />
      )
    );
    expect(container.textContent).toContain("30 dias");
    expect(container.textContent).toContain("60 dias");
    expect(container.textContent).toContain("90 dias");
    expect(container.querySelector('input[name="startDate"]')).not.toBeNull();
    expect(container.querySelector('input[name="endDate"]')).not.toBeNull();
    expect(container.textContent).toContain("Sincronizar período");
  });
});
