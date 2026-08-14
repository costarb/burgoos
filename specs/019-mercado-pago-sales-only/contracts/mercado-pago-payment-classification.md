# Contract: Mercado Pago payment classification

## Input

Um pagamento desserializado de `/v1/payments/search` ou `/v1/payments/{id}`.

## Commercial allowlist

- `regular_payment`
- `pos_payment`
- `recurring_payment`

## Output invariants

1. Somente um tipo na allowlist pode produzir `kind: SALE` com `sale` preenchida.
2. Tipo ausente ou fora da allowlist produz `kind: NON_SALE`, `sale: null` e `rejectionCode: NON_SALE_OPERATION`.
3. `status !== approved` produz `kind: NON_SALE` e nunca cria pedido.
4. Venda aprovada ainda exige valor positivo, data e meio suportado.
5. O payload redigido mantém `operation_type`, mas remove dados sensíveis já removidos atualmente.
6. `is_same_bank_account_owner=true`, em qualquer localização suportada do payload, sempre produz `NON_SALE`, mesmo para `regular_payment`.

## Search request

Toda chamada de busca inclui `status=approved`. A classificação local continua soberana; o filtro remoto é apenas redução de volume.

## Compatibility policy

Novos valores de `operation_type` não são automaticamente considerados venda. A allowlist somente pode crescer após validação documental e novo teste de contrato.
