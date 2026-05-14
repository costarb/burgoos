# Feature Specification: Validação Delivery Real

**Feature Branch**: `001-validacao-delivery-real`

**Created**: 2026-05-13

**Status**: Draft

**Input**: User description: "Validar uma operação real de delivery com cardápio digital, pedidos, WhatsApp e painel operacional mínimo para uma loja piloto"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicar cardápio vendável (Priority: P1)

Como dono da operação piloto, quero cadastrar minha loja, categorias e produtos para compartilhar um link de cardápio que já possa receber pedidos reais.

**Why this priority**: Sem cardápio público e catálogo editável não existe validação comercial.

**Independent Test**: Criar uma loja piloto, usar a tela administrativa de catálogo para cadastrar ao menos 2 categorias e 5 produtos, abrir o link público em celular e verificar que apenas itens ativos aparecem com preço, descrição e imagem quando disponível.

**Acceptance Scenarios**:

1. **Given** uma loja piloto ativa, **When** o admin cadastra categoria e produto ativos, **Then** eles aparecem no cardápio público da loja.
2. **Given** um produto inativo, **When** o cliente acessa o cardápio público, **Then** o produto não aparece para compra.
3. **Given** um slug inexistente ou loja inativa, **When** o cliente acessa o cardápio, **Then** o sistema exibe estado de indisponibilidade sem erro técnico.
4. **Given** o admin autenticado na tela de catálogo, **When** ele informa nome, ordem e status de uma categoria, **Then** a categoria é criada e aparece na lista administrativa.
5. **Given** existe ao menos uma categoria, **When** o admin informa categoria, nome, descrição, preço, imagem opcional e status de um produto, **Then** o produto é criado e aparece na lista administrativa.

---

### User Story 2 - Receber pedido real pelo cardápio (Priority: P1)

Como cliente final, quero escolher produtos, informar meus dados e confirmar um pedido para comprar diretamente da operação piloto.

**Why this priority**: O objetivo central da validação é transformar visita ao cardápio em pedido real.

**Independent Test**: Em um celular, adicionar itens ao carrinho, escolher delivery ou retirada, preencher dados obrigatórios e confirmar pedido; o pedido deve ser persistido com total calculado no servidor.

**Acceptance Scenarios**:

1. **Given** uma loja aberta com produtos ativos, **When** o cliente confirma um carrinho válido, **Then** o sistema cria um pedido `PENDING`.
2. **Given** uma loja fechada, **When** o cliente tenta finalizar o pedido, **Then** o sistema bloqueia o checkout e explica o motivo.
3. **Given** um item que ficou inativo antes da confirmação, **When** o cliente envia o pedido, **Then** o sistema rejeita o item e pede revisão do carrinho.
4. **Given** um pedido criado, **When** a confirmação é exibida, **Then** o cliente vê um resumo e um link WhatsApp com o conteúdo do pedido.

---

### User Story 3 - Operar fila de pedidos (Priority: P1)

Como operador da loja, quero ver novos pedidos em uma fila simples e mudar seu status para organizar preparo e entrega.

**Why this priority**: A validação depende de operação real sem perder pedidos durante o atendimento.

**Independent Test**: Criar um pedido pelo cardápio e verificar que ele aparece no painel admin, dispara alerta visual/sonoro e permite mudança de status até finalizado ou cancelado.

**Acceptance Scenarios**:

1. **Given** um pedido novo, **When** o painel admin está aberto, **Then** o pedido aparece na fila correta com alerta visual e sonoro.
2. **Given** um pedido `PENDING`, **When** o operador altera para `PREPARING`, **Then** o novo status é persistido.
3. **Given** um pedido em andamento, **When** o operador finaliza ou cancela, **Then** o pedido sai da fila ativa e fica no histórico.

---

### User Story 4 - Medir resultado diário mínimo (Priority: P2)

Como dono da operação piloto, quero consultar quantidade de pedidos e receita bruta do dia para entender se o canal próprio está gerando tração.

**Why this priority**: Métrica simples é suficiente para decidir próximos ajustes da operação e do produto.

