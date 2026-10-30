import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MercadoPagoPlatformConfigurationClient,
  PlatformIntegrationsClient,
} from "./platform-integrations-client";

vi.mock("../../../lib/api", () => ({
  updateMercadoPagoPlatformConfiguration: vi.fn(),
  updatePagBankPlatformConfiguration: vi.fn(),
  updateBlingPlatformConfiguration: vi.fn(),
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

  it("shows the Bling redirect URL to register and keeps the secret write-only", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PlatformIntegrationsClient
          bling={{
            clientIdConfigured: true,
            clientSecretConfigured: true,
            clientIdHint: "e02aeb…",
            postCallbackUrl: "https://burgoos-web.onrender.com/admin/fiscal",
            redirectUri: "https://burgoos-api.onrender.com/api/integrations/bling/callback",
            source: "DATABASE",
            oauthReady: true,
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
          pagBank={{ apiBaseUrl: "https://edi.api.pagbank.com.br", ediVersion: "v3.01", source: "ENVIRONMENT" }}
          token="jwt"
        />
      )
    );
    const tab = [...container.querySelectorAll("button")].find((button) => button.textContent === "Bling (NFC-e)") as HTMLButtonElement;
    await act(async () => tab.click());

    expect(container.querySelector("[data-testid='bling-redirect-uri']")?.textContent).toBe(
      "https://burgoos-api.onrender.com/api/integrations/bling/callback"
    );
    expect(container.textContent).toContain("Pronto para conectar lojas.");
    expect((container.querySelector("input[name='clientSecret']") as HTMLInputElement).type).toBe("password");
    act(() => root.unmount());
    container.remove();
  });
});
