import { DeliveryProvider } from "@prisma/client";

export interface ProviderValidationResult {
  valid: boolean;
  merchantStatus: string;
  checks: Array<{
    key: string;
    status: "PASS" | "WARNING" | "FAIL" | "PENDING";
    message: string;
  }>;
}

export interface DeliveryProviderAdapter {
  readonly provider: DeliveryProvider;
  readonly capabilities: DeliveryProviderCapabilities;
  validateMerchant(input: {
    externalMerchantId: string;
    credentialSecret: string;
  }): Promise<ProviderValidationResult>;
}

export interface DeliveryProviderCapabilities {
  supportsPolling: boolean;
  supportsWebhook: boolean;
  supportsMerchantValidation: boolean;
  supportsOrderConfirmation: boolean;
  supportsOrderRefusal: boolean;
  supportedStatusActions: string[];
}
