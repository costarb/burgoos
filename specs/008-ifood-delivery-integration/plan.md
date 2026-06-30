# Implementation Plan: iFood Delivery Integration

**Branch**: `008-ifood-delivery-integration` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-ifood-delivery-integration/spec.md`

## Summary

Integrar plataformas de delivery ao fluxo operacional, iniciando pelo iFood. A entrega adiciona configuracao por loja, armazenamento seguro de credenciais, validacao de merchant, ingestao de eventos iFood por polling, criacao idempotente de pedidos internos, aceite/recusa com SLA, sincronizacao de status, cancelamentos, alteracoes, disputas e visao de saude/homologacao. A arquitetura permanece como monolito modular: um dominio de integracoes desacoplado dos adaptadores de plataforma, reaproveitando `Order`, `OrderItem` e `OrderPlatform` para que futuras plataformas sigam o mesmo contrato interno.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, JWT com refresh token para administracao, Socket.io para atualizacoes da fila de pedidos

**Storage**: PostgreSQL via Prisma; configuracoes, credenciais, eventos, pedidos vinculados, tentativas de sincronizacao e auditoria devem ser tenant-scoped

**Testing**: Vitest unit/integration tests para adaptador iFood, token lifecycle, idempotencia, tenant isolation, order mapping e status workflow; Playwright E2E para configuracao da loja, captura simulada de pedido e aceite/status na fila admin

**Target Platform**: Aplicacao web administrativa responsiva e backend API/worker no monorepo existente

**Project Type**: Web app com backend API NestJS, frontend Next.js e worker/scheduler interno para polling

**Performance Goals**: Polling iFood respeita intervalo minimo de 30 segundos; 95% dos pedidos disponiveis aparecem na fila interna em ate 60 segundos; status outbound e alertas aparecem em ate 30 segundos sob condicoes normais; telas administrativas respondem em ate 2 segundos no piloto

**Constraints**: Isolamento por tenant; segredos nunca expostos; ACK de evento somente apos persistencia segura; confirmacao iFood antes da janela de 8 minutos; polling/rate limits por loja; homologacao iFood antes de producao; marketplace integration foi promovida por esta spec e deve continuar limitada ao piloto

**Scale/Scope**: Loja piloto inicialmente; dezenas de pedidos/dia; desenho suporta multiplas lojas e multiplas plataformas; webhooks ficam como extensao planejada para maior volume, sem bloquear a primeira release

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Embora marketplace integrations estejam listadas como deferidas no MVP original, esta feature promove explicitamente iFood para atender a operacao real da loja piloto e reduzir retrabalho manual de pedidos.
- **TypeScript Strict By Default**: Pass. Adaptadores, payloads normalizados, contratos REST, DTOs e estados de sincronizacao serao explicitamente tipados.
- **Modular Monolith, Domain-Oriented**: Pass. A feature entra como dominio de Management/Integrations e compoe Ordering, sem criar microservico separado.
- **Tenant Isolation Is A Design Constraint**: Pass. Toda configuracao, credencial, evento, pedido vinculado, tentativa de sincronizacao e auditoria carrega `tenantId` e valida o tenant da sessao.
- **Tests Protect Operational Flow**: Pass. O plano exige testes para idempotencia, isolamento por loja, deadline de confirmacao, ACK seguro, status/cancelamento e fluxo E2E de pedido iFood simulado.

## Project Structure

### Documentation (this feature)

```text
specs/008-ifood-delivery-integration/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   |-- src/
|   |   |-- management/
|   |   |   `-- integrations/
|   |   |       |-- delivery-integrations.controller.ts
|   |   |       |-- delivery-integrations.service.ts
|   |   |       |-- delivery-integration-health.service.ts
|   |   |       |-- dto/
|   |   |       `-- ifood/
|   |   |           |-- ifood-auth.service.ts
|   |   |           |-- ifood-client.ts
|   |   |           |-- ifood-event-poller.service.ts
|   |   |           |-- ifood-order-mapper.ts
|   |   |           `-- ifood-status-sync.service.ts
|   |   |-- ordering/
|   |   |   |-- external-order-ingestion.service.ts
|   |   |   `-- ordering.service.ts
|   |   `-- platform/
|   |       `-- database/
|   `-- test/
|       |-- delivery-integration.spec.ts
|       |-- ifood-event-processing.spec.ts
|       `-- ifood-tenant-isolation.e2e-spec.ts
`-- web/
    |-- app/
    |   `-- admin/
    |       |-- integrations/
    |       |   `-- delivery/
    |       |       |-- page.tsx
    |       |       `-- delivery-integrations-client.tsx
    |       `-- orders/
    |           `-- orders-client.tsx
    `-- components/
        `-- admin/
            `-- integration-health-badge.tsx

packages/
|-- database/
|   `-- prisma/
|-- types/
`-- ui/
```

**Structure Decision**: Preservar o monorepo e o monolito modular. Configuracao, saude e auditoria da integracao ficam em `management/integrations`; processamento de pedidos externos entra por um servico de ingestao em `ordering`, reaproveitando o workflow e eventos da fila atual; detalhes de protocolo iFood ficam isolados em `management/integrations/ifood` atras de interfaces provider-neutral.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Usar modelo provider-neutral com adaptador iFood.
- Iniciar ingestao iFood por polling a cada 30 segundos, mantendo webhooks como extensao futura.
- Persistir eventos antes de mutar pedidos e ACK somente apos processamento duravel.
- Tratar deadline de confirmacao iFood como dado operacional de primeira classe.
- Gerenciar tokens com base em `expiresIn`/metadados do provedor, sem tempos fixos hardcoded.
- Validar merchant/status da loja e refletir propagacao de permissoes na saude da integracao.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. O quickstart valida configuracao da loja piloto, polling simulado, pedido na fila, aceite e sincronizacao sem depender de escopo multi-plataforma completo.
- **TypeScript Strict By Default**: Pass. Contratos e modelo definem estados, enums, payloads normalizados e fronteiras entre adaptador iFood e dominio interno.
- **Modular Monolith, Domain-Oriented**: Pass. O design adiciona modulo interno e adaptador, sem novo deployable.
- **Tenant Isolation Is A Design Constraint**: Pass. Modelo de dados e contratos exigem `tenantId`/store context em todas as operacoes administrativas e eventos.
- **Tests Protect Operational Flow**: Pass. Design cobre pedido importado, ACK, SLA, cancelamento, status, token expirado, merchant invalido e negacao cross-tenant.

## Complexity Tracking

No constitution violations.
