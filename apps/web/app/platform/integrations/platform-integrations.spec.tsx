import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoPlatformConfigurationClient } from "./platform-integrations-client";

vi.mock("../../../lib/api", () => ({
  updateMercadoPagoPlatformConfiguration: vi.fn(),
}));

describe("Mercado Pago platform configuration", () => {
  it("shows safe status and write-only secret replacement fields", () => {
    const html = renderToStaticMarkup(
      <MercadoPagoPlatformConfigurationClient
        token="jwt"
        initialValue={{
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
});
