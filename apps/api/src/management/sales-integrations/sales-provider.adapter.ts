export type SalesProvider = "PAGBANK" | "MERCADO_PAGO";
export type SalesInputChannel = "API" | "FILE" | "OTHER";
export type ExternalMovementKind = "SALE" | "NON_SALE" | "UNKNOWN";
export interface SalesProviderCapability {
  provider: SalesProvider;
  channels: SalesInputChannel[];
  maxPeriodDays: number;
  supportsPreview: boolean;
  requiredSettings: string[];
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
  paymentMethod: "PIX" | "PIX_MANUAL" | "DEBIT_CARD" | "CREDIT_CARD";
  installments?: number;
  paymentBrand?: string;
  expectedReleaseAt?: string;
  raw: Record<string, unknown>;
}

export type SalesProviderErrorCode =
  | "AUTHENTICATION"
  | "RATE_LIMIT"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "INCOMPATIBLE_RESPONSE";

export class SalesProviderError extends Error {
  constructor(
    readonly code: SalesProviderErrorCode,
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

export interface ProviderMovement {
  providerMovementId: string;
  externalSaleId: string | null;
  externalEventCode: string | null;
  kind: ExternalMovementKind;
  sale: NormalizedHistoricalSale | null;
  raw: Record<string, unknown>;
  rejectionCode?: string;
  rejectionMessage?: string;
}

export interface ProviderDayResult {
  date: string;
  validated: boolean;
  pagesFetched: number;
  totalPages: number;
  totalElements: number;
  movements: ProviderMovement[];
}

export interface ProviderRangeResult {
  startDate: string;
  endDate: string;
  days: ProviderDayResult[];
}

export interface ProviderRangeInput {
  startDate: string;
  endDate: string;
  merchantId: string;
  credential: string;
}

export interface SalesProviderAdapter {
  readonly provider: SalesProvider;
  readonly channel: SalesInputChannel;
  readonly capabilities: SalesProviderCapability;
  fetchRange(input: ProviderRangeInput): Promise<ProviderRangeResult>;
}
