export type PointProviderErrorCode =
  | "AUTHENTICATION"
  | "TERMINAL_BUSY"
  | "TERMINAL_NOT_OWNED"
  | "ORDER_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE";

export class PointProviderError extends Error {
  constructor(
    public readonly code: PointProviderErrorCode,
    public readonly status: number,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function pointProviderError(status: number, providerCode?: string): PointProviderError {
  if (status === 401) return new PointProviderError("AUTHENTICATION", status, "Mercado Pago recusou a autorizacao");
  if (status === 404) return new PointProviderError("ORDER_NOT_FOUND", status, "Order Point nao encontrada");
  if (status === 409 && providerCode === "already_queued_order_for_terminal") {
    return new PointProviderError("TERMINAL_BUSY", status, "A maquininha ja possui uma cobranca pendente");
  }
  if (status === 409) return new PointProviderError("IDEMPOTENCY_CONFLICT", status, "Conflito de idempotencia no Mercado Pago");
  if (status === 429) return new PointProviderError("RATE_LIMIT", status, "Limite temporario do Mercado Pago", true);
  if (status >= 500) return new PointProviderError("PROVIDER_UNAVAILABLE", status, "Mercado Pago temporariamente indisponivel", true);
  return new PointProviderError("VALIDATION", status, "Mercado Pago rejeitou os dados da cobranca");
}
