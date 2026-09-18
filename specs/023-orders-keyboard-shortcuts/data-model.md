# Data Model: Navegação e Ações por Teclado na Fila de Pedidos

Não há alteração de esquema de banco de dados nem de contrato de API. Os modelos abaixo existem apenas como estado de UI (React), na tela `admin/orders`.

## OrderQueueSelection (novo, estado de UI)

- `selectedOrderId`: ID do pedido atualmente selecionado, ou `null` quando nenhum pedido está selecionado.
- `position`: derivado a partir de `selectedOrderId` e da lista de pedidos ativos — `{ index: number; total: number }` (1-based, para exibição "3/14").
- Identidade sempre por `id`, nunca por índice de array — necessário para sobreviver a atualizações em tempo real (ver FR-012).

## PendingCancelConfirmation (novo, estado de UI)

- `orderId`: ID do pedido aguardando a segunda pressão de `F3` para confirmar cancelamento/recusa.
- Expira automaticamente após 2000ms (temporizador local, sem persistência).
- É sempre limpo (sem aplicar a ação) por: `Esc`, mudança de seleção, qualquer outra tecla de atalho, ou pelo próprio timeout.

## Ação Contextual do Pedido Selecionado (derivado, sem estado próprio)

Calculado a partir do pedido selecionado a cada renderização — não é armazenado:

- **Ação primária** (`F2`):
  - Pedido iFood pendente de aceite (`platformProvider === "IFOOD" && status === "PENDING"`): rótulo "Aceitar iFood", dispara `acceptPlatformOrder`.
  - Caso contrário: rótulo = label do primeiro status não-`CANCELLED` em `order.nextStatuses` (ex. "Preparando", "Pronto"), dispara `changeStatus(order, status)`.
  - Ausente quando `order.nextStatuses` não contém nenhum status além de `CANCELLED` (fila vazia dessa ação).
- **Ação destrutiva** (`F3`):
  - Pedido iFood pendente: rótulo "Recusar", dispara a abertura do formulário de motivo (`openRefuseForm`) — não finaliza a recusa sozinha.
  - Caso contrário: rótulo "Cancelar", dispara `changeStatus(order, "CANCELLED")`.
- **Cobrança** (`F4`):
  - Presente apenas quando `order.serviceTabId` é vazio/nulo (pedido não vinculado a comanda); dispara `setCheckoutOrder(order)`.
  - Ausente quando o pedido está vinculado a uma comanda (hoje é só um link "Cobrar na comanda"; FR-010 exige que `F4` não navegue automaticamente nesse caso).

## Validation / Regras de consistência

- Nenhum atalho (`F2`, `F3`, `F4`, `1`-`4`, `Tab`/`Shift+Tab` como seleção) é processado quando `isInputBlocked` é verdadeiro (foco em campo de texto/seleção existente, ou modal/formulário de recusa aberto).
- `Tab`/`Shift+Tab` só disparam a navegação de pedidos quando o foco atual não está sobre um controle nativamente interativo (botão, link, input, select, textarea ou elemento com `tabindex` próprio) — do contrário, mantém o comportamento padrão do navegador (ver research.md).
- A segunda pressão de `F3` só confirma a ação se for para o **mesmo** `orderId` que armou a confirmação pendente; pressionar `F3` num pedido diferente reinicia a confirmação para o novo pedido (não confirma o anterior).
- Ao reconciliar a lista de pedidos após uma atualização em tempo real, se `selectedOrderId` não existir mais na nova lista, a seleção é movida para o pedido na mesma posição (índice) "clampada" ao novo tamanho, ou `null` se a lista ficar vazia.
