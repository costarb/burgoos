import { describe, expect, it, vi } from "vitest";
import { DeliveryIntegrationsController } from "./delivery-integrations.controller";

describe("DeliveryIntegrationsController", () => {
  const user = { id: "user-1", tenantId: "tenant-1" } as never;

  it("creates integration using active tenant and actor", async () => {
    const service = { create: vi.fn(async () => ({ id: "integration-1" })) };
    const controller = new DeliveryIntegrationsController(service as never, {} as never);

    await controller.create(user, {
      provider: "IFOOD",
      displayName: "iFood",
      externalMerchantId: "merchant-1",
      orderPlatformId: "platform-1",
    } as never);

    expect(service.create).toHaveBeenCalledWith(
      "tenant-1",
      "user-1",
      expect.objectContaining({ provider: "IFOOD" })
    );
  });

  it("validates integration using active tenant and actor", async () => {
    const service = { validate: vi.fn(async () => ({ valid: true })) };
    const controller = new DeliveryIntegrationsController(service as never, {} as never);

    await controller.validate(user, "integration-1");

    expect(service.validate).toHaveBeenCalledWith("tenant-1", "user-1", "integration-1");
  });

  it("pauses integration using active tenant and actor", async () => {
    const service = { pause: vi.fn(async () => ({ status: "PAUSED" })) };
    const controller = new DeliveryIntegrationsController(service as never, {} as never);

    await controller.pause(user, "integration-1");

    expect(service.pause).toHaveBeenCalledWith("tenant-1", "user-1", "integration-1");
  });
});
