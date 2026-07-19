import type { PagBankEdiMovement } from "../../../src/management/sales-integrations/pagbank/pagbank-edi.types";

function sale(overrides: Partial<PagBankEdiMovement> = {}): PagBankEdiMovement {
  return {
    movimento_api_codigo: "movement-sale-1",
    data_inicial_transacao: "2026-07-15",
    hora_inicial_transacao: "12:30:00",
    tipo_evento: "1",
    codigo_transacao: "transaction-sale-1",
    valor_total_transacao: 100,
    valor_liquido_transacao: 97,
    taxa_intermediacao: 3,
    meio_pagamento: "1",
    quantidade_parcelas: "1",
    arranjo_ur: "VISA",
    ...overrides,
  };
}

export const PAGBANK_SALE_FIXTURES = {
  credit: sale(),
  installment: sale({ movimento_api_codigo: "movement-installment", codigo_transacao: "transaction-installment", quantidade_parcelas: "3" }),
  pix: sale({ movimento_api_codigo: "movement-pix", codigo_transacao: "transaction-pix", meio_pagamento: "11", arranjo_ur: "PIX" }),
  debit: sale({ movimento_api_codigo: "movement-debit", codigo_transacao: "transaction-debit", meio_pagamento: "3", arranjo_ur: "ELO" }),
  boleto: sale({ movimento_api_codigo: "movement-boleto", codigo_transacao: "transaction-boleto", meio_pagamento: "BOLETO" }),
  split: sale({ movimento_api_codigo: "movement-split", codigo_transacao: "transaction-split" }),
  cancellation: sale({ movimento_api_codigo: "movement-cancel", tipo_evento: "2" }),
  chargeback: sale({ movimento_api_codigo: "movement-chargeback", tipo_evento: "3" }),
};
