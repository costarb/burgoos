import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MercadoPagoPlatformConfigurationClient,
  PlatformIntegrationsClient,
} from "./platform-integrations-client";

vi.mock("../../../lib/api", () => ({
  updateMercadoPagoPlatformConfiguration: vi.fn(),
  updatePagBankPlatformConfiguration: vi.fn(),
}));

describe("Mercado Pago platform configuration", () => {
  it("shows safe status and write-only secret replacement fields", () => {
    const html = renderToStaticMarkup(
      <MercadoPagoPlatformConfigurationClient
        token="jwt"
        initialValue={{
          apiBaseUrl: "https://api.mercadopago.com",
          clientIdConfigured: true,
          clientSecretConfigured: true,
          webhookSecretConfigured: true,
          redirectUri: "https://api.example.test/api/integrations/mercadopago/callback",
          postCallbackUrl: "https://app.example.test/admin/orders/import",
          source: "DATABASE",
          oauthReady: true,
          webhookReady: true,
        }}
      />
    );
    expect(html).toContain("OAuth: configurado");
    expect(html).toContain('type="password"');
    expect(html).not.toContain("client-secret-value");
  });

  it("organizes PagBank and Mercado Pago configuration in tabs", () => {
    const html = renderToStaticMarkup(
      <PlatformIntegrationsClient
        token="jwt"
        pagBank={{
          apiBaseUrl: "https://edi.api.pagbank.com.br",
          ediVersion: "v3.01",
          source: "ENVIRONMENT",
        }}
        mercadoPago={{
          apiBaseUrl: "https://api.mercadopago.com",
          clientIdConfigured: false,
          clientSecretConfigured: false,
          webhookSecretConfigured: false,
          redirectUri: null,
          postCallbackUrl: null,
          source: "ENVIRONMENT",
          oauthReady: false,
          webhookReady: false,
        }}
      />
    );
    expect(html).toContain("PagBank");
    expect(html).toContain("Mercado Pago");
    expect(html).toContain("URL da API de consulta");
    expect(html).toContain("https://edi.api.pagbank.com.br");
    expect(html).toContain("v3.01");
  });
});
