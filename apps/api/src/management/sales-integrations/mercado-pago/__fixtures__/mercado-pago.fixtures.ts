import type {
  MercadoPagoOAuthTokenResponse,
  MercadoPagoOrder,
  MercadoPagoPayment,
  MercadoPagoWebhookPayload,
} from "../mercado-pago.types";

export const FAKE_MERCADO_PAGO_ACCESS_TOKEN = "TEST_ACCESS_TOKEN_NOT_A_REAL_SECRET";
export const FAKE_MERCADO_PAGO_REFRESH_TOKEN = "TEST_REFRESH_TOKEN_NOT_A_REAL_SECRET";

export const mercadoPagoOAuthFixture: MercadoPagoOAuthTokenResponse = {
  access_token: FAKE_MERCADO_PAGO_ACCESS_TOKEN,
  token_type: "Bearer",
  expires_in: 15_552_000,
  scope: "offline_access read payments",
  user_id: 123_456_789,
  refresh_token: FAKE_MERCADO_PAGO_REFRESH_TOKEN,
};

export const mercadoPagoApprovedPaymentFixture: MercadoPagoPayment = {
  id: 987_654_321,
  operation_type: "regular_payment",
  status: "approved",
  status_detail: "accredited",
  date_created: "2026-07-18T12:00:00.000Z",
  date_approved: "2026-07-18T12:00:01.000Z",
  date_last_updated: "2026-07-18T12:00:02.000Z",
  payment_method_id: "pix",
  payment_type_id: "bank_transfer",
  external_reference: "ORDER-TEST-001",
  transaction_amount: 42.5,
  transaction_amount_refunded: 0,
  collector_id: 123_456_789,
  installments: 1,
  transaction_details: { net_received_amount: 41.65, total_paid_amount: 42.5 },
  fee_details: [{ type: "mercadopago_fee", amount: 0.85 }],
};

export const mercadoPagoPointOrderFixture: MercadoPagoOrder = {
  id: "POINT-ORDER-TEST-001",
  status: "processed",
  external_reference: "POINT-TEST-001",
  total_amount: 42.5,
  created_date: "2026-07-18T12:00:00.000Z",
  last_updated_date: "2026-07-18T12:00:02.000Z",
  transactions: { payments: [mercadoPagoApprovedPaymentFixture] },
};

export const mercadoPagoPaymentWebhookFixture: MercadoPagoWebhookPayload = {
  id: "EVENT-TEST-001",
  live_mode: false,
  type: "payment",
  action: "payment.updated",
  user_id: 123_456_789,
  data: { id: mercadoPagoApprovedPaymentFixture.id },
};
