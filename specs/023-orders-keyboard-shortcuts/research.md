# Research: Navegação e Ações por Teclado na Fila de Pedidos

## Contexto investigado

- **Tela real**: `/admin/orders` ([page.tsx](../../apps/web/app/admin/orders/page.tsx)) renderiza `KdsClient`, um wrapper fino sobre `OrdersClient` ([orders-client.tsx](../../apps/web/app/admin/orders/orders-client.tsx)) — é o único componente a alterar.
- **Ordem dos pedidos já é FIFO cruzando colunas**: a API (`kds-query.service.ts`) busca pedidos ativos com `orderBy: [{ createdAt: "asc" }, { id: "asc" }]`, sem agrupar por status. O array `activeOrders` recebido por `OrdersClient` já é a "fila única" que a spec pede — as 4 colunas são apenas um agrupamento visual (`groupedOrders`, via `useMemo`) feito no próprio componente. **Não é necessário reordenar nada**: navegar por `activeOrders` na ordem em que chega já é a navegação cronológica cruzando colunas.
- **Ações reaproveitadas** (nenhuma nova regra de negócio):
  - Avançar fase: `changeStatus(order, status)`, onde `status` é sempre o único item não-`CANCELLED` de `order.nextStatuses` (a função `nextStatuses()` no backend sempre retorna `[proximaFase, CANCELLED]` ou `[]`).
  - Aceitar iFood pendente: `acceptPlatformOrder(order)`.
  - Cancelar pedido normal: `changeStatus(order, "CANCELLED")` — hoje já é instantâneo ao clique, sem confirmação.
  - Recusar iFood pendente: o botão "Recusar" hoje só **abre** o formulário inline de motivo (`openRefuseForm`); quem efetivamente recusa é o botão "Confirmar recusa" (`submitRefuse`), que exige motivo preenchido. A ação de teclado deve replicar exatamente o botão "Recusar" (abrir o formulário), não pular a etapa de motivo.
  - Cobrar: abre `PaymentCheckoutDialog` (`setCheckoutOrder(order)`) — só existe quando o pedido não está vinculado a uma comanda (`order.serviceTabId` vazio); quando vinculado, hoje é um link de navegação (`Cobrar na comanda`), que a spec explicitamente diz para NÃO disparar via atalho (FR-010, US4 cenário 2).
- **Estados que já existem e precisam bloquear os atalhos**: `maintenanceOrder` (abre `OrderMaintenanceDialog`, `role="dialog"`), `checkoutOrder` (abre `PaymentCheckoutDialog`, `role="dialog"`), e o formulário inline de recusa (`refusingOrderId` setado) — este último não é um modal, mas tem campos de texto que não podem perder a digitação para um atalho global.
- **Sem precedente de listener global de teclado** no admin: o único uso de `onKeyDown` existente (`multi-select-filter.tsx`) é local ao componente (fecha popover com `Escape`). Esta feature introduz o primeiro listener de teclado em nível de documento no admin.

## Decisões

- **Decision**: A lista de navegação por teclado é o próprio array `activeOrders` (na ordem em que a API entrega), sem reordenação adicional no cliente.
  - **Rationale**: já é FIFO cruzando as 4 colunas, exatamente o que a spec pede; evita duplicar lógica de ordenação no frontend.
  - **Alternatives considered**: reconstruir a lista a partir de `groupedOrders` (coluna por coluna) — rejeitado por já não refletir "o pedido mais antigo geral primeiro" quando colunas têm quantidades desiguais.

- **Decision**: Extrair a mecânica de seleção/atalhos para um hook dedicado, `use-order-queue-shortcuts.ts`, seguindo o mesmo padrão de separação já usado por `use-kds-orders.ts`. O hook recebe a lista de pedidos ativos e um conjunto de callbacks (`onPrimaryAction`, `onDestructiveAction`, `onCharge`, `isInputBlocked`) fornecidos por `OrdersClient`, e devolve o estado de seleção/posição/confirmação pendente para a tela renderizar.
  - **Rationale**: mantém `orders-client.tsx` legível (já é um componente grande), isola a mecânica de teclado (fácil de testar isoladamente, no padrão "Harness" já usado em `use-kds-orders.spec.tsx`) das regras de negócio existentes (que continuam em `orders-client.tsx`, inalteradas).
  - **Alternatives considered**: colocar tudo inline em `orders-client.tsx` — rejeitado por tornar um componente já extenso mais difícil de revisar e testar.

