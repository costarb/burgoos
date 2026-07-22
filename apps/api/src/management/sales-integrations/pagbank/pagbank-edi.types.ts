export interface PagBankEdiMovement {
  movimento_api_codigo?: string;
  estabelecimento?: string;
  data_inicial_transacao?: string;
  hora_inicial_transacao?: string;
  data_venda_ajuste?: string;
  hora_venda_ajuste?: string;
  tipo_evento?: string | number;
  tipo_transacao?: string | number;
  codigo_transacao?: string;
  codigo_venda?: string;
  valor_total_transacao?: number;
  valor_liquido_transacao?: number;
  data_prevista_pagamento?: string;
  taxa_intermediacao?: number;
  tarifa_intermediacao?: number;
  meio_pagamento?: string | number;
  quantidade_parcelas?: string | number;
  parcela?: string | number;
  arranjo_ur?: string;
  [key: string]: unknown;
}

export interface PagBankEdiResponse {
  detalhes: PagBankEdiMovement[];
  pagination: { elements: number; totalPages: number; page: number; totalElements: number };
}

export function isPagBankEdiResponse(value: unknown): value is PagBankEdiResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.detalhes) &&
    Boolean(record.pagination && typeof record.pagination === "object")
  );
}
