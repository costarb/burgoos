# Quickstart: validar importação somente de vendas Mercado Pago

## Pré-requisitos

- Dependências do monorepo instaladas.
- Credenciais locais/teste configuradas somente quando for executar sincronização real.

## Validação automatizada

1. Execute os testes unitários do mapper e client Mercado Pago.
2. Execute os testes do adapter, reconciliação e webhook.
3. Execute typecheck da API.

Casos mínimos esperados:

- `regular_payment`, `pos_payment` e `recurring_payment` aprovados geram `SALE`.
- `money_transfer`, operação ausente e operação desconhecida geram `NON_SALE`.
- `account_money` continua aceito quando a operação é uma venda.
- a busca contém `status=approved`.
- uma página sem vendas elegíveis não interrompe a paginação.

## Validação manual segura

1. Use uma conexão de teste ou um período pequeno conhecido.
2. Execute o preview de sincronização sem confirmar pedidos.
3. Compare os IDs do Mercado Pago: vendas devem aparecer como elegíveis; transferências, aplicações e resgates devem aparecer como desconsiderados.
4. Confirme somente após revisar os totais do preview.

Não use esta feature para excluir automaticamente pedidos históricos. Gere uma lista de candidatos pelo payload/classificação e trate efeitos de estoque e caixa em um fluxo separado.
