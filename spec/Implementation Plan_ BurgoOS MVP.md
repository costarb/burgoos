# Implementation Plan: BurgoOS MVP

**Status**: Ready | **Date**: 2026-05-13
**Input**: Specification from `./Specification_ BurgoOS MVP.md`

## Summary

Implementar a infraestrutura multi-tenant básica e o fluxo core de pedidos: cadastro da loja, gestão de cardápio, pedido pelo cliente, notificação em tempo real e gestão operacional no painel.

## Technical Context

*   **Language**: TypeScript (Node.js 20+)
*   **Backend**: NestJS
*   **Frontend**: Next.js 14+ (App Router)
*   **ORM**: Prisma
*   **Database**: PostgreSQL
*   **Real-time**: Socket.io
*   **Storage**: S3 compatível para imagens de produtos
*   **Auth**: JWT com refresh token
*   **Package Management**: definir na inicialização do monorepo e manter consistente

## Project Structure

```text
burgoos-monorepo/
├── apps/
│   ├── api/                # NestJS Backend
│   └── web/                # Next.js Frontend (Customer & Admin)
├── packages/
│   ├── database/           # Prisma Schema & Client
│   ├── ui/                 # Shared UI Components (Tailwind)
│   └── types/              # Shared TS Interfaces
└── spec/                   # SDD Documentation
```

## Domain Boundaries

*   **Platform**: tenants, users, auth, tenant resolution, RBAC.
*   **Customer Experience**: public menu, cart, checkout, WhatsApp link.
*   **Operations**: order queue, status transitions, realtime notifications.
*   **Management**: basic revenue summary and order history.

## Tenant Resolution Strategy

### Public Routes

*   Public menu routes resolve the tenant by path slug, for example `/{slug}` or `/loja/{slug}`.
*   The backend must validate that the tenant exists and is active before returning public catalog data.
*   Public catalog responses may be cached for a short TTL by slug.

### Admin Routes

*   Admin routes resolve the tenant from the authenticated user JWT/session.
*   The client must not send arbitrary `tenant_id` for admin operations.
*   API services must use tenant-aware repository/service methods.

### Isolation Rules

*   All tenant-owned tables must include `tenant_id`.
*   All admin queries must be scoped by the authenticated tenant.
*   Public order creation must derive `tenant_id` from the resolved slug.
*   Cross-tenant access attempts must return `403` or `404` without leaking resource existence.
*   Tenant isolation must have automated tests.

## Data Model

### Tenant

*   `id`: UUID
*   `name`: String
*   `slug`: String (unique, immutable in MVP)
*   `phone`: String
*   `active`: Boolean
*   `is_open`: Boolean
*   `config`: JSON (opening hours, delivery settings, PIX instructions, colors)
*   `created_at`: DateTime
*   `updated_at`: DateTime

### User

*   `id`: UUID
*   `tenant_id`: FK
*   `role`: Enum (`OWNER`, `ADMIN`, `OPERATOR`)
*   `name`: String
*   `email`: String (unique)
*   `password_hash`: String
*   `created_at`: DateTime
*   `updated_at`: DateTime

### Category

*   `id`: UUID
*   `tenant_id`: FK
*   `name`: String
*   `sort_order`: Int
*   `active`: Boolean
*   `created_at`: DateTime
*   `updated_at`: DateTime

### Product

*   `id`: UUID
*   `tenant_id`: FK
*   `category_id`: FK
*   `name`: String
*   `description`: String
*   `price`: Decimal
*   `image_url`: String nullable
*   `active`: Boolean
*   `created_at`: DateTime
*   `updated_at`: DateTime

### Order

