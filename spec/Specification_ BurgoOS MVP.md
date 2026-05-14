# Specification: BurgoOS MVP

**Status**: Draft | **Priority**: P0 | **Date**: 2026-05-13
**Domain**: Platform / Customer Experience / Operations

## Context & Problem

Pequenos negócios alimentícios, como hamburguerias, pizzarias, marmitarias e dark kitchens, dependem de marketplaces caros ou de atendimento manual por WhatsApp. Isso gera pedidos perdidos, baixa previsibilidade operacional e pouca presença digital própria.

O BurgoOS MVP deve entregar uma operação mínima completa: o lojista cria a loja, cadastra o cardápio, compartilha um link público, recebe pedidos e gerencia o status no painel.

## Goals

1.  Permitir que um lojista crie sua conta e configure sua loja em menos de 20 minutos.
2.  Oferecer um cardápio digital rápido, responsivo e compartilhável.
3.  Permitir que o cliente monte um pedido e finalize com dados de entrega/retirada e pagamento.
4.  Centralizar os pedidos em um painel operacional simples.
5.  Gerar um link de WhatsApp com resumo do pedido como fallback operacional.

## MVP Scope

### Included

*   Cadastro de tenant/loja com slug único.
*   Login e usuário administrador da loja.
*   CRUD de categorias.
*   CRUD de produtos com imagem, preço, descrição e disponibilidade.
*   Cardápio público por slug.
*   Carrinho local.
*   Checkout com delivery ou retirada.
*   Métodos de pagamento informativos: dinheiro, PIX manual e cartão na entrega.
*   Criação de pedido.
*   Painel admin com fila de pedidos.
*   Alteração de status do pedido.
*   Atualização em tempo real de novos pedidos no painel.
*   Link de WhatsApp com resumo do pedido.
*   Resumo financeiro básico no painel: total de pedidos e receita bruta por período.

### Deferred To Post-MVP

*   Pagamento online integrado.
*   QR Code automático.
*   Temas customizáveis avançados.
*   CRUD de adicionais e complementos complexos.
*   Impressão térmica.
*   KDS dedicado.
*   Gestão de entregadores.
*   CRM, fidelidade, cupons e recuperação de carrinho.
*   WhatsApp Cloud API, bot ou IA.
*   Multi-loja/franquias.
*   Marketplace integrations.

## User Stories

### US1: Tenant Onboarding (P1)

**Como** pequeno empreendedor, **quero** criar minha conta e configurar os dados básicos da minha loja, **para que** eu tenha um link de cardápio personalizado.

#### Acceptance Criteria

*   Dado um email válido e slug disponível, quando o lojista conclui o cadastro, então o sistema cria o tenant e o usuário administrador.
*   Dado um slug já utilizado, quando o lojista tenta cadastrar a loja, então o sistema rejeita a criação e informa o conflito.
*   Dado um tenant criado, quando o lojista acessa o painel, então ele vê as configurações básicas da loja.
*   Dado uma loja inativa, quando um cliente acessa o slug público, então o sistema exibe uma mensagem de indisponibilidade.

### US2: Product Catalog Management (P1)

**Como** lojista, **quero** cadastrar categorias e produtos com fotos, descrições, preços e disponibilidade, **para que** meus clientes vejam o que eu vendo.

#### Acceptance Criteria

*   Dado um usuário admin autenticado, quando cria uma categoria válida, então a categoria aparece no painel e no cardápio público.
*   Dado um produto com preço, categoria e nome válidos, quando é salvo, então ele aparece na categoria correta.
*   Dado um produto inativo, quando o cardápio público é carregado, então o produto não aparece para compra.
*   Dado uma tentativa de acessar ou alterar produto de outro tenant, quando a requisição é executada, então o sistema bloqueia o acesso.

### US3: Digital Menu & Ordering (P1)

**Como** cliente final, **quero** acessar o cardápio, escolher produtos e finalizar o pedido, **para que** eu possa comprar sem depender de marketplace.

#### Acceptance Criteria

