import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  CreateMercadoPagoPointOrderInput,
  MercadoPagoPointOrder,
  MercadoPagoPointRequest,
  MercadoPagoPointTerminal,
  MercadoPagoTerminalListResponse,
} from "./mercado-pago-point.types";
import { pointProviderError } from "./point-provider-error";

const BASE_URL = "https://api.mercadopago.com";

@Injectable()
export class MercadoPagoPointClient {
  private readonly transport: (request: MercadoPagoPointRequest) => Promise<unknown>;

  constructor(
    @Optional()
    @Inject("MERCADO_PAGO_POINT_TRANSPORT")
    transport?: (request: MercadoPagoPointRequest) => Promise<unknown>,
  ) {
    this.transport = transport ?? defaultTransport;
  }

  async listTerminals(accessToken: string): Promise<MercadoPagoPointTerminal[]> {
    const terminals: MercadoPagoPointTerminal[] = [];
    const limit = 50;
    for (let offset = 0; ; offset += limit) {
      const response = (await this.transport({
        accessToken,
        method: "GET",
        path: `/terminals/v1/list?limit=${limit}&offset=${offset}`,
      })) as MercadoPagoTerminalListResponse;
      const page = response.data?.terminals ?? [];
      terminals.push(...page);
      const total = response.paging?.total;
      if (page.length < limit || (typeof total === "number" && terminals.length >= total)) break;
    }
    return terminals;
  }

  createOrder(
    accessToken: string,
    input: CreateMercadoPagoPointOrderInput,
    idempotencyKey: string,
  ): Promise<MercadoPagoPointOrder> {
    return this.transport({
      accessToken,
      method: "POST",
      path: "/v1/orders",
      idempotencyKey,
      body: {
        type: "point",
        external_reference: input.externalReference,
        expiration_time: input.expirationTime ?? "PT16M",
        transactions: { payments: [{ amount: input.amount }] },
        config: {
          point: { terminal_id: input.terminalId, print_on_terminal: "no_ticket" },
          ...(input.paymentMethodType
            ? {
                payment_method: {
                  default_type: input.paymentMethodType,
                  ...(input.installments ? { default_installments: input.installments } : {}),
                  installments_cost: "seller",
                },
              }
            : {}),
        },
        ...(input.description ? { description: input.description.slice(0, 160) } : {}),
      },
    }) as Promise<MercadoPagoPointOrder>;
  }

  getOrder(accessToken: string, orderId: string): Promise<MercadoPagoPointOrder> {
    return this.transport({
      accessToken,
      method: "GET",
      path: `/v1/orders/${encodeURIComponent(orderId)}`,
    }) as Promise<MercadoPagoPointOrder>;
  }

  cancelOrder(
    accessToken: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<MercadoPagoPointOrder> {
    return this.transport({
      accessToken,
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(orderId)}/cancel`,
      idempotencyKey,
    }) as Promise<MercadoPagoPointOrder>;
  }

  refundOrder(
    accessToken: string,
    orderId: string,
    idempotencyKey: string,
    amount?: string,
  ): Promise<MercadoPagoPointOrder> {
    return this.transport({
      accessToken,
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(orderId)}/refund`,
      idempotencyKey,
      body: amount ? { transactions: { refunds: [{ amount }] } } : {},
    }) as Promise<MercadoPagoPointOrder>;
  }
}

async function defaultTransport(request: MercadoPagoPointRequest): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${request.path}`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${request.accessToken}`,
      "Content-Type": "application/json",
      ...(request.idempotencyKey ? { "X-Idempotency-Key": request.idempotencyKey } : {}),
    },
    ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string;
      error?: string;
      cause?: Array<{ code?: string }>;
    };
    throw pointProviderError(
      response.status,
      payload.code ?? payload.error ?? payload.cause?.[0]?.code,
    );
  }
  return response.json();
}
