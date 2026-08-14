# Data Model: Classificação de pagamentos Mercado Pago

Nenhuma migração de banco é necessária. A feature amplia o contrato externo em memória e reutiliza entidades persistidas existentes.

## MercadoPagoPayment

Campo novo no contrato local:

- `operation_type?: string`: natureza operacional informada pelo provedor. É opcional na desserialização para que payloads incompatíveis sejam classificados com segurança em vez de derrubar o worker.

Campos relevantes existentes: `id`, `status`, `date_created`, `money_release_date`, `payment_method_id`, `payment_type_id`, `transaction_amount`, taxas e valor líquido.

## ProviderMovement

Representa a decisão normalizada já usada pelo pipeline.

- Venda elegível: `kind=SALE`, `sale` preenchida.
- Operação não comercial: `kind=NON_SALE`, `sale=null`, `rejectionCode=NON_SALE_OPERATION`.
- Pagamento não aprovado: `kind=NON_SALE`, `sale=null`.
- Operação comercial inválida: `kind=SALE`, `sale=null`, `rejectionCode=INVALID_SALE`, preservando a semântica atual de erro de dados comerciais.

## Regras de validação

| operation_type            | status       | valor/data/meio | Resultado                     |
| ------------------------- | ------------ | --------------- | ----------------------------- |
| `regular_payment`         | approved     | válidos         | SALE                          |
| `pos_payment`             | approved     | válidos         | SALE                          |
| `recurring_payment`       | approved     | válidos         | SALE                          |
| comercial permitido       | não approved | qualquer        | NON_SALE                      |
| `money_transfer` ou outro | qualquer     | qualquer        | NON_SALE / NON_SALE_OPERATION |
| ausente/desconhecido      | qualquer     | qualquer        | NON_SALE / NON_SALE_OPERATION |
| comercial permitido       | approved     | inválidos       | SALE rejeitada / INVALID_SALE |

## Relationships and persistence

`ProviderMovement` continua sendo persistido pelo preview/estado de transação existente. Somente movimentos com `sale` válida podem avançar para confirmação e pedido. O identificador do pagamento mantém idempotência entre sync, reconciliação e webhook.
