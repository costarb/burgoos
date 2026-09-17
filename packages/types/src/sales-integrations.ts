export type SalesProvider = "PAGBANK" | "MERCADO_PAGO" | "IFOOD";
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
  deliveryIntegrationId?: string | null;
  financialReadiness?: IfoodFinancialReadinessStatus | null;
}

export interface SalesRunCounts {
  found: number;
  new: number;
  duplicate: number;
  rejected: number;
  imported: number;
  failed: number;
  blockedDays: number;
  existingOrders?: number;
  historicalCandidates?: number;
  reconciled?: number;
  unknown?: number;
  enriched?: number;
  created?: number;
  reviewRequired?: number;
}

export type IfoodFinancialReadinessStatus =
  | "PENDING_PERMISSION"
  | "READY_TEST"
  | "READY_PRODUCTION"
  | "REQUIRES_ATTENTION";

export interface IfoodFinancialReadinessCheck {
  code: string;
  passed: boolean;
  message: string | null;
}

export interface IfoodFinancialReadiness {
  integrationId: string;
  status: IfoodFinancialReadinessStatus;
  environment: SalesIntegrationEnvironment;
  merchantId: string;
  permissions: string[];
  productionEnabled: boolean;
  lastValidatedAt: string | null;
  checks: IfoodFinancialReadinessCheck[];
}

export type FinancialReconciliationStatus =
  | "PENDING"
  | "FETCHING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export type FinancialReconciliationTrigger = "MANUAL" | "DAILY" | "HOMOLOGATION";

export interface FinancialReconciliationRunView {
  id: string;
  status: FinancialReconciliationStatus;
  trigger: FinancialReconciliationTrigger;
  startDate: string;
  endDate: string;
  counts: {
    sales: number;
    events: number;
    settlements: number;
    divergent: number;
  };
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export type ReconciliationFileStatus = "REQUESTED" | "PROCESSING" | "READY" | "EXPIRED" | "FAILED";

export interface ReconciliationFileView {
  requestId: string;
  competence: string;
  status: ReconciliationFileStatus;
  reused: boolean;
  orderCount: number | null;
  lineCount: number | null;
  expiresAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
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
  providerCreatedAt: string | null;
  providerReleaseAt: string | null;
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
  paymentMethod:
    | "CASH"
    | "PIX"
    | "PIX_MANUAL"
    | "CARD_ON_DELIVERY"
    | "DEBIT_CARD"
    | "CREDIT_CARD"
    | "VOUCHER"
    | "DIGITAL_WALLET";
  providerMethod?: string;
  financial?: NormalizedSaleFinancial;
  payments?: NormalizedSalePayment[];
  mappingState?: {
    reviewRequired: boolean;
    unknownPaymentMethods: string[];
  };
  installments?: number;
  paymentBrand?: string;
  expectedReleaseAt?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedSaleFinancial {
  bagAmount: number;
  deliveryFeeAmount: number;
  serviceFeeAmount: number;
  benefitsAmount: number;
  customerPaidAmount: number;
  saleBalanceAmount: number;
  ifoodReceivableAmount: number;
  storeReceivedAmount: number;
}

export interface NormalizedSaleInstallment {
  reference: string;
  sequence: number | null;
  amount: number;
  expectedPaymentDate: string | null;
  status: string | null;
  settledAt: string | null;
}

export interface NormalizedSalePayment {
  providerPaymentKey: string;
  providerMethod: string;
  mappedMethod: NormalizedHistoricalSale["paymentMethod"] | null;
  paymentType: string | null;
  liability: string;
  amount: number;
  currency: string;
  brand: string | null;
  nsuMasked: string | null;
  acquirerDocumentMasked: string | null;
  installments: NormalizedSaleInstallment[];
}
