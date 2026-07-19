import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MercadoPagoConnectionPanel } from "./mercado-pago-connection-panel";

vi.mock("../../../../lib/api", () => ({
  createSalesIntegration: vi.fn(),
  startMercadoPagoOAuth: vi.fn(),
  connectMercadoPagoFixedToken: vi.fn(),
  disconnectMercadoPago: vi.fn(),
  syncMercadoPago: vi.fn(),
  getSalesImportRun: vi.fn(),
  listSalesImportMovements: vi.fn(),
}));

describe("MercadoPagoConnectionPanel", () => {
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

  it("defaults to OAuth and offers the 30/60/90 day initial period", () => {
    act(() =>
      root.render(<MercadoPagoConnectionPanel token="jwt" integration={null} onChange={vi.fn()} />)
    );
    const oauth = container.querySelector<HTMLInputElement>('input[type="radio"]')!;
    expect(oauth.checked).toBe(true);
    expect(container.textContent).toContain("30 dias");
    expect(container.textContent).toContain("60 dias");
    expect(container.textContent).toContain("90 dias");
  });

  it("shows a test-only warning and write-only password field for a fixed token", () => {
    act(() => {
      root.render(<MercadoPagoConnectionPanel token="jwt" integration={null} onChange={vi.fn()} />);
    });
    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    act(() => radios[1].dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("Opção temporária para testes");
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Access token da loja"]'
    )!;
    expect(input.type).toBe("password");
    expect(input.autocomplete).toBe("off");
    expect(input.value).toBe("");
  });
  it("shows safe health metadata and replacement action for a fixed token", () => {
    const integration = {
      id: "i",
      provider: "MERCADO_PAGO",
      channel: "API",
      status: "REAUTHORIZATION_REQUIRED",
      publicStatus: "REAUTHORIZATION_REQUIRED",
      displayName: "Mercado Pago",
      externalMerchantId: null,
      settings: {},
      hasCredential: true,
      credentialFingerprint: null,
      credentialMode: "FIXED_TOKEN",
      environment: "PRODUCTION",
      providerUserId: "123456789",
      tokenExpiresAt: null,
      lastSyncAt: "2026-07-18T10:00:00Z",
      lastValidationAt: null,
      lastErrorCode: "FIXED_TOKEN_UNAUTHORIZED",
      lastErrorMessage: "A conexão precisa ser atualizada",
      createdAt: "2026-07-18T00:00:00Z",
      updatedAt: "2026-07-18T00:00:00Z",
    } as const;
    act(() =>
      root.render(
        <MercadoPagoConnectionPanel token="jwt" integration={integration} onChange={vi.fn()} />
      )
    );
    expect(container.textContent).toContain("Conta 123456789");
    expect(container.textContent).toContain("Ambiente: PRODUCTION");
    expect(container.textContent).toContain("Última sincronização");
    expect(container.textContent).toContain("A conexão precisa ser atualizada");
    expect(container.textContent).toContain("Substituir access token");
    expect(container.innerHTML).not.toContain("APP_USR");
  });
});
