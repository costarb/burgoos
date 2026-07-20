export type SalesProvider = "PAGBANK" | "MERCADO_PAGO";
export type SalesInputChannel = "API" | "FILE" | "OTHER";
export type SalesIntegrationEnvironment = "TEST" | "PRODUCTION";
export type SalesCredentialMode = "PROVIDER_TOKEN" | "OAUTH" | "FIXED_TOKEN";
export type SalesIntegrationStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "REQUIRES_ATTENTION"
  | "DISABLED"
  | "PENDING_AUTHORIZATION"
  | "TOKEN_EXPIRING"
  | "REFRESHING"
  | "REAUTHORIZATION_REQUIRED"
  | "ERROR";
export type MercadoPagoConnectionStatus =
  | "PENDING_AUTHORIZATION"
  | "CONNECTED"
  | "TOKEN_EXPIRING"
  | "REFRESHING"
  | "REAUTHORIZATION_REQUIRED"
  | "ERROR"
  | "DISCONNECTED";
export type SalesRunTrigger =
  | "MANUAL"
  | "INITIAL_LOAD"
  | "WEBHOOK"
  | "RECONCILIATION_SHORT"
  | "RECONCILIATION_DAILY";
export type SalesImportRunStatus =
  | "PENDING"
  | "FETCHING"
  | "PREVIEW_READY"
  | "PARTIALLY_READY"
  | "IMPORTING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED";
export type SalesImportDayStatus =
  | "PENDING"
  | "FETCHING"
  | "READY"
  | "BLOCKED_NOT_VALIDATED"
  | "BLOCKED_DATE"
  | "FAILED";
export type ExternalMovementKind = "SALE" | "NON_SALE" | "UNKNOWN";
export type ExternalMovementStatus =
  | "NEW"
  | "DUPLICATE"
  | "REJECTED"
  | "IMPORTING"
  | "IMPORTED"
  | "FAILED";

export interface SalesProviderCapability {
  provider: SalesProvider;
  channels: SalesInputChannel[];
  maxPeriodDays: number;
  supportsPreview: boolean;
  requiredSettings: string[];
  credentialModes?: SalesCredentialMode[];
  supportsWebhooks?: boolean;
  supportsReconciliation?: boolean;
}

export interface SalesIntegrationView {
  id: string;
  provider: SalesProvider;
  channel: SalesInputChannel;
  status: SalesIntegrationStatus;
  publicStatus?: MercadoPagoConnectionStatus;
  displayName: string;
  externalMerchantId: string | null;
  settings: Record<string, unknown>;
  hasCredential: boolean;
  credentialFingerprint: string | null;
  environment?: SalesIntegrationEnvironment;
  credentialMode?: SalesCredentialMode;
  providerUserId?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[];
  connectedAt?: string | null;
  lastSyncAt?: string | null;
  disconnectedAt?: string | null;
  lastValidationAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesRunCounts {
  found: number;
  new: number;
  duplicate: number;
  rejected: number;
  imported: number;
  failed: number;
  blockedDays: number;
}

export interface SalesImportDayView {
  date: string;
  status: SalesImportDayStatus;
  validated: boolean | null;
  pagesFetched: number;
  totalPages: number | null;
  totalElements: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SalesImportRunView {
  id: string;
  provider: SalesProvider;
  channel: SalesInputChannel;
  startDate: string;
  endDate: string;
  status: SalesImportRunStatus;
  trigger?: SalesRunTrigger;
  counts: SalesRunCounts;
  days?: SalesImportDayView[];
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MercadoPagoConnectionView {
  id: string;
  provider: "MERCADO_PAGO";
  environment: SalesIntegrationEnvironment;
  credentialMode: "OAUTH" | "FIXED_TOKEN";
  status: MercadoPagoConnectionStatus;
  providerUserId: string | null;
  hasCredential: boolean;
  tokenExpiresAt: string | null;
  scopes: string[];
  connectedAt: string | null;
  lastSyncAt: string | null;
  disconnectedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export type MercadoPagoCredentialModeInput =
  | { mode: "OAUTH" }
  | { mode: "FIXED_TOKEN"; accessToken: string };

export interface StartMercadoPagoOAuthInput {
  initialLoadDays?: 30 | 60 | 90;
}

export interface StartMercadoPagoOAuthResult {
  authorizationUrl: string;
  expiresAt: string;
}

export interface SalesMovementView {
  id: string;
  providerMovementId: string;
  externalSaleId: string | null;
  kind: ExternalMovementKind;
  status: ExternalMovementStatus;
  occurredAt: string | null;
  grossAmount: string | null;
  netAmount: string | null;
  feeAmount: string | null;
  paymentMethod: string | null;
  installments: number | null;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  orderId: string | null;
}

export interface NormalizedHistoricalSale {
  provider: SalesProvider;
  channel: SalesInputChannel;
  providerMovementId: string;
  externalSaleId: string;
  externalEventCode?: string;
  occurredAt: string;
  grossAmount: number;
  netAmount?: number;
  feeAmount?: number;
  paymentMethod: "PIX" | "PIX_MANUAL" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET";
  installments?: number;
  paymentBrand?: string;
  expectedReleaseAt?: string;
  raw: Record<string, unknown>;
}
