import { DeliveryProvider } from "@prisma/client";
import { DeliveryProviderAdapter, ProviderValidationResult } from "../delivery-provider.adapter";

export class SimulatedDeliveryProviderAdapter implements DeliveryProviderAdapter {
  readonly provider = DeliveryProvider.CUSTOM;
  readonly capabilities = {
    supportsPolling: true,
    supportsWebhook: true,
    supportsMerchantValidation: true,
    supportsOrderConfirmation: true,
    supportsOrderRefusal: true,
    supportedStatusActions: ["DISPATCH", "DELIVER"],
  };

  async validateMerchant(_input: {
    externalMerchantId: string;
    credentialSecret: string;
  }): Promise<ProviderValidationResult> {
    return {
      valid: true,
      merchantStatus: "SIMULATED",
      checks: [{ key: "simulated", status: "PASS", message: "Provider simulado registrado" }],
    };
  }
}
