/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoPlatformConfigurationService } from "./mercado-pago-platform-configuration.service";

describe("MercadoPagoPlatformConfigurationService", () => {
  it("uses environment as bootstrap fallback and never returns secrets", async () => {
    const prisma = {
      platformIntegrationConfiguration: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const service = new MercadoPagoPlatformConfigurationService(
      prisma as any,
      {} as any,
      new ConfigService({
        MERCADO_PAGO_CLIENT_ID: "app",
        MERCADO_PAGO_CLIENT_SECRET: "secret",
        MERCADO_PAGO_REDIRECT_URI: "https://example.test/callback",
      })
    );
    const view = await service.safeView();
    expect(view).toMatchObject({ oauthReady: true, source: "ENVIRONMENT" });
    expect(JSON.stringify(view)).not.toContain("secret");
  });

  it("merges write-only replacements into the encrypted database document", async () => {
    const prisma = {
      platformIntegrationConfiguration: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ configurationCiphertext: "stored" })
          .mockResolvedValueOnce({ configurationCiphertext: "saved" }),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
    const secrets = {
      decrypt: vi
        .fn()
        .mockReturnValueOnce(JSON.stringify({ clientId: "old", clientSecret: "kept" }))
        .mockReturnValueOnce(JSON.stringify({ clientId: "new", clientSecret: "kept" })),
      encrypt: vi.fn().mockReturnValue("saved"),
    };
    const service = new MercadoPagoPlatformConfigurationService(
      prisma as any,
      secrets as any,
      new ConfigService()
    );
    await service.update({ clientId: "new" }, "00000000-0000-0000-0000-000000000001");
    expect(secrets.encrypt).toHaveBeenCalledWith(expect.stringContaining('"clientSecret":"kept"'));
    expect(prisma.platformIntegrationConfiguration.upsert).toHaveBeenCalled();
  });
});
