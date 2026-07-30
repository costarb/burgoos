# Implementation Plan: PDV, Comandas e KDS Omnicanal

**Branch**: `016-pos-kds-commands` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-pos-kds-commands/spec.md`

## Summary

Evoluir o domínio de Ordering para suportar captura interna, personalização de itens, comandas opcionais e um ciclo de produção adequado a balcão, retirada e delivery. Introduzir um domínio de Payments separado do pedido, com cobrança automática pela Mercado Pago Point Orders API, confirmação manual PagBank/Caixa local, idempotência, webhook, reconciliação e auditoria. Reorganizar a tela atual de pedidos como KDS omnicanal e expor uma fila pública segura por loja. Entregar em fatias verticais, mantendo cardápio público e iFood compatíveis.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, Socket.io, React Query, class-validator

**Storage**: PostgreSQL via Prisma; tokens Mercado Pago continuam no armazenamento criptografado existente

**Testing**: Vitest, Supertest, React Testing Library e Playwright para o fluxo operacional crítico

**Target Platform**: Aplicação web responsiva em Linux, usada em tablet/desktop no balcão, tela KDS e display público

**Project Type**: Monorepo web com API modular monolítica, frontend administrativo/público e contratos compartilhados

**Performance Goals**: captura simples em até 60 segundos; atualização operacional percebida em até 3 segundos; fila pública em até 5 segundos; reconexão em até 10 segundos

**Constraints**: isolamento por tenant; total calculado no servidor; ações financeiras idempotentes; pedido, produção, comanda e pagamento com ciclos separados; sem dependência de webhook como única fonte; compatibilidade com pedidos existentes

**Scale/Scope**: piloto em um food truck, preparado para dezenas de lojas, até 10 terminais por loja, 20 operadores simultâneos, 500 pedidos/dia por loja e 100 comandas abertas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. A feature foi promovida explicitamente para validar a operação real do Dogão do Mounjaro e será entregue em fatias pilotáveis.
- **TypeScript Strict By Default**: Pass. Novos estados, comandos, cobranças, eventos e contratos serão tipos explícitos; payloads externos serão validados e normalizados.
- **Modular Monolith, Domain-Oriented**: Pass. Ordering, Payments, Catalog, Access e Customer Experience permanecem módulos do monólito, comunicando-se por serviços e eventos internos.
- **Tenant Isolation Is A Design Constraint**: Pass. Todas as novas entidades pertencem a um tenant; tokens e terminais são resolvidos pela conexão da loja, nunca pelo frontend.
- **Tests Protect Operational Flow**: Pass. O plano exige E2E de captura até KDS, pagamento automático/manual, duplicidade, falha, comanda e isolamento.
- **MVP Scope Promotion**: Pass with explicit promotion. POS/comandas/pagamento estavam deferidos na constituição, mas a nova spec os promove para o próximo marco sem incluir fiscal, caixa completo ou impressão.
- **Quality Gates**: Pass for planning. Spec e checklist existem; este plano cria modelo e contratos explícitos. `tasks.md` permanece obrigatório antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/016-pos-kds-commands/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- pos-kds-payments.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   `-- src/
|       |-- catalog/
|       |-- ordering/
|       |   |-- counter-sales/
|       |   |-- tabs/
|       |   `-- kds/
|       |-- payments/
|       |   |-- application/
|       |   |-- mercado-pago-point/
|       |   |-- manual/
|       |   `-- webhooks/
|       |-- management/access/
|       `-- customer-experience/order-queue/
|-- web/
|   `-- app/
|       |-- admin/pos/
|       |-- admin/orders/
|       |-- admin/tabs/
|       |-- admin/payment-exceptions/
|       `-- (public-menu)/fila/
packages/
|-- database/prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- types/src/
```

**Structure Decision**: manter o monólito e o `Order` existente como núcleo produtivo. `ordering` recebe captura, comandas e KDS; `payments` passa a possuir tentativas, pagamentos, terminais e eventos. A integração atual de consulta de vendas Mercado Pago permanece em Sales Integrations, enquanto Point usa a mesma conexão/credencial por meio de um serviço autenticado compartilhado.

## Architecture and Delivery Strategy

### State separation

```text
ServiceTab.status
OPEN -> CHECKOUT_PENDING -> PAID
  |            |
  +----------> OPEN (authorized reopen)
  +----------> CANCELLED

Order.status
PENDING -> PREPARING -> READY -> DELIVERED
                         |
                         +-> SHIPPED -> DELIVERED (delivery only)
Any non-terminal state -> CANCELLED (permission and reason rules apply)

PaymentCharge.status
CREATED -> WAITING_CUSTOMER -> PROCESSING -> APPROVED
   |              |              |
   +--------------+--------------+-> DECLINED | CANCELLED | EXPIRED | FAILED | UNKNOWN
APPROVED -> PARTIALLY_REFUNDED -> REFUNDED
```