*   `id`: UUID
*   `tenant_id`: FK
*   `status`: Enum (`PENDING`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
*   `total`: Decimal
*   `customer_name`: String
*   `customer_phone`: String
*   `fulfillment_method`: Enum (`DELIVERY`, `PICKUP`)
*   `delivery_address`: JSON nullable
*   `payment_method`: Enum (`CASH`, `PIX_MANUAL`, `CARD_ON_DELIVERY`)
*   `notes`: String nullable
*   `created_at`: DateTime
*   `updated_at`: DateTime

### OrderItem

*   `id`: UUID
*   `tenant_id`: FK
*   `order_id`: FK
*   `product_id`: FK
*   `product_name_snapshot`: String
*   `quantity`: Int
*   `unit_price`: Decimal
*   `total`: Decimal

### Deferred Models

`Addon`, `Coupon`, `Customer`, `DeliveryDriver`, `PaymentTransaction` and advanced financial entities are post-MVP unless a later specification promotes them.

## API Surface

### Public

*   `GET /public/tenants/:slug/menu`
*   `POST /public/tenants/:slug/orders`

### Auth & Platform

*   `POST /auth/register`
*   `POST /auth/login`
*   `POST /auth/refresh`
*   `GET /me`

### Admin

*   `GET /admin/tenant`
*   `PATCH /admin/tenant`
*   `GET /admin/categories`
*   `POST /admin/categories`
*   `PATCH /admin/categories/:id`
*   `DELETE /admin/categories/:id`
*   `GET /admin/products`
*   `POST /admin/products`
*   `PATCH /admin/products/:id`
*   `DELETE /admin/products/:id`
*   `GET /admin/orders`
*   `PATCH /admin/orders/:id/status`
*   `GET /admin/reports/basic-summary`

## Implementation Phases

### Phase 1: Setup & Shared Database

*   Inicializar monorepo.
*   Configurar TypeScript strict, ESLint e Prettier.
*   Configurar Prisma e PostgreSQL.
*   Criar schema inicial e migrations.

### Phase 2: Platform & Multi-Tenancy

*   Implementar Tenant, User, Auth e RBAC básico.
*   Implementar tenant context para rotas públicas e admin.
*   Criar testes de isolamento por tenant.

### Phase 3: Catalog

*   Implementar CRUD de categorias e produtos.
*   Implementar upload de imagem.
*   Construir telas admin de categorias e produtos.

### Phase 4: Public Menu & Checkout

*   Implementar página pública por slug.
*   Implementar carrinho local.
*   Implementar checkout e criação de pedido.
*   Gerar link de WhatsApp na confirmação.

### Phase 5: Operations Dashboard

*   Implementar fila de pedidos.
*   Implementar transições de status.
*   Configurar Socket.io.
*   Adicionar alerta visual e sonoro.
*   Implementar resumo financeiro básico.

### Phase 6: Hardening & Launch

*   Adicionar E2E do fluxo crítico.
*   Configurar CI.
*   Configurar deploy.
*   Validar performance mobile do cardápio.

## Testing Strategy

### Unit Tests

*   Cálculo de total do pedido.
*   Validação de transições de status.
*   Geração de mensagem/link WhatsApp.
*   Regras de loja aberta/fechada.

### Integration Tests

*   Criação de tenant e usuário admin.
*   CRUD de catálogo com isolamento por tenant.
*   Criação de pedido por slug público.
*   Bloqueio de acesso cross-tenant.
*   Atualização de status de pedido.

### E2E Tests

*   Register -> Create Menu -> Open Public Menu -> Place Order -> Update Order Status.
*   Produto inativo não aparece no cardápio.
*   Loja fechada bloqueia checkout.

## ADRs (Architectural Decision Records)

### ADR-001: Shared Database Strategy

**Decision**: Usar um único banco de dados com `tenant_id` em todas as tabelas de domínio.

**Rationale**: Menor custo operacional e manutenção mais simples para centenas de pequenos lojistas.

### ADR-002: Next.js Monorepo

**Decision**: Usar monorepo para API, web e pacotes compartilhados.

**Rationale**: Facilita compartilhamento de tipos, componentes e contratos entre admin, cardápio público e backend.

### ADR-003: Addons Deferred

**Decision**: Não implementar adicionais/complementos no MVP.

**Rationale**: Adicionais aumentam a complexidade do carrinho, precificação, snapshots de pedido e UI. O MVP deve validar o fluxo base antes.

### ADR-004: Manual PIX In MVP

**Decision**: PIX no MVP será apenas informativo/manual, sem conciliação ou QR Code dinâmico.

**Rationale**: Evita dependência de PSP e reduz risco regulatório/operacional na primeira entrega.

### ADR-005: Server-Side Order Total

**Decision**: O total do pedido será sempre recalculado no backend.

**Rationale**: Impede manipulação de preço pelo cliente e garante consistência com produtos ativos.