*   Dado um slug válido e loja aberta, quando o cliente acessa o cardápio, então vê categorias e produtos ativos.
*   Dado itens no carrinho, quando o cliente informa dados obrigatórios e confirma, então um pedido é criado.
*   Dado loja fechada, quando o cliente tenta finalizar o pedido, então o checkout é bloqueado.
*   Dado um produto que ficou inativo antes do checkout, quando o cliente confirma o pedido, então o sistema rejeita o item e pede revisão do carrinho.
*   Dado um pedido criado, quando a confirmação é exibida, então há um link de WhatsApp com resumo do pedido.

### US4: Order Management Dashboard (P1)

**Como** operador de cozinha, **quero** ver novos pedidos em tempo real e alterar seus status, **para que** eu organize produção e entrega.

#### Acceptance Criteria

*   Dado um novo pedido, quando ele é criado, então aparece no painel admin do tenant correto.
*   Dado um pedido pendente, quando o operador altera para em preparo, então o status é persistido.
*   Dado um pedido de outro tenant, quando o operador acessa a fila, então ele não aparece.
*   Dado um novo pedido recebido em tempo real, quando o painel está aberto, então um alerta visual e sonoro é disparado.
*   Dado pedidos em um período, quando o admin abre o resumo, então vê quantidade de pedidos e receita bruta.

## Functional Requirements

### 1. Multi-Tenant Core

*   Todos os dados operacionais devem possuir `tenant_id`.
*   Slugs devem ser únicos e imutáveis no MVP.
*   Rotas públicas resolvem tenant pelo slug.
*   Rotas admin resolvem tenant pelo JWT do usuário autenticado.
*   Nenhuma query admin pode retornar dados de outro tenant.

### 2. Cardápio Digital

*   Listagem de produtos ativos por categoria ativa.
*   Carrinho local persistido no navegador.
*   Seleção de método de entrega: delivery ou retirada.
*   Seleção de método de pagamento: dinheiro, PIX manual ou cartão na entrega.
*   Checkout com nome, telefone e, quando delivery, endereço.

### 3. Painel Admin

*   CRUD de categorias e produtos.
*   Fila de pedidos por status.
*   Som de alerta para novos pedidos.
*   Alteração de status do pedido.
*   Resumo financeiro básico por período.

### 4. Integração WhatsApp

*   Geração de deep link `wa.me` com resumo do pedido.
*   O link deve incluir loja, itens, total, cliente, entrega/retirada e forma de pagamento.
*   Não há integração com WhatsApp Cloud API no MVP.

## Non-Functional Requirements

*   **Responsividade**: O cardápio deve ser mobile first.
*   **Performance**: O cardápio público deve carregar em menos de 2s em conexão 4G comum.
*   **Disponibilidade**: Cardápio público deve usar cache curto por slug e exibir estado amigável em timeout ou erro.
*   **Acessibilidade**: Fluxos principais devem ser navegáveis por teclado e ter contraste adequado.
*   **Observability**: Erros de API, criação de pedidos e falhas de tenant resolution devem gerar logs estruturados.

## Business Rules

*   A loja deve estar aberta e ativa para aceitar pedidos.
*   Produtos inativos não aparecem no cardápio público.
*   Categorias inativas não aparecem no cardápio público.
*   O slug da loja não pode ser alterado após a criação no MVP.
*   Pedido só pode ser criado com pelo menos um item válido.
*   O total do pedido deve ser calculado no servidor, não confiado ao cliente.
*   Status permitido: `PENDING`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`.
*   Transições mínimas permitidas: `PENDING -> PREPARING -> SHIPPED -> DELIVERED`; qualquer status não final pode ir para `CANCELLED`.

## Edge Cases

*   Cliente tenta fechar pedido com a loja fechada.
*   Produto acaba ou é desativado durante o checkout.
*   Tentativa de acesso a slug inexistente.
*   Usuário admin tenta acessar dados de outro tenant.
*   Pedido é recebido enquanto o painel está desconectado do websocket.
*   Imagem de produto falha ao carregar.
*   Banco ou API demora a responder no cardápio público.

## Success Metrics

*   Primeiro tenant consegue operar o fluxo completo em produção.
*   Cardápio inicial criado em menos de 20 minutos.
*   Cliente consegue enviar pedido em até 5 etapas principais.
*   Zero vazamento conhecido de dados entre tenants.
*   Fluxo Register -> Create Menu -> Place Order -> Complete Order coberto por E2E.
