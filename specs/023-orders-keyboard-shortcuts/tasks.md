---

description: "Task list template for feature implementation"
---

# Tasks: Navegação e Ações por Teclado na Fila de Pedidos

**Input**: Design documents from `/specs/023-orders-keyboard-shortcuts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/keyboard-shortcuts.md, quickstart.md

**Tests**: Incluídos — a constituição do projeto ("Tests Protect Operational Flow") e o plano exigem regressão automatizada para este fluxo.

**Organization**: Tarefas agrupadas por user story (US1-US4 de spec.md), com uma fase fundacional prévia que cria o hook de seleção/teclado e o encanamento que todas as histórias consomem.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story a tarefa pertence (US1, US2, US3, US4)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto web deste monorepo: `apps/web/app/admin/orders/` (frontend afetado). Nenhum arquivo de `apps/api` ou `packages/types` é alterado — a feature é inteiramente de interação no cliente (ver research.md).

---

## Phase 1: Setup

**Purpose**: Confirmar que os tipos compartilhados já cobrem o que a feature precisa antes de criar qualquer arquivo novo.

- [ ] T001 Confirmar em `packages/types/src/pos.ts` que `KdsOrder`/`AdminOrder` já expõem `id`, `status`, `nextStatuses`, `platformProvider`, `serviceTabId` e `version`; nenhuma mudança de tipos é esperada (ver research.md).

**Checkpoint**: Contrato de tipos confirmado — nenhuma mudança esperada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Criar o hook de seleção/teclado e o encanamento em `OrdersClient` que todas as user stories vão consumir.

**⚠️ CRITICAL**: Nenhuma user story pode ser implementada antes desta fase.

- [ ] T002 Criar `apps/web/app/admin/orders/use-order-queue-shortcuts.ts` com o estado base (`selectedOrderId`, `pendingCancelOrderId`), `registerCardRef` (mapa `orderId -> HTMLElement`) e o tipo de retorno do hook (`UseOrderQueueShortcutsResult`), recebendo `orders: KdsOrder[]`, `isInputBlocked: boolean` e os callbacks `onPrimaryAction`/`onDestructiveAction`/`onCharge` como parâmetros.
- [ ] T003 Implementar em `apps/web/app/admin/orders/use-order-queue-shortcuts.ts` o efeito de reconciliação (FR-012): quando `orders` muda e `selectedOrderId` não existe mais na lista, reposicionar para o mesmo índice "clampado" ao novo tamanho, ou `null` se a lista ficar vazia.
- [ ] T004 Implementar em `apps/web/app/admin/orders/use-order-queue-shortcuts.ts` o efeito de foco/scroll: sempre que `selectedOrderId` mudar, chamar `focus({ preventScroll: true })` e `scrollIntoView({ block: "nearest", behavior: "smooth" })` no elemento registrado via `registerCardRef`.
- [ ] T005 Implementar em `apps/web/app/admin/orders/use-order-queue-shortcuts.ts` os helpers `isEditableElement(element)` (input/textarea/select/contentEditable) e `isNativelyInteractive(element)` (button/a/input/select/textarea/`[tabindex]`), e registrar o listener único `keydown` em `document` via `useEffect` (com limpeza no unmount), que já curto-circuita quando `isInputBlocked` for verdadeiro ou `isEditableElement(document.activeElement)` for verdadeiro (sem lógica de tecla específica ainda — isso vem nas histórias seguintes).
- [ ] T006 Em `apps/web/app/admin/orders/orders-client.tsx`, adicionar `ref`/`tabIndex={-1}` a cada card de pedido (via `registerCardRef(order.id)`), calcular `isInputBlocked = maintenanceOrder !== null || checkoutOrder !== null || refusingOrderId !== null`, e chamar `useOrderQueueShortcuts` com callbacks temporariamente vazios (preenchidos pelas histórias seguintes).

**Checkpoint**: Hook e encanamento prontos; as user stories abaixo só adicionam comportamento de tecla e UI sobre essa base.

---

## Phase 3: User Story 1 - Navegar pela fila de pedidos sem usar o mouse (Priority: P1) 🎯 MVP

**Goal**: Permitir mover a seleção entre pedidos com `Tab`/`Shift+Tab`/`Espaço`/`1`-`4`, com destaque visual claro, auto-scroll e `Esc` para limpar.

**Independent Test**: Com pedidos em colunas diferentes, usar `Tab`/`Shift+Tab`/`1`-`4` e confirmar que a seleção se move de forma visível e previsível, cruzando colunas em ordem cronológica.

### Tests for User Story 1 ⚠️

> Escrever estes testes primeiro; devem falhar antes da implementação desta fase.

- [ ] T007 [US1] Criar `apps/web/app/admin/orders/use-order-queue-shortcuts.spec.ts` (padrão "Harness" de `use-kds-orders.spec.tsx`): `Tab` seleciona o próximo pedido mais antigo da lista; `Shift+Tab` seleciona o anterior; nenhuma seleção inicial + primeiro `Tab` seleciona o primeiro pedido da lista.
- [ ] T008 [US1] Em `use-order-queue-shortcuts.spec.ts`: `Espaço` tem o mesmo efeito de `Tab`; `1`-`4` selecionam o primeiro pedido da coluna correspondente; tecla de coluna vazia não altera a seleção.
- [ ] T009 [US1] Em `use-order-queue-shortcuts.spec.ts`: `Tab` é ignorado (mantém comportamento nativo) quando `document.activeElement` é um botão/link/input; `Esc` limpa `selectedOrderId`.
- [ ] T010 [US1] Em `use-order-queue-shortcuts.spec.ts`: reconciliação — remover da lista o pedido atualmente selecionado move a seleção para a posição "clampada" válida mais próxima, ou `null` quando a lista fica vazia (cobre T003).
- [ ] T011 [US1] Em `apps/web/app/admin/orders/orders-client.spec.tsx`: pressionar `Tab` destaca visualmente o card correto (classe de anel azul) e mostra o selo de posição ("1/N"); o elemento correspondente recebe foco real (`document.activeElement`).

### Implementation for User Story 1

- [ ] T012 [US1] Implementar em `apps/web/app/admin/orders/use-order-queue-shortcuts.ts` o tratamento de `Tab`/`Shift+Tab`/`Espaço` (navegação), `1`-`4` (pular coluna) e `Esc` (limpar seleção) dentro do listener criado em T005.
- [ ] T013 [US1] Em `apps/web/app/admin/orders/orders-client.tsx`, aplicar a classe de destaque (`ring-4 ring-blue-600 ring-offset-2`) e o selo "Selecionado · {index}/{total}" ao card cujo `id === selectedOrderId`, coexistindo com a borda vermelha de atraso já existente.
- [ ] T014 [US1] Criar `apps/web/app/admin/orders/order-queue-shortcut-bar.tsx` (barra fixa/sticky, componente de apresentação) mostrando identidade do pedido selecionado e posição; renderizá-la em `orders-client.tsx`.

**Checkpoint**: User Story 1 funcional e testável de forma independente — operador já navega a fila inteira só com o teclado.

---

## Phase 4: User Story 2 - Avançar a fase do pedido selecionado sem usar o mouse (Priority: P1)

**Goal**: `F2` dispara a ação primária (avançar fase ou aceitar iFood) do pedido selecionado, avançando a seleção automaticamente em seguida.

**Independent Test**: Selecionar um pedido normal e pressionar `F2`; confirmar que ele muda de status como o botão já fazia, e que a seleção passa para o próximo pedido mais antigo.

### Tests for User Story 2 ⚠️

- [ ] T015 [US2] Em `use-order-queue-shortcuts.spec.ts`: `F2` chama `onPrimaryAction` com o pedido selecionado; sem efeito quando não há seleção ou quando `isInputBlocked` é verdadeiro.
- [ ] T016 [US2] Em `orders-client.spec.tsx`: `F2` num pedido normal chama `changeStatus` com o próximo status correto e avança a seleção para o próximo pedido; `F2` num pedido iFood pendente chama `acceptPlatformOrder`.
- [ ] T017 [US2] Em `orders-client.spec.tsx`: pressionar `F2` duas vezes rapidamente enquanto a primeira chamada está em andamento dispara apenas uma mudança de status (reaproveita a trava já existente de `changingOrderId`/`platformActionOrderId`).

### Implementation for User Story 2

- [ ] T018 [US2] Implementar o tratamento de `F2` no listener de `use-order-queue-shortcuts.ts` (chama `onPrimaryAction(selectedOrder)`).
- [ ] T019 [US2] Em `orders-client.tsx`, implementar o callback `onPrimaryAction`: despacha para `changeStatus`/`acceptPlatformOrder` conforme o tipo do pedido; após a resolução, avança a seleção para o próximo pedido da fila.
- [ ] T020 [US2] Adicionar o rótulo dinâmico de `F2` ("Avançar" ou "Aceitar iFood") em `order-queue-shortcut-bar.tsx`.

**Checkpoint**: User Stories 1 e 2 funcionam em conjunto — operador navega e avança pedidos só com o teclado.

---

## Phase 5: User Story 3 - Cancelar/recusar com trava contra toque acidental (Priority: P2)

**Goal**: `F3` exige duas pressões em até 2 segundos antes de cancelar (pedido normal) ou abrir o formulário de recusa (iFood pendente).

**Independent Test**: Pressionar `F3` uma vez e confirmar que nada é cancelado ainda, só um aviso aparece; pressionar de novo dentro do limite e confirmar que a ação é aplicada.

### Tests for User Story 3 ⚠️

- [ ] T021 [US3] Em `use-order-queue-shortcuts.spec.ts`: primeira pressão de `F3` arma `pendingCancelOrderId` (sem chamar `onDestructiveAction`); segunda pressão no mesmo pedido dentro de 2s chama `onDestructiveAction` e limpa o estado; sem segunda pressão, o estado expira sozinho após 2s.
- [ ] T022 [US3] Em `use-order-queue-shortcuts.spec.ts`: `Esc`, mudança de seleção, ou qualquer outra tecla de atalho limpam uma confirmação de `F3` pendente sem disparar a ação; `F3` num pedido diferente do que armou a confirmação reinicia a confirmação para o novo pedido.
- [ ] T023 [US3] Em `orders-client.spec.tsx`: confirmar `F3` duas vezes num pedido normal chama `changeStatus(order, "CANCELLED")`; confirmar `F3` duas vezes num pedido iFood pendente abre o formulário de motivo (`openRefuseForm`) sem submeter a recusa sozinho.

### Implementation for User Story 3

- [ ] T024 [US3] Implementar a máquina de estados de confirmação dupla de `F3` (armar/expirar/confirmar) no listener de `use-order-queue-shortcuts.ts`.
- [ ] T025 [US3] Em `orders-client.tsx`, implementar o callback `onDestructiveAction`: `changeStatus(order, "CANCELLED")` para pedidos normais, `openRefuseForm(order)` para pedidos iFood pendentes.
- [ ] T026 [US3] Adicionar em `order-queue-shortcut-bar.tsx` o rótulo de `F3` ("Cancelar"/"Recusar") e o aviso de confirmação pendente ("Aperte F3 novamente para confirmar").

**Checkpoint**: User Stories 1-3 funcionam em conjunto — navegação, avanço e cancelamento/recusa seguros só com o teclado.

---

## Phase 6: User Story 4 - Cobrar o pedido selecionado com uma tecla (Priority: P3)

**Goal**: `F4` abre o diálogo de cobrança do pedido selecionado quando aplicável (sem comanda vinculada).

**Independent Test**: Selecionar um pedido elegível e pressionar `F4`; confirmar que o mesmo diálogo do botão "Cobrar" abre.

### Tests for User Story 4 ⚠️

- [ ] T027 [US4] Em `use-order-queue-shortcuts.spec.ts`: `F4` chama `onCharge` apenas quando o pedido selecionado não tem `serviceTabId`; sem efeito caso contrário ou sem seleção.
- [ ] T028 [US4] Em `orders-client.spec.tsx`: `F4` abre `PaymentCheckoutDialog` para um pedido elegível; `F4` não tem efeito num pedido vinculado a comanda.

### Implementation for User Story 4

- [ ] T029 [US4] Implementar o tratamento de `F4` no listener de `use-order-queue-shortcuts.ts`, condicionado à elegibilidade do pedido selecionado.
- [ ] T030 [US4] Em `orders-client.tsx`, conectar `onCharge` a `setCheckoutOrder`; adicionar o rótulo de `F4` (mostrado/ocultado conforme elegibilidade) em `order-queue-shortcut-bar.tsx`.

**Checkpoint**: Todas as user stories funcionam de forma independente e integrada.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validar o comportamento de ponta a ponta, acessibilidade básica e garantir que nada existente quebrou.

- [ ] T031 [P] Rodar a suíte web (`apps/web`), incluindo `orders-client.spec.tsx` e `use-order-queue-shortcuts.spec.ts`, typecheck e lint; corrigir regressões encontradas.
- [ ] T032 Adicionar `aria-label` descritivo (ex. "Pedido #1234 de João Silva, selecionado") ao card focado em `orders-client.tsx`, reforçando para leitor de tela o destaque visual já implementado em US1.
- [ ] T033 Executar o roteiro de `specs/023-orders-keyboard-shortcuts/quickstart.md` manualmente e registrar o resultado.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode iniciar imediatamente.
- **Foundational (Phase 2)**: depende do Setup — bloqueia todas as user stories.
- **User Stories (Phase 3-6)**: todas dependem da Fase 2 concluída.
  - US1 (P1) é o MVP e não depende de US2/US3/US4.
  - US2 (P1) reaproveita a navegação da US1 para o "avanço automático de seleção" pós-`F2` — recomenda-se US1 → US2.
  - US3 (P2) e US4 (P3) são independentes entre si, mas como todas tocam os mesmos três arquivos (`use-order-queue-shortcuts.ts`, `orders-client.tsx`, `order-queue-shortcut-bar.tsx`), a sequência recomendada é US1 → US2 → US3 → US4 para evitar conflito de edição simultânea.
- **Polish (Phase 7)**: depende de todas as user stories desejadas estarem completas.

### Within Each User Story

- Testes escritos e falhando antes da implementação correspondente.
- Hook (lógica de tecla) antes da integração em `orders-client.tsx`; integração antes do rótulo na barra de atalhos.
- História completa e validada antes de seguir para a próxima prioridade.

### Parallel Opportunities

- T031 e T032 (Phase 7) podem rodar em paralelo — escopos diferentes (regressão automatizada vs. atributo de acessibilidade).
- Como praticamente todas as tarefas tocam os mesmos três arquivos (`use-order-queue-shortcuts.ts`, `orders-client.tsx`, `order-queue-shortcut-bar.tsx`) e seus specs, não há paralelismo seguro dentro das Fases 2-6 — execução sequencial é recomendada mesmo sem marcação `[P]`.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Fase 1 (Setup).
2. Completar Fase 2 (Foundational) — obrigatório antes de qualquer história.
3. Completar Fase 3 (US1) — navegação básica com destaque visual e barra de atalhos.
4. **Parar e validar**: confirmar manualmente que dá para navegar a fila inteira só com o teclado, com seleção sempre visível.
5. Este é o MVP que já resolve a parte de "selecionar pedido" pedida originalmente.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → validar independentemente → navegação funcional (MVP).
3. US2 → validar independentemente → avançar fase por teclado.
4. US3 → validar independentemente → cancelar/recusar com trava de segurança.
5. US4 → validar independentemente → cobrar por teclado.
6. Cada história agrega valor sem quebrar as anteriores.

---

## Notes

- [P] só foi usado onde os arquivos afetados são realmente independentes (Fase 7); as demais tarefas tocam os mesmos arquivos e devem ser feitas em sequência.
- Escrever os testes de cada história antes da implementação correspondente e confirmar que falham primeiro.
- Comitar após cada tarefa ou grupo lógico de tarefas.
- Parar em cada checkpoint para validar a história isoladamente antes de seguir para a próxima.
- Nenhuma tarefa de backend é necessária — a feature reaproveita 100% dos endpoints e regras de negócio já existentes (ver research.md).
