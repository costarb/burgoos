# Implementation Plan: Importação exclusiva de vendas do Mercado Pago

**Branch**: `019-mercado-pago-sales-only` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-mercado-pago-sales-only/spec.md`

## Summary

Impedir que movimentos de conta do Mercado Pago sejam convertidos em pedidos. A busca passa a solicitar somente pagamentos aprovados para reduzir volume, enquanto uma classificação defensiva central exige `operation_type` comercial (`regular_payment`, `pos_payment` ou `recurring_payment`) antes de produzir `SALE`. Transferências, tipos ausentes/desconhecidos e demais operações tornam-se `NON_SALE` sem retry. O mesmo mapper atende importação, reconciliação e webhook, garantindo comportamento uniforme e fail-closed.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Prisma, PostgreSQL, API REST do Mercado Pago

**Storage**: PostgreSQL existente; nenhuma migração de schema prevista

**Testing**: Vitest para mapper, client, adapter, reconciliação e webhook

**Target Platform**: API NestJS executada em Linux e desenvolvimento Windows

**Project Type**: Monorepo web; alteração concentrada no módulo de integrações de vendas da API

**Performance Goals**: classificar 100% dos movimentos em uma passagem; reduzir movimentos baixados ao filtrar `approved`; manter paginação completa mesmo quando páginas não contêm vendas elegíveis

**Constraints**: classificação fail-closed; não excluir vendas por meio de pagamento; idempotência existente; sem exclusão automática de pedidos históricos; nenhuma credencial ou dado sensível adicional em logs

**Scale/Scope**: sincronizações de até 365 dias, páginas de até 100 pagamentos, além de reconciliação e webhooks das conexões Mercado Pago ativas

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Real Operation First**: Pass. Corrige diretamente pedidos e faturamento do piloto sem generalizar o domínio.
- **TypeScript Strict By Default**: Pass. O contrato externo recebe união explícita dos tipos conhecidos e trata valores futuros como desconhecidos.
- **Modular Monolith, Domain-Oriented**: Pass. A regra permanece no módulo proprietário de integrações de vendas.
- **Tenant Isolation Is A Design Constraint**: Pass. Nenhuma consulta multi-tenant nova; fluxos existentes mantêm `tenantId` e conexão.
- **Tests Protect Operational Flow**: Pass. Mapper, busca, adapter, reconciliação e webhook terão cenários comerciais e não comerciais.
- **Quality Gates**: Pass for planning. Spec e design são explícitos; `tasks.md` será criado antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/019-mercado-pago-sales-only/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- mercado-pago-payment-classification.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/api/src/management/sales-integrations/
|-- mercado-pago/
|   |-- __fixtures__/mercado-pago.fixtures.ts
|   |-- mercado-pago.types.ts
|   |-- mercado-pago.client.ts
|   |-- mercado-pago.client.spec.ts
|   |-- mercado-pago.mapper.ts
|   |-- mercado-pago.mapper.spec.ts
|   |-- mercado-pago-sales-provider.adapter.ts
|   |-- mercado-pago-sales-provider.adapter.spec.ts
|   |-- mercado-pago-reconciliation.service.ts
|   |-- mercado-pago-reconciliation.service.spec.ts
|   |-- mercado-pago-webhook.service.ts
|   `-- mercado-pago-webhook.service.spec.ts
|-- sales-import-preview.service.ts
`-- provider-transaction-state.service.ts
```

**Structure Decision**: manter uma única política de elegibilidade no mapper Mercado Pago, o ponto já compartilhado por preview/importação, reconciliação e webhook. O client reduz tráfego com filtro de status, mas não se torna a única barreira porque respostas individuais de webhook não passam pela busca.

## Design

### Classificação defensiva

1. Validar `operation_type` antes dos campos comerciais.
2. Aceitar somente `regular_payment`, `pos_payment` e `recurring_payment`.
3. Mesmo dentro da allowlist, rejeitar pagamentos marcados como transferência entre contas do mesmo titular por `is_same_bank_account_owner=true`.
4. Classificar tipo ausente, desconhecido ou financeiro como `NON_SALE`, com código auditável `NON_SALE_OPERATION` e `sale: null`.
5. Para operação comercial, manter as validações existentes de `approved`, valor positivo, data e meio suportado.
6. Preservar `account_money` como `DIGITAL_WALLET`, pois o meio pode financiar uma venda válida.

### Data comercial

- O banco armazena `DateTime` como instante UTC em coluna sem fuso.
- Consultas de agrupamento diário devem primeiro interpretar a coluna como UTC e depois convertê-la para `America/Sao_Paulo`.
- A conversão evita que vendas noturnas de 13/08, armazenadas após `00:00Z` em 14/08, sejam agrupadas no dia seguinte.

### Busca e paginação

- Adicionar `status=approved` em `/v1/payments/search`.
- Não executar três buscas por `operation_type`: isso multiplicaria paginação, retry e deduplicação. A allowlist local é necessária de qualquer forma para webhook e compatibilidade defensiva.
- Continuar avançando pelo tamanho real da página do provedor, sem encerrar ao filtrar localmente.

### Auditoria e histórico

- Reutilizar `ProviderMovement.kind=NON_SALE` e `rejectionCode` para persistir a razão sem gerar pedido.
- O preview já contabiliza movimentos não comerciais; eles não são falhas retryable.
- Não alterar ou excluir pedidos históricos automaticamente. O payload bruto redigido preservado permite localizar `operation_type` inelegível para uma ação posterior controlada.

### Compatibility

- A mudança é intencionalmente fail-closed: payload legado/fixture sem `operation_type` deixa de ser importável até apresentar origem comercial.
- Nenhum endpoint público, DTO ou schema de banco muda.
- Tipos futuros do provedor ficam ignorados até revisão explícita e cobertura de teste.

## Test Strategy

- **Unit**: matriz aceita/rejeita de `operation_type`; status, valor, data e meios; redaction.
- **Client**: URL inclui `status=approved`; paginação e dedupe permanecem.
- **Adapter**: página mista preserva vendas e `NON_SALE`, inclusive página sem venda válida.
- **Reconciliation/Webhook**: operações financeiras chegam ao estado de transação como `NON_SALE` e não causam retry.
- **Regression**: suite do workspace API, typecheck, lint/diff check conforme scripts disponíveis.

## Constitution Check - Post Design

- **Real Operation First**: Pass. A política elimina falsos pedidos sem impactar checkout ou POS.
- **Strict Contracts**: Pass. Origem operacional e decisão estão tipadas e testáveis.
- **Modular Monolith**: Pass. Nenhum serviço ou banco adicional.
- **Tenant Isolation**: Pass. Persistência continua dentro dos serviços existentes e escopo da conexão.
- **Operational Tests**: Pass. Todos os caminhos de entrada usam o mesmo mapper e têm regressão planejada.
- **Scope Discipline**: Pass. Remediação destrutiva de histórico permanece fora desta entrega.

## Complexity Tracking

Nenhuma violação constitucional identificada.
