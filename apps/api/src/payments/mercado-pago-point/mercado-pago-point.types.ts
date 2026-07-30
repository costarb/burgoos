export interface MercadoPagoPointTerminal {
  id: string;
  operating_mode?: string;
  store_id?: string | number;
  pos_id?: string | number;
  model?: string;
  serial_number?: string;
  status?: string;
}

export interface MercadoPagoTerminalListResponse {
  data?: {
    terminals?: MercadoPagoPointTerminal[];
  };
  paging?: { total?: number; offset?: number; limit?: number };
}

export interface MercadoPagoPointPayment {
  id?: string;
  amount?: string;
  paid_amount?: string;
  refunded_amount?: string;
  status?: string;
  status_detail?: string;
  payment_method?: {
    id?: string;
    type?: string;
    installments?: number;
  };
  card?: { first_digits?: string; last_digits?: string };
}

export interface MercadoPagoPointOrder {
  id: string;
  type?: string;
  user_id?: string;
  external_reference?: string;
  status?: string;
  status_detail?: string;
  created_date?: string;
  last_updated_date?: string;
  config?: { point?: { terminal_id?: string } };
  transactions?: {
    payments?: MercadoPagoPointPayment[];
    refunds?: Array<{
      id?: string;
      transaction_id?: string;
      amount?: string;
      status?: string;
    }>;
  };
}

export interface CreateMercadoPagoPointOrderInput {
  terminalId: string;
  externalReference: string;
  amount: string;
  description?: string;
  expirationTime?: string;
  paymentMethodType?: string;
  installments?: number;
}

export interface MercadoPagoPointRequest {
  accessToken: string;
  method: "GET" | "POST";
  path: string;
  idempotencyKey?: string;
  body?: unknown;
}