`Order.status` continua sendo o campo produtivo existente. `PENDING` passa a ser apresentado como “Recebido”; adiciona-se `READY`; `SHIPPED` aparece somente para delivery. A situação de pagamento exibida no pedido é uma projeção derivada das alocações válidas, não uma transição do KDS.

### Delivery increments

1. **Foundation**: estados, origem, código público, snapshots de item, permissões e eventos operacionais.
2. **Counter capture**: catálogo operacional, personalizações, preço calculado/manual e pedido avulso.
3. **KDS omnichannel**: fluxo por fulfillment, origem, prioridade e recuperação após reconexão.
4. **Manual payments**: instituição/meio separados, PagBank manual, dinheiro/troco e auditoria.
5. **Service tabs**: comandas, múltiplos pedidos, responsabilidade e fechamento integral.
6. **Mercado Pago Point**: terminais, Orders API, webhook, consulta, cancelamento e reconciliação.
7. **Public queue and exceptions**: `/fila`, painel financeiro e encerramento de turno.

Cada incremento deve ser utilizável sem depender do seguinte. Mercado Pago Point não bloqueia a estreia da captura e do KDS.

## API and Integration Design

- Admin resolve `tenantId` e usuário exclusivamente do JWT.
- Rotas mutáveis recebem `Idempotency-Key` e/ou `expectedVersion`.
- Totais e personalizações são recalculados contra catálogo/ficha técnica no servidor.
- `external_reference` Mercado Pago usa identificador estável sem dados pessoais e com até 64 caracteres.
- A criação Point usa uma única transação, terminal habilitado e a chave idempotente persistida antes da chamada externa.
- Webhook valida assinatura, persiste envelope único, responde rapidamente e agenda processamento.
- O processador consulta a order no Mercado Pago antes de mapear o estado interno.
- Um reconciliador consulta cobranças `UNKNOWN`, `WAITING_CUSTOMER` ou `PROCESSING` vencidas.
- O endpoint público de fila resolve tenant por slug/domínio existente e retorna apenas a projeção sanitizada.
- Socket.io exige token administrativo para salas privadas; a fila pública usa canal sanitizado ou revalidação curta.

## Authorization Design

Novas permissões:

```text
pos.capture
pos.override-price
tabs.view
tabs.manage
kds.view
kds.manage
payments.charge
payments.confirm-manual
payments.cancel
payments.refund
payments.reconcile
payment-terminals.manage
payment-exceptions.view
```

Perfil padrão `Atendente`:

```text
pos.capture
tabs.view
tabs.manage
orders.view
orders.manage
kds.view
kds.manage
payments.charge
payments.confirm-manual
```

`pos.override-price`, cancelamento, estorno, reconciliação e configuração de terminais não entram no perfil base.

## Observability and Operations

- Logs estruturados por `tenantId`, `orderId`, `tabId`, `chargeId`, `providerOrderId`, terminal e resultado, sem tokens ou payloads de cartão.
- Métricas de tempo de fila, tempo de preparo, cobranças por estado, atraso de webhook, reconciliações e comandas abertas.
- Alertas para webhook inválido recorrente, cobrança desconhecida acima do limite, dupla aprovação, token inválido e comanda aberta no fechamento.
- Payload bruto externo deve ser redigido e armazenado somente quando necessário para auditoria técnica.

## Migration and Compatibility

- Migrações são aditivas; novas colunas do `Order` começam opcionais ou com defaults compatíveis.
- Pedidos históricos recebem `source=LEGACY` e não exigem comanda, código público ou cobrança.
- `PENDING`, `PREPARING`, `SHIPPED`, `DELIVERED` e `CANCELLED` são preservados; apenas `READY` é adicionado.
- O checkout público atual continua usando o contrato existente; a normalização preenche origem e código no servidor.
- iFood continua sincronizando seus estados, com mapeamento explícito para `READY/SHIPPED` conforme modalidade.
- Pagamentos importados existentes não são convertidos automaticamente em cobranças Point.

## Constitution Check - Post Design

- **Real Operation First**: Pass. A ordem de entrega começa por captura/KDS/manual e deixa a dependência Point para uma fatia isolada.
- **Strict Contracts**: Pass. OpenAPI, entidades, estados e regras de idempotência estão definidos.
- **Modular Monolith**: Pass. Não há novo serviço implantável nem broker obrigatório.
- **Tenant Isolation**: Pass. Todas as chaves únicas sensíveis incluem tenant ou conexão; testes de duas lojas são obrigatórios.
- **Operational Tests**: Pass. Quickstart define cenários felizes, alternativos, concorrência, reconexão e segurança.
- **Scope Discipline**: Pass. Fiscal, caixa completo, PagBank automático, salão completo e offline integral permanecem fora.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Promoção de POS/comandas/pagamento antes deferidos | A operação real do piloto agora exige captura presencial e fechamento posterior | Tratar tudo como um único pedido pago impediria consumo incremental, misturaria cozinha com financeiro e não representaria o food truck |
