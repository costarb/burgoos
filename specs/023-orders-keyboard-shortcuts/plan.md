# Implementation Plan: Navegação e Ações por Teclado na Fila de Pedidos

**Branch**: `023-orders-keyboard-shortcuts` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-orders-keyboard-shortcuts/spec.md`

## Summary

Adicionar navegação e ações por teclado à fila de pedidos (`admin/orders` → `OrdersClient`), sem nenhuma regra de negócio nova: `Tab`/`Shift+Tab`/`Espaço` selecionam o pedido anterior/próximo na fila FIFO já entregue pela API (cruzando as 4 colunas), `1`-`4` pulam para a primeira coluna desejada, `F2` dispara a ação primária do pedido selecionado (avançar fase ou aceitar iFood), `F3` dispara a ação destrutiva (cancelar ou recusar) exigindo confirmação em duas pressões dentro de 2 segundos, `F4` abre a cobrança quando aplicável, e `Esc` limpa a seleção/confirmação pendente. A mecânica de teclado fica isolada num hook dedicado (`use-order-queue-shortcuts.ts`), reaproveitando as funções de ação já existentes em `orders-client.tsx`. O pedido selecionado recebe foco real do DOM, destaque visual (anel azul, distinto do destaque vermelho de atraso já existente) e uma barra fixa mostra a identidade do pedido selecionado e o rótulo atual de cada tecla.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: React 18, Next.js 14 App Router, TailwindCSS (frontend apenas; nenhuma dependência nova)

**Storage**: N/A — nenhuma persistência nova; estado é local ao componente/hook em memória

**Testing**: Vitest + `react-dom/client` (padrão "Harness" já usado em `use-kds-orders.spec.tsx` e `orders-client.spec.tsx`)

**Target Platform**: Navegadores desktop modernos (a tela é usada em balcão/cozinha, possivelmente monitor dedicado, mas não necessariamente em modo kiosk)

**Project Type**: Monorepo web — mudança restrita a `apps/web` (nenhuma mudança de API/DTO/schema)

**Performance Goals**: resposta ao atalho perceptível em menos de 100ms para navegação/seleção (sem chamada de rede); ações (`F2`/`F3`/`F4`) seguem o tempo de resposta já existente das chamadas de API equivalentes

**Constraints**: não interceptar `Tab` quando o foco estiver em um controle nativamente interativo (preserva acessibilidade padrão); não disparar nenhum atalho com foco em campo de texto/seleção ou modal aberto; nenhuma tecla reservada pelo navegador (`F1`, `F5`, `F6`, `F11`, `F12`) é usada; seleção deve sobreviver a atualizações em tempo real (socket/polling) sem "prender" num pedido que já saiu da fila

**Scale/Scope**: uma tela (`admin/orders`/`OrdersClient`); sem impacto em outras telas operacionais (PDV, comandas)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Agiliza diretamente o fluxo operacional real (fila de pedidos), sem expandir escopo além do pedido.
- **TypeScript Strict By Default**: Pass. Novo hook e componente com tipos explícitos; reaproveita tipos já existentes (`KdsOrder`, `AdminOrder`, `OrderStatus`).
- **Modular Monolith, Domain-Oriented**: Pass. Mudança concentrada na feature slice de Operations (fila de pedidos), sem tocar em outros domínios.
- **Tenant Isolation Is A Design Constraint**: Pass. Nenhuma mudança de acesso a dados; os atalhos apenas disparam as mesmas chamadas já autenticadas/isoladas por tenant que os botões já fazem.
- **Tests Protect Operational Flow**: Pass. Navegação, ações contextuais, confirmação de cancelamento e bloqueio em campos/modais serão cobertos por testes automatizados.
- **Quality Gates**: Pass. `spec.md`, `plan.md` (este arquivo) e `tasks.md` (próxima etapa) serão explícitos antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/023-orders-keyboard-shortcuts/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── keyboard-shortcuts.md
├── checklists/requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/app/admin/orders/
├── orders-client.tsx                  # wire do hook, refs por card, destaque visual, barra de atalhos
├── orders-client.spec.tsx             # novos casos: atalhos ponta a ponta via Harness existente
├── use-order-queue-shortcuts.ts       # NOVO: hook de seleção/confirmação/listener de teclado
├── use-order-queue-shortcuts.spec.ts  # NOVO: testes isolados do hook (padrão Harness)
└── order-queue-shortcut-bar.tsx       # NOVO: barra fixa com pedido selecionado e rótulos de tecla
```

Nenhum arquivo de `apps/api` ou `packages/types` é alterado — a feature é inteiramente de interação no cliente, reaproveitando endpoints e tipos já existentes.

