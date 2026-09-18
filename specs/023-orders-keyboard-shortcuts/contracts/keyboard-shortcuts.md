# UI Contract: Atalhos de teclado da fila de pedidos

Não é um contrato REST — é o mapeamento de teclas exposto pela tela `admin/orders`, que passa a valer como comportamento esperado (e coberto por teste) a partir desta feature.

## Mapa de teclas

| Tecla | Escopo | Efeito |
|---|---|---|
| `Tab` | Nenhum pedido selecionado, ou foco fora de controle interativo | Seleciona o próximo pedido mais antigo da fila (cruzando colunas) |
| `Shift+Tab` | idem | Seleciona o pedido anterior da fila |
| `Espaço` | idem | Mesmo efeito de `Tab` (reforço, tecla maior/mais fácil de acionar sem olhar) |
| `1` `2` `3` `4` | Sempre que atalhos não estão bloqueados | Seleciona o primeiro pedido (mais antigo) da coluna 1=Novo, 2=Preparando, 3=Pronto, 4=Saiu; sem efeito se a coluna estiver vazia |
| `F2` | Há um pedido selecionado | Ação primária: avança de fase, ou aceita quando é iFood pendente. Seleção avança automaticamente para o próximo pedido após sucesso |
| `F3` (1ª pressão) | Há um pedido selecionado | Arma confirmação de cancelamento/recusa; mostra aviso "aperte F3 novamente" |
| `F3` (2ª pressão, ≤2s) | Confirmação armada para o mesmo pedido | Cancela (pedido normal) ou abre o formulário de recusa com motivo (iFood pendente) |
| `F4` | Pedido selecionado sem comanda vinculada | Abre o diálogo de cobrança do pedido |
| `Esc` | Sempre | Limpa a seleção atual e/ou cancela uma confirmação de `F3` pendente |

## Pré-condições comuns (bloqueiam todos os atalhos acima, exceto navegação nativa)

- Foco do navegador em `input`, `textarea`, `select` ou elemento `contenteditable`.
- Um modal está aberto: Manutenção do pedido (`OrderMaintenanceDialog`) ou Cobrança (`PaymentCheckoutDialog`).
- O formulário inline de recusa de pedido iFood está aberto (`refusingOrderId` setado).

## Efeito colateral sempre presente

- Toda ação disparada por atalho usa a mesma função e o mesmo feedback (`OperationFeedback`) já usados pelo clique equivalente — não há mensagem nem rota de erro exclusiva do teclado.
- A barra fixa de atalhos reflete em tempo real qual pedido está selecionado e o rótulo atual de `F2`/`F3`/`F4` para aquele pedido (rótulos mudam para pedidos iFood pendentes).
