export type MercadoPagoCredentialMode = "OAUTH" | "FIXED_TOKEN";
export type MercadoPagoEnvironment = "TEST" | "PRODUCTION";
export type MercadoPagoResourceType =
  | "payment"
  | "order"
  | "topic_claims_integration_wh"
  | "topic_chargebacks_wh";

export interface MercadoPagoOAuthTokenRequest {
  client_id: string;
  client_secret: string;
  grant_type: "authorization_code" | "refresh_token";
  code?: string;
  redirect_uri?: string;
  code_verifier?: string;
  refresh_token?: string;
}

export interface MercadoPagoOAuthTokenResponse {
  access_token: string;
  token_type: "Bearer" | string;
  expires_in: number;
  scope?: string;
  user_id: number;
  refresh_token?: string;
}

export interface MercadoPagoAccountResponse {
  id: number;
  nickname?: string;
  site_id?: string;
}

export interface MercadoPagoPaging {
  total: number;
  limit: number;
  offset: number;
}

export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail?: string;
  date_created?: string;
  date_approved?: string | null;
  date_last_updated?: string;
  money_release_date?: string | null;
  payment_method_id?: string;
  payment_type_id?: string;
  external_reference?: string | null;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  installments?: number;
  collector_id?: number;
  transaction_details?: {
    net_received_amount?: number;
    total_paid_amount?: number;
  };
  fee_details?: Array<{ type?: string; amount?: number }>;
  metadata?: Record<string, unknown>;
}

export interface MercadoPagoPaymentSearchResponse {
  paging: MercadoPagoPaging;
  results: MercadoPagoPayment[];
}

export interface MercadoPagoOrder {
  id: string;
  status?: string;
  external_reference?: string;
  total_amount?: number;
  created_date?: string;
  last_updated_date?: string;
  transactions?: { payments?: MercadoPagoPayment[] };
}

export interface MercadoPagoWebhookPayload {
  id?: string | number;
  live_mode?: boolean;
  type: MercadoPagoResourceType;
  action?: string;
  user_id?: string | number;
  data: { id: string | number };
}

export interface MercadoPagoWebhookHeaders {
  xSignature: string;
  xRequestId: string;
  dataId: string;
}