**Structure Decision**: extrair a mecânica de teclado para um hook dedicado (mesmo padrão de `use-kds-orders.ts`) e um pequeno componente de apresentação para a barra de atalhos, mantendo `orders-client.tsx` como orientador das regras de negócio (que não mudam) e consumidor do hook.

## Design

### `use-order-queue-shortcuts` (hook)

- **Entrada**: `orders: KdsOrder[]` (a mesma `activeOrders`, na ordem já FIFO entregue pela API), `isInputBlocked: boolean` (calculado por `OrdersClient` a partir de `maintenanceOrder`/`checkoutOrder`/`refusingOrderId`), e callbacks `onPrimaryAction(order)`, `onDestructiveAction(order)`, `onCharge(order)`.
- **Saída**: `selectedOrderId`, `selectedOrder`, `position` (`{ index, total }`), `pendingCancelOrderId`, e um `registerCardRef(orderId)` para o componente associar cada card ao seu elemento DOM.
- Registra um único listener `keydown` em `document` via `useEffect`, limpo no unmount.
- `Tab`/`Shift+Tab`/`Espaço`: só agem quando `document.activeElement` não é um controle nativamente interativo (ver research.md); movem `selectedOrderId` para o próximo/anterior item de `orders`.
- `1`-`4`: selecionam o primeiro pedido da coluna correspondente (`activeStatuses[n-1]`), ignorado se vazio.
- `F2`/`F3`/`F4`: ignorados se `selectedOrderId` for `null` ou `isInputBlocked` for verdadeiro; chamam os callbacks correspondentes com o pedido selecionado.
- `F3`: primeira pressão arma `pendingCancelOrderId`; segunda pressão (mesmo pedido, dentro de 2000ms) chama `onDestructiveAction` e limpa o estado; qualquer outro evento (outra tecla, `Esc`, mudança de seleção) limpa o pendente sem disparar a ação.
- `Esc`: limpa `selectedOrderId` e `pendingCancelOrderId`.
- Reconciliação: um `useEffect` observando `orders` reposiciona/limpa `selectedOrderId` quando o pedido selecionado não está mais presente (ver data-model.md).
- Efeito colateral de foco: sempre que `selectedOrderId` muda, chama `element.focus({ preventScroll: true })` + `element.scrollIntoView({ block: "nearest", behavior: "smooth" })` no elemento registrado via `registerCardRef`.

### `orders-client.tsx` (integração)

- Cada card de pedido recebe `ref` (via `registerCardRef(order.id)`) e `tabIndex={-1}`.
- Classe condicional de destaque: `ring-4 ring-blue-600 ring-offset-2` quando `order.id === selectedOrderId`, coexistindo com a borda vermelha de atraso já existente (`order.overdue`), mais um selo de texto "Selecionado · {index}/{total}".
- `onPrimaryAction`/`onDestructiveAction`/`onCharge` passados ao hook chamam exatamente as funções já existentes (`changeStatus`, `acceptPlatformOrder`, `openRefuseForm`, `setCheckoutOrder`), sem duplicar lógica.
- `isInputBlocked = maintenanceOrder !== null || checkoutOrder !== null || refusingOrderId !== null`.

### `order-queue-shortcut-bar.tsx` (apresentação)

- Componente puramente de apresentação (sem estado próprio): recebe o pedido selecionado (ou `null`), posição, e os rótulos/disponibilidade de `F2`/`F3`/`F4` para aquele pedido, e a mensagem de confirmação pendente de `F3` quando aplicável.
- Renderiza fixo (`sticky`) no topo ou rodapé da tela, sempre visível independentemente de rolagem.

## Test Strategy

- **Hook (`use-order-queue-shortcuts.spec.ts`)**: navegação `Tab`/`Shift+Tab`/`Espaço`/`1`-`4`, ignorar quando `isInputBlocked`, ignorar `Tab` quando o foco está em um controle interativo, disparo de `F2`/`F3`(dupla)/`F4`, expiração da confirmação após 2s, reconciliação quando o pedido selecionado desaparece da lista, `Esc` limpando seleção e confirmação.
- **Componente (`orders-client.spec.tsx`)**: cenários ponta a ponta reaproveitando o padrão já existente (mock de `getKdsOrders`/ações), confirmando que os atalhos produzem o mesmo resultado que os cliques equivalentes já testados hoje, e que o destaque visual/barra de atalhos aparecem corretamente.
- **Regression**: suíte web existente (`orders-client.spec.tsx`, `use-kds-orders.spec.tsx`), typecheck e lint.

## Constitution Check - Post Design

Todos os gates permanecem aprovados. O desenho não introduz banco, endpoint ou dependência nova; isola a mecânica de teclado num hook testável e reaproveita 100% das regras de negócio já existentes na tela.

## Complexity Tracking

Nenhuma violação constitucional identificada.
