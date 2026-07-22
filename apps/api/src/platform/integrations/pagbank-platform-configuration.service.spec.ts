/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { PagBankPlatformConfigurationService } from "./pagbank-platform-configuration.service";

describe("PagBankPlatformConfigurationService", () => {
  it("uses the official URL as fallback", async () => {
    const service = new PagBankPlatformConfigurationService(
      { platformIntegrationConfiguration: { findUnique: vi.fn().mockResolvedValue(null) } } as any,
      {} as any,
      new ConfigService()
    );
    await expect(service.safeView()).resolves.toEqual({
      apiBaseUrl: "https://edi.api.pagbank.com.br",
      source: "ENVIRONMENT",
    });
  });

  it("persists a replacement URL for PagBank", async () => {
    const prisma = {
      platformIntegrationConfiguration: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ configurationCiphertext: "saved" }),
        upsert: vi.fn(),
      },
    };
    const secrets = {
      encrypt: vi.fn().mockReturnValue("saved"),
      decrypt: vi.fn().mockReturnValue('{"apiBaseUrl":"https://pagbank.test"}'),
    };
    const service = new PagBankPlatformConfigurationService(
      prisma as any,
      secrets as any,
      new ConfigService()
    );
    await expect(
      service.update({ apiBaseUrl: "https://pagbank.test" }, "00000000-0000-0000-0000-000000000001")
    ).resolves.toMatchObject({ apiBaseUrl: "https://pagbank.test" });
    expect(prisma.platformIntegrationConfiguration.upsert).toHaveBeenCalled();
  });
});
