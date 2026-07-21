import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSalesImportMovements, syncMercadoPago } from "../../../../lib/api";
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
  it("shows provider creation and release dates in Sao Paulo time", async () => {
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
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
    } as const;
    vi.mocked(syncMercadoPago).mockResolvedValue({
      id: "run",
      provider: "MERCADO_PAGO",
      channel: "API",
      startDate: "2026-07-18T00:00:00.000Z",
      endDate: "2026-07-18T00:00:00.000Z",
      status: "PREVIEW_READY",
      counts: {
        found: 1,
        new: 1,
        duplicate: 0,
        rejected: 0,
        imported: 0,
        failed: 0,
        blockedDays: 0,
      },
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-07-20T00:00:00.000Z",
      completedAt: "2026-07-20T00:00:01.000Z",
    });
    vi.mocked(listSalesImportMovements).mockResolvedValue({
      items: [
        {
          id: "movement",
          providerMovementId: "169519735292",
          externalSaleId: "169519735292",
          kind: "SALE",
          status: "NEW",
          occurredAt: "2026-07-19T03:00:11.000Z",
          providerCreatedAt: "2026-07-18T22:59:58.000-04:00",
          providerReleaseAt: "2026-07-18T23:00:11.000-04:00",
          grossAmount: "10.00",
          netAmount: "9.90",
          feeAmount: "0.10",
          paymentMethod: "PIX",
          installments: 1,
          rejectionCode: null,
          rejectionMessage: null,
          orderId: null,
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    await act(async () => {
      root.render(
        <MercadoPagoConnectionPanel token="jwt" integration={integration} onChange={vi.fn()} />
      );
    });
    const start = container.querySelector<HTMLInputElement>('input[name="startDate"]')!;
    const end = container.querySelector<HTMLInputElement>('input[name="endDate"]')!;
    start.value = "2026-07-18";
    end.value = "2026-07-18";
    await act(async () => {
      start
        .closest("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain("Data de criação");
    expect(container.textContent).toContain("Data de liberação");
    expect(container.textContent).toContain("18/07/2026, 23:59:58");
    expect(container.textContent).toContain("19/07/2026, 00:00:11");
  });
});
