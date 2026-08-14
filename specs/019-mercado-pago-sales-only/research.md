# Research: Importação exclusiva de vendas do Mercado Pago

## Decision 1 - Usar `operation_type` como origem da operação

**Decision**: Classificar como venda somente `regular_payment`, `pos_payment` e `recurring_payment`.

**Rationale**: A documentação oficial define `operation_type` como filtro e campo do pagamento, com esses três valores como operações de pagamento. Também distingue `regular_payment` de `money_transfer`, descrito como solicitação de dinheiro. Isso separa a natureza da operação do meio usado para pagá-la.

**Alternatives considered**:

- Usar apenas `status=approved`: rejeitado porque movimentos não comerciais também podem estar concluídos/aprovados.
- Exigir `external_reference`, `order` ou itens: rejeitado porque vendas externas, Point e recorrências podem não compartilhar esses metadados.
- Excluir apenas uma lista de tipos financeiros: rejeitado porque tipos novos seriam importados indevidamente; a regra de negócio exige fail-closed.

**Sources**:

- [Gestão de pagamentos recebidos](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/payment-management)
- [Criar preferência - tipos de operação](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/preferences/create-preference/post)

## Decision 2 - Filtrar status remotamente e origem localmente

**Decision**: Enviar `status=approved` na busca e validar `operation_type` no mapper compartilhado.

**Rationale**: O endpoint de busca suporta filtro por status e tipo operacional. Filtrar status reduz tráfego; validar localmente permanece obrigatório para `getPayment` acionado por webhook, para reconciliação e contra respostas inesperadas. Fazer uma busca por cada tipo comercial triplicaria chamadas e complexidade de paginação.

**Alternatives considered**:

- Três buscas remotas, uma por tipo: rejeitado por custo, rate limit e deduplicação extra.
- Apenas filtro remoto: rejeitado porque webhook busca pagamento individual e porque fronteiras externas precisam de validação defensiva.

**Source**: [Payment Search API](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/search-payments/get)

## Decision 3 - Não confundir meio de pagamento com natureza da operação

**Decision**: Manter cartão, PIX e `account_money` elegíveis quando `operation_type` for comercial.

**Rationale**: A documentação lista `account_money`, `bank_transfer`/PIX, cartões e outros como meios de pagamento. Um PIX ou saldo da carteira pode pagar uma venda; por isso não pode ser excluído apenas pelo `payment_type_id`.

**Alternatives considered**:

- Excluir `account_money` e transferências bancárias: rejeitado por descartar vendas legítimas pagas com saldo ou PIX.

**Source**: [Meios de pagamento disponíveis](https://www.mercadopago.com.br/developers/pt/docs/sales-processing/payment-methods)

## Decision 4 - Histórico somente auditável nesta feature

**Decision**: Não apagar automaticamente pedidos existentes; preservar/usar a classificação e o payload redigido para identificar candidatos.

**Rationale**: Um pedido importado pode ter afetado estoque, caixa e relatórios. Excluir sem compensações e aprovação de usuário é uma mutação financeira destrutiva e não decorre com segurança apenas do tipo atual do pagamento.

**Alternatives considered**:

- Exclusão automática em deploy ou nova sincronização: rejeitada por risco de inconsistência contábil e operacional.
- Ignorar completamente histórico: rejeitado porque a rastreabilidade é necessária para uma correção controlada posterior.