- **Decision**: O listener de teclado é registrado uma vez em nível de `document` (dentro do hook, via `useEffect`), e ignora o evento quando: (a) `document.activeElement` é `INPUT`, `TEXTAREA`, `SELECT` ou tem `isContentEditable`; ou (b) um modal está aberto (`maintenanceOrder`/`checkoutOrder` não nulos) ou o formulário inline de recusa está aberto (`refusingOrderId` não nulo) — este conjunto de condições é resumido num único booleano `isInputBlocked` calculado em `OrdersClient` e passado ao hook.
  - **Rationale**: atende FR-011 com uma única fonte de verdade, reaproveitando estados que já existem no componente.
  - **Alternatives considered**: um listener por card (`onKeyDown` local) — rejeitado porque a seleção pode não estar fisicamente focada em algum momento (ex. logo após um refresh via socket) e o atalho precisa funcionar mesmo assim.

- **Decision**: `Tab`/`Shift+Tab` só são interceptados (via `preventDefault`) para navegação de pedidos quando o foco atual **não está** em um controle nativamente interativo (botão, link, input, select, textarea, ou qualquer elemento com `tabindex` próprio) — ou seja, quando o foco está no `body`/documento ou em um card de pedido gerenciado pela própria seleção. Quando o foco estiver, por exemplo, dentro de um botão do card (usuário navegando manualmente com Tab do jeito tradicional), `Tab` mantém o comportamento padrão do navegador.
  - **Rationale**: evita quebrar a navegação por teclado *padrão* de acessibilidade (Tab entre botões/links) para quem não está usando o modo "seleciona pedido" — sem essa distinção, qualquer usuário de leitor de tela ou navegação por teclado convencional perderia a capacidade de tabular entre os botões de um card.
  - **Alternatives considered**: capturar `Tab` sempre, incondicionalmente — rejeitado por ser um retrocesso de acessibilidade; a spec já assume que os atalhos são "um caminho adicional, não uma substituição obrigatória" (ver Assumptions do spec.md).

- **Decision**: O pedido selecionado recebe foco real do DOM (`element.focus({ preventScroll: true })` seguido de `element.scrollIntoView({ block: "nearest", behavior: "smooth" })`), usando um mapa de refs (`Map<string, HTMLElement>`) por ID de pedido; cada card tem `tabIndex={-1}` (focável via script, fora da ordem natural de tabulação).
  - **Rationale**: atende FR-002/FR-004 e reforça acessibilidade (o anel de foco nativo do navegador reforça o destaque visual customizado; leitores de tela anunciam o card focado).
  - **Alternatives considered**: destaque puramente visual (CSS) sem foco real — rejeitado por não ser inspecionável/anunciável por tecnologia assistiva.

- **Decision**: Estilo de seleção usa um canal visual diferente do já existente para "atraso" (`border-red-400 ring-2 ring-red-100`): anel azul de alto contraste (`ring-4 ring-blue-600`) + selo de texto "Selecionado · 3/14" no card, para que os dois estados (atrasado + selecionado) coexistam sem ambiguidade.
  - **Rationale**: decisão já validada com o usuário na fase de análise.

- **Decision**: Confirmação dupla de `F3` implementada como estado local no hook (`pendingCancelOrderId`, `setTimeout` de 2000ms guardado em `ref` para poder ser cancelado), limpo em qualquer um destes eventos: segunda pressão de `F3` (aplica a ação), `Esc`, mudança de seleção, qualquer outra tecla de atalho, ou expiração do timeout.
  - **Rationale**: atende FR-008/FR-009 sem exigir estado no servidor nem temporizador visível além do aviso textual.
  - **Alternatives considered**: `window.confirm()` nativo — rejeitado por bloquear a thread principal e quebrar o ritmo "sem tirar a mão do teclado" que é o objetivo central da feature.

- **Decision**: Reconciliação de seleção após atualização em tempo real: o hook observa mudanças na lista de pedidos recebida; se o pedido atualmente selecionado não estiver mais presente, seleciona o pedido que ocupa a posição mais próxima (mesmo índice, "clampado" ao novo tamanho da lista) na nova lista, ou limpa a seleção se a lista ficar vazia.
  - **Rationale**: atende FR-012 e o edge case de pedido que sai da fila (concluído/cancelado em outro dispositivo) sem "prender" a seleção num pedido inexistente.
  - **Alternatives considered**: sempre voltar para o primeiro pedido da fila quando o selecionado sumir — rejeitado por ser mais disruptivo ao fluxo do operador do que manter a posição aproximada.

**Output**: todas as dúvidas técnicas resolvidas; nenhum item `NEEDS CLARIFICATION` restante.
