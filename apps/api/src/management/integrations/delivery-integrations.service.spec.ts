import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { DeliveryIntegrationsService } from "./delivery-integrations.service";

describe("DeliveryIntegrationsService", () => {
  const dependencies = {
    config: { get: vi.fn() } as unknown as ConfigService,
    ifoodAuth: { exchangeAuthorizationCode: vi.fn() },
    ifoodClient: { validateMerchant: vi.fn() },
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
      dependencies.ifoodClient as never,
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
      dependencies.ifoodClient as never,
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
      dependencies.ifoodClient as never,
      dependencies.audit as never
    );

    await expect(service.getForTenant("tenant-1", "integration-2")).rejects.toThrow(
      NotFoundException
    );
  });
});
