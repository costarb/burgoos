export type DeliveryProvider = "IFOOD" | "CUSTOM";

export type DeliveryIntegrationStatus =
  | "DRAFT"
  | "VALIDATING"
  | "ACTIVE"
  | "PAUSED"
  | "REQUIRES_ATTENTION"
  | "DISABLED";

export type DeliveryCredentialStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "ROTATED"
  | "REQUIRES_REAUTHORIZATION";

export type DeliveryPlatformEventStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "IGNORED"
  | "FAILED"
  | "ACK_PENDING"
  | "ACKED";

export type DeliverySyncAttemptStatus =
  | "PENDING"
  | "SENT"
  | "CONFIRMED"
  | "FAILED"
  | "RETRYABLE"
  | "CANCELLED";

export type DeliveryPlatformOrderAction =
  | "CONFIRM"
  | "REFUSE"
  | "START_PREPARATION"
  | "READY_TO_PICKUP"
  | "DISPATCH"
  | "DELIVER"
  | "REQUEST_CANCELLATION"
  | "RESPOND_DISPUTE";

export type DeliveryPlatformOrderMode = "DELIVERY" | "MERCHANT_DELIVERY" | "TAKEOUT" | "DINE_IN";
export type DeliveryPlatformOrderTiming = "IMMEDIATE" | "SCHEDULED";

export interface DeliveryProviderCapabilities {
  supportsPolling: boolean;
  supportsWebhook: boolean;
  supportsMerchantValidation: boolean;
  supportsOrderConfirmation: boolean;
  supportsOrderRefusal: boolean;
  supportedStatusActions: DeliveryPlatformOrderAction[];
}

export interface DeliveryIntegrationSummary {
  id: string;
  provider: DeliveryProvider;
  displayName: string;
  status: DeliveryIntegrationStatus;
  externalMerchantId: string | null;
  pollingEnabled: boolean;
  webhookEnabled: boolean;
  lastSuccessfulPollingAt: string | null;
  lastErrorMessage: string | null;
}

export interface DeliveryIntegrationDetail extends DeliveryIntegrationSummary {
  credentialStatus: DeliveryCredentialStatus | null;
  homologationStatus: string;
  lastValidationAt: string | null;
  createdAt: string;
  updatedAt: string;
  capabilities: DeliveryProviderCapabilities;
}

export interface DeliveryIntegrationHealth {
  integrationId: string;
  status: DeliveryIntegrationStatus;
  merchantStatus: string;
  lastSuccessfulPollingAt: string | null;
  polling?: {
    schedulerEnabled: boolean;
    enabled: boolean;
    ready: boolean;
    status:
      | "READY"
      | "SCHEDULER_DISABLED"
      | "INTEGRATION_NOT_ACTIVE"
      | "POLLING_DISABLED"
      | "MISSING_CREDENTIALS"
      | "MISSING_MERCHANT";
    intervalSeconds: number;
    lastSuccessfulPollingAt: string | null;
    nextExpectedPollingAt: string | null;
  };
  pendingEvents: number;
  failedEvents: number;
  retryableSyncs: number;
  pendingDisputes: number;
  pendingExceptions: number;
  tokenExpiresAt: string | null;
  tokenExpiresInMinutes: number | null;
  tokenRequiresAttention: boolean;
  recentAudits: Array<{
    id: string;
    action: string;
    entityType: string;
    result: string;
    createdAt: string;
  }>;
  homologationChecks: Array<{
    key: string;
    passed: boolean;
    message: string | null;
  }>;
}
