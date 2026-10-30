import type { FiscalEnvironment, FiscalProvider, PaymentMethod } from "@prisma/client";

export interface FiscalProviderCapabilities {
  /** Provider cancels the NFC-e at SEFAZ through its API. When false, cancellation is assisted. */
  cancelViaApi: boolean;
  /** Provider signs with the A1 certificate stored in the ERP (instead of its own account certificate). */
  usesOwnCertificate: boolean;
}

export interface IssuerSnapshot {
  legalName: string;
  tradeName: string | null;
  cnpj: string;
  stateRegistration: string;
  taxRegime: "SIMPLES_NACIONAL";
  address: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    municipalityIbgeCode: string;
  };
}

export interface NfceDraftItem {
  /** ERP code: product id or complement id. */
  code: string;
  description: string;
  /** Decimal strings with 2 (money) or 4 (quantity) places. */
  quantity: string;
  unitPrice: string;
  grossAmount: string;
  discount: string;
  freight: string;
  /** Positive manual price adjustments (NFC-e vOutro). */
  otherExpenses: string;
  ncm: string;
  cfop: string;
  csosn: string;
  origin: number;
  unit: string;
  cest: string | null;
  benefitCode: string | null;
}

export interface NfceDraftPayment {
  method: PaymentMethod;
  /** NFC-e tPag code. */
  tPag: string;
  amount: string;
}

/** Provider-neutral NFC-e built by the composer. */
export interface NfceDraft {
  /** FiscalDocument id; used for idempotency and to find the document after a timeout. */
  reference: string;
  environment: FiscalEnvironment;
  issuer: IssuerSnapshot;
  consumer: { document: string } | null;
  items: NfceDraftItem[];
  payments: NfceDraftPayment[];
  change: string;
  total: string;
  saleOccurredAt: string;
  additionalInfo: string | null;
}

export type ProviderDocumentState =
  | { status: "PROCESSING"; externalId: string }
  | {
      status: "AUTHORIZED";
      externalId: string;
      number: number | null;
      series: number | null;
      accessKey: string | null;
      protocol: string | null;
      authorizedAt: string | null;
      qrCodeUrl: string | null;
      consultationUrl: string | null;
      danfeUrl: string | null;
    }
  | { status: "REJECTED"; externalId: string | null; code: string; message: string }
  | { status: "CANCELLED"; externalId: string; cancelledAt: string | null; protocol: string | null };

export interface ProviderContext {
  tenantId: string;
  environment: FiscalEnvironment;
  /** Decrypted access token (never logged). */
  accessToken: string;
  settings: Record<string, unknown>;
}

export type FiscalProviderErrorCode =
  | "AUTHENTICATION"
  | "RATE_LIMIT"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "VALIDATION"
  | "NOT_SUPPORTED"
  | "INCOMPATIBLE_RESPONSE";

export class FiscalProviderError extends Error {
  constructor(
    readonly code: FiscalProviderErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly providerCode?: string
  ) {
    super(message);
  }
}

export interface FiscalSettingsIssue {
  key: "PAYMENT_MAP" | "OPERATION_NATURE";
  message: string;
}

export interface FiscalProviderAdapter {
  readonly provider: FiscalProvider;
  readonly capabilities: FiscalProviderCapabilities;
  /** Creates the document at the provider without submitting it. Returns its id. */
  create(ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string }>;
  /** Submits a created document to SEFAZ. Safe to retry for the same externalId. */
  submit(ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState>;
  get(ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState>;
  /** Recovers the externalId when `create` timed out before answering. */
  findByReference(ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string } | null>;
  cancel?(ctx: ProviderContext, externalId: string, reason: string): Promise<ProviderDocumentState>;
  downloadXml(
    ctx: ProviderContext,
    externalId: string,
    kind: "AUTHORIZATION" | "CANCELLATION"
  ): Promise<Buffer | null>;
  downloadDanfe(ctx: ProviderContext, externalId: string): Promise<Buffer | null>;
  /** Link to the document in the provider panel, used by assisted cancellation. */
  panelUrl(externalId: string): string | null;
  /** Provider-specific settings still missing on the connection (readiness checklist). */
  validateSettings(settings: Record<string, unknown>): FiscalSettingsIssue[];
}
