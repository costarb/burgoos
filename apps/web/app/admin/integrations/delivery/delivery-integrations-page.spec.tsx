import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeliveryIntegrationsPage from "./page";

vi.mock("../../../../lib/api", () => ({
  activateDeliveryIntegration: vi.fn(),
  createDeliveryIntegration: vi.fn(),
  getAdminToken: vi.fn(async () => "access-token"),
  getDeliveryIntegrations: vi.fn(async () => ({
    integrations: [
      {
        id: "integration-1",
        provider: "IFOOD",
        displayName: "iFood",
        status: "DRAFT",
        externalMerchantId: "merchant-1",
        pollingEnabled: true,
        webhookEnabled: false,
        lastSuccessfulPollingAt: null,
        lastErrorMessage: null,
        credentialStatus: "ACTIVE",
        homologationStatus: "PENDING",
        lastValidationAt: null,
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z",
      },
    ],
    orderPlatforms: [
      {
        id: "platform-1",
        name: "iFood",
        feeRate: 0.12,
        paymentFeeRate: 0.03,
        active: true,
      },
    ],
  })),
  pauseDeliveryIntegration: vi.fn(),
  saveDeliveryIntegrationCredentials: vi.fn(),
  updateDeliveryIntegration: vi.fn(),
  validateDeliveryIntegration: vi.fn(),
}));

describe("delivery integrations page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("React", React);
  });

  it("renders iFood configuration and credential actions", async () => {
    const page = await DeliveryIntegrationsPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Delivery");
    expect(html).toContain("Merchant ID iFood");
    expect(html).toContain("Salvar integracao");
    expect(html).toContain("Salvar credenciais");
    expect(html).toContain("Validar");
    expect(html).toContain("Ativar");
    expect(html).toContain("Pausar");
  });
});
