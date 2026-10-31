// Response shapes mirrored in packages/types/src/fiscal.ts (consumed by the web app).
export type FiscalProvider = "BLING";
export type FiscalEnvironment = "HOMOLOGATION" | "PRODUCTION";
export type FiscalEmissionMode = "AUTOMATIC" | "MANUAL";
export type FiscalTaxRegime = "SIMPLES_NACIONAL";
export type FiscalConnectionStatus = "DRAFT" | "CONNECTED" | "ERROR" | "DISCONNECTED";
export type FiscalEligibleSource = "COUNTER" | "IMPORT" | "API";
export type FiscalDocumentStatus =
  | "PENDING"
  | "PROCESSING"
  | "AUTHORIZED"
  | "REJECTED"
  | "ERROR"
  | "CANCEL_PENDING"
  | "CANCELLED"
  | "CANCEL_FAILED";
export type FiscalDocumentTrigger = "AUTOMATIC" | "MANUAL" | "RETROACTIVE";
export type FiscalTargetType = "ORDER" | "TAB";

/** Status shown on orders: the document status, or a derived state when there is none. */
export type OrderFiscalStatus = FiscalDocumentStatus | "NOT_ISSUED" | "NOT_APPLICABLE";

export type FiscalPendingReason =
  | "REJECTED"
  | "ERROR"
  | "CANCEL_MANUAL_REQUIRED"
  | "CANCEL_FAILED"
  | "MISSING_FISCAL_DATA"
  | "PROVIDER_DISCONNECTED"
  | "SAME_DAY_NOT_ISSUED";

export type FiscalReadinessKey =
  | "ISSUER"
  | "ADDRESS"
  | "CONNECTION"
  | "CERTIFICATE"
  | "DEFAULT_PROFILE"
  | "PRODUCTS_WITHOUT_PROFILE"
  | "PAYMENT_MAP"
  | "OPERATION_NATURE";

export interface FiscalProviderCapabilitiesView {
  cancelViaApi: boolean;
  usesOwnCertificate: boolean;
}

export interface FiscalAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
}

export interface FiscalIssuerView {
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration: string;
  taxRegime: FiscalTaxRegime;
  municipalityIbgeCode: string | null;
  municipalityIbgeSource: "IBGE_API" | "MANUAL" | null;
}

export interface FiscalConnectionView {
  provider: FiscalProvider;
  status: FiscalConnectionStatus;
  connectedAt: string | null;
  lastErrorMessage: string | null;
  capabilities: FiscalProviderCapabilitiesView;
}

export interface FiscalCertificateView {
  subjectName: string;
  cnpj: string | null;
  validFrom: string;
  validTo: string;
  daysToExpire: number;
  cnpjMatchesIssuer: boolean | null;
}

export interface FiscalReadinessItem {
  key: FiscalReadinessKey;
  ok: boolean;
  /** Blocking items prevent enabling the fiscal module. */
  blocking: boolean;
  message: string;
}

export interface FiscalReadiness {
  ready: boolean;
  items: FiscalReadinessItem[];
}

export interface FiscalConfigurationView {
  enabled: boolean;
  provider: FiscalProvider | null;
  environment: FiscalEnvironment;
  series: number | null;
  emissionMode: FiscalEmissionMode;
  eligibleSources: FiscalEligibleSource[];
  defaultCancelReason: string;
  issuer: FiscalIssuerView | null;
  address: FiscalAddress;
  missingAddressFields: Array<keyof FiscalAddress>;
  connection: FiscalConnectionView | null;
  certificate: FiscalCertificateView | null;
  readiness: FiscalReadiness;
  updatedAt: string | null;
}

export interface FiscalConfigurationPayload {
  enabled: boolean;
  provider: FiscalProvider | null;
  environment: FiscalEnvironment;
  series: number | null;
  emissionMode: FiscalEmissionMode;
  defaultCancelReason: string;
}

export interface FiscalProfileView {
  id: string;
  name: string;
  ncm: string;
  cfop: string;
  csosn: string;
  origin: number;
  commercialUnit: string;
  cest: string | null;
  benefitCode: string | null;
  active: boolean;
  usage: { categories: number; products: number; complements: number };
}

export interface FiscalProfilePayload {
  name: string;
  ncm: string;
  cfop: string;
  csosn: string;
  origin: number;
  commercialUnit: string;
  cest?: string | null;
  benefitCode?: string | null;
  active?: boolean;
}

export interface FiscalProfileAssignmentsPayload {
  categories?: Array<{ id: string; fiscalProfileId: string | null }>;
  products?: Array<{ id: string; fiscalProfileId: string | null }>;
  complements?: Array<{ id: string; fiscalProfileId: string | null }>;
}

export interface FiscalMissingProfiles {
  products: Array<{ id: string; name: string; categoryName: string }>;
  complements: Array<{ id: string; name: string }>;
}

export interface FiscalDocumentSummary {
  id: string;
  target: { type: FiscalTargetType; id: string; publicCode: string | null };
  status: FiscalDocumentStatus;
  trigger: FiscalDocumentTrigger;
  environment: FiscalEnvironment;
  number: number | null;
  series: number | null;
  accessKey: string | null;
  totalAmount: string;
  saleOccurredAt: string;
  authorizedAt: string | null;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  cancelDeadlineAt: string | null;
  pendingReason: FiscalPendingReason | null;
  providerPanelUrl: string | null;
  createdAt: string;
}

export interface FiscalDocumentEventView {
  type: string;
  code: string | null;
  message: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface FiscalDocumentDetail extends FiscalDocumentSummary {
  consumerDocumentMasked: string | null;
  qrCodeUrl: string | null;
  consultationUrl: string | null;
  hasXml: boolean;
  hasDanfe: boolean;
  cancelReason: string | null;
  cancelledAt: string | null;
  events: FiscalDocumentEventView[];
}

export interface FiscalDocumentPage {
  items: FiscalDocumentSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface FiscalEmissionPayload {
  target: { type: FiscalTargetType; id: string };
  consumerDocument?: string | null;
  confirmRetroactive?: boolean;
}

export interface OrderFiscalInfo {
  status: OrderFiscalStatus;
  documentId: string | null;
  number: number | null;
  accessKey: string | null;
  consultationUrl: string | null;
  pendingReason: FiscalPendingReason | null;
  /** Manual emission allowed now: not issued (or rejected), emission enabled and the sale paid. */
  canEmit: boolean;
  /** Why the emission is not allowed yet (null when allowed or already issued). */
  blockedReason: "NOT_PAID" | "TAB_NOT_PAID" | "DISABLED" | "CANCELLED" | null;
  /** Fiscal unit of the order: itself, or its tab (issued as a whole). */
  target: { type: FiscalTargetType; id: string };
  targetCode: string | null;
}

export interface SalesAutoImportSettings {
  enabled: boolean;
  strategy: "PRICE_WEIGHTED" | "FIXED_PRODUCT";
  fixedProductId: string | null;
}

export interface SalesAutoImportHealth {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  lastErrorCode: string | null;
  lagSeconds: number | null;
  degraded: boolean;
}
