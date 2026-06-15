import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";

describe("DeliveryIntegrationsService", () => {
  const dependencies = {
    config: { get: vi.fn() } as unknown as ConfigService,
    ifoodAuth: { exchangeAuthorizationCode: vi.fn() },
    providerRegistry: {
      get: vi.fn(() => ({
        capabilities: { supportsPolling: true },
        validateMerchant: vi.fn(),
      })),
    },
    audit: { record: vi.fn() },
  };

  it("lists integrations scoped to the active tenant", async () => {
    const findMany = vi.fn(async () => []);
    const service = new DeliveryIntegrationsService(
      {
        deliveryIntegration: { findMany },
      } as never,
      dependencies.config,
      dependencies.ifoodAuth as never,
      dependencies.providerRegistry as never,
      dependencies.audit as never
    );

    await service.list("tenant-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
      })
    );
  });

  it("gets integration only inside the active tenant", async () => {
    const findFirst = vi.fn(async () => ({ id: "integration-1" }));
    const service = new DeliveryIntegrationsService(
      {
        deliveryIntegration: { findFirst },
      } as never,
      dependencies.config,
      dependencies.ifoodAuth as never,
      dependencies.providerRegistry as never,
      dependencies.audit as never
    );

    await service.getForTenant("tenant-1", "integration-1");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "integration-1", tenantId: "tenant-1" },
      })
    );
  });

  it("rejects access when integration is outside the active tenant", async () => {
    const service = new DeliveryIntegrationsService(
      {
        deliveryIntegration: { findFirst: vi.fn(async () => null) },
      } as never,
      dependencies.config,
      dependencies.ifoodAuth as never,
      dependencies.providerRegistry as never,
      dependencies.audit as never
    );

    await expect(service.getForTenant("tenant-1", "integration-2")).rejects.toThrow(
      NotFoundException
    );
  });

  it("validates providers through the adapter registry", async () => {
    const validateMerchant = vi.fn(async () => ({
      valid: true,
      merchantStatus: "OK",
      checks: [],
    }));
    const service = new DeliveryIntegrationsService(
      {
        deliveryIntegration: {
          findFirst: vi.fn(async () => ({
            id: "integration-1",
            tenantId: "tenant-1",
            provider: "IFOOD",
            externalMerchantId: "merchant-1",
            credentials: [{ secretCiphertext: "invalid-for-this-test" }],
          })),
          update: vi.fn(async () => ({
            status: "DRAFT",
            credentials: [],
          })),
        },
      } as never,
      dependencies.config,
      dependencies.ifoodAuth as never,
      {
        get: vi.fn(() => ({
          capabilities: { supportsPolling: true },
          validateMerchant,
        })),
      } as never,
      dependencies.audit as never
    );

    vi.spyOn(service as never, "decryptSecret").mockReturnValue(
      JSON.stringify({ accessToken: "token" }) as never
    );

    await service.validate("tenant-1", "user-1", "integration-1");

    expect(validateMerchant).toHaveBeenCalledWith({
      externalMerchantId: "merchant-1",
      credentialSecret: "token",
    });
  });

  it("returns provider capabilities from registry with integration detail", async () => {
    const capabilities = {
      supportsPolling: true,
      supportsWebhook: true,
      supportsMerchantValidation: true,
      supportsOrderConfirmation: true,
      supportsOrderRefusal: true,
      supportedStatusActions: ["DISPATCH", "DELIVER"],
    };
    const service = new DeliveryIntegrationsService(
      {
        deliveryIntegration: {
          findFirst: vi.fn(async () => ({
            id: "integration-1",
            provider: "IFOOD",
            displayName: "iFood",
            status: "ACTIVE",
            externalMerchantId: "merchant-1",
            pollingEnabled: true,
            webhookEnabled: false,
            lastSuccessfulPollingAt: null,
            lastErrorMessage: null,
            lastValidationAt: null,
            homologationStatus: "PENDING",
            createdAt: new Date("2026-06-15T12:00:00.000Z"),
            updatedAt: new Date("2026-06-15T12:00:00.000Z"),
            credentials: [],
          })),
        },
      } as never,
      dependencies.config,
      dependencies.ifoodAuth as never,
      { get: vi.fn(() => ({ capabilities })) } as never,
      dependencies.audit as never
    );

    await expect(service.getDetail("tenant-1", "integration-1")).resolves.toEqual(
      expect.objectContaining({ capabilities })
    );
  });
});