**Independent Test**: Criar pedidos em datas diferentes e validar que o resumo diário mostra quantidade e receita bruta do período selecionado.

**Acceptance Scenarios**:

1. **Given** pedidos entregues em um dia, **When** o admin abre o resumo diário, **Then** vê quantidade de pedidos e receita bruta.
2. **Given** pedidos cancelados, **When** o resumo é calculado, **Then** eles não entram na receita bruta.

### Edge Cases

- Cliente tenta finalizar pedido com carrinho vazio.
- Cliente perde conexão durante checkout.
- Produto é desativado ou tem preço alterado enquanto está no carrinho.
- Imagem de produto falha ao carregar.
- Painel admin fica desconectado do realtime.
- Link WhatsApp não abre no dispositivo do cliente.
- Dois pedidos chegam quase ao mesmo tempo.
- Cliente informa delivery sem endereço obrigatório.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support one pilot store with SaaS-ready tenant fields.
- **FR-002**: System MUST allow admin login for the pilot store.
- **FR-003**: System MUST allow admins to create, view, edit, activate and deactivate categories from the administrative catalog experience.
- **FR-004**: System MUST allow admins to create, view, edit, activate and deactivate products from the administrative catalog experience, including name, description, price, category and optional image URL.
- **FR-005**: System MUST expose a public menu by store slug.
- **FR-006**: System MUST show only active categories and active products in the public menu.
- **FR-007**: System MUST allow customers to add active products to a local cart.
- **FR-008**: System MUST support checkout for delivery and pickup.
- **FR-009**: System MUST collect customer name and phone for every order.
- **FR-010**: System MUST collect delivery address when fulfillment method is delivery.
- **FR-011**: System MUST support payment method selection for cash, manual PIX and card on delivery.
- **FR-012**: System MUST calculate order totals on the server using current product prices.
- **FR-013**: System MUST reject checkout when the store is closed or inactive.
- **FR-014**: System MUST reject inactive products during checkout even if they remain in the local cart.
- **FR-015**: System MUST persist orders and order items with product name and price snapshots.
- **FR-016**: System MUST generate a WhatsApp deep link containing order summary.
- **FR-017**: System MUST show new orders in an admin queue.
- **FR-018**: System MUST provide visual and sound alert for new orders when admin panel is open.
- **FR-019**: System MUST allow status transitions: `PENDING`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`.
- **FR-020**: System MUST provide basic daily summary: valid order count and gross revenue.
- **FR-021**: System MUST log order creation, checkout rejection and status changes.
- **FR-022**: System MUST keep admin operations tenant-scoped even during the single-store pilot.

### Key Entities *(include if feature involves data)*

- **Tenant**: Store/account context; includes name, slug, phone, active/open flags and operational config.
- **User**: Admin/operator who manages catalog and orders for a tenant.
- **Category**: Public grouping of products; belongs to a tenant.
- **Product**: Sellable item; belongs to tenant and category; has price, availability and optional image.
- **Order**: Customer purchase request; belongs to tenant; contains customer, fulfillment, payment, status and totals.
- **OrderItem**: Snapshot of purchased product, quantity, unit price and total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pilot operator can publish a menu with at least 10 products in under 20 minutes after account setup.
- **SC-002**: Customer can place a valid order from a mobile device in 5 main steps or fewer.
- **SC-003**: New orders appear in the admin panel within 5 seconds while the panel is connected.
- **SC-004**: No known order is lost during a live pilot shift.
- **SC-005**: Daily summary matches manually checked order totals for the pilot day.
- **SC-006**: Public menu loads within 2 seconds on a common mobile 4G connection for the pilot catalog size.

## Assumptions

- The first validation uses one real delivery operation.
- The system remains tenant-ready, but billing, plans and self-service multi-store onboarding are out of scope.
- Manual PIX means displaying instructions or registering the chosen payment method; no PSP integration is included.
- WhatsApp integration is a deep link only; no WhatsApp Cloud API is included.
- Thermal printing is deferred unless the pilot proves manual order handling is a blocker.
- The pilot can start with uploaded image URLs or S3-compatible storage, depending on implementation readiness.
