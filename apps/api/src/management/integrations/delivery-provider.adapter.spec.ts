import { describe, expect, it } from "vitest";
import { SimulatedDeliveryProviderAdapter } from "./testing/simulated-delivery-provider.adapter";

describe("DeliveryProviderAdapter contract", () => {
  it("exposes provider capabilities and normalized merchant validation", async () => {
    const adapter = new SimulatedDeliveryProviderAdapter();

    const result = await adapter.validateMerchant({
      externalMerchantId: "merchant-1",
      credentialSecret: "secret",
    });

    expect(adapter.capabilities.supportsPolling).toBe(true);
    expect(adapter.capabilities.supportedStatusActions).toContain("DELIVER");
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        merchantStatus: "SIMULATED",
        checks: [expect.objectContaining({ status: "PASS" })],
      })
    );
  });
});
