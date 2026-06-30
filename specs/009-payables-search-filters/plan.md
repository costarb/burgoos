# Implementation Plan: Filtros de Pesquisa em Contas a Pagar

**Branch**: `009-payables-search-filters` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-payables-search-filters/spec.md`

## Summary

Adicionar filtros de Categoria, Fornecedor e Mes de referencia na pesquisa de contas a pagar. A implementacao estende o fluxo financeiro existente: a API de contas a pagar ja recebe `categoryId` e `supplierId`, a tela ja carrega opcoes de categorias/fornecedores, e as contas ja possuem `competenceDate`. O plano centraliza a mudanca em expor esses filtros na UI, formalizar o contrato compartilhado, adicionar o filtro mensal por competencia e cobrir combinacoes/estado vazio em testes.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, JWT com refresh token para administracao

**Storage**: PostgreSQL via Prisma; `Payable` ja possui `tenantId`, `categoryId`, `supplierId`, `competenceDate` e indices por vencimento/categoria/fornecedor

**Testing**: Vitest unit/integration tests para DTO/service de contas a pagar; testes de interacao web em React/Next para filtros; validacao manual pelo quickstart

**Target Platform**: Aplicacao web administrativa responsiva e backend API NestJS no monorepo existente

**Project Type**: Web app com backend API NestJS e frontend Next.js

**Performance Goals**: Pesquisa filtrada de contas a pagar deve retornar e atualizar a tela em ate 2 segundos na base piloto; combinacoes comuns devem permanecer dentro dos indices tenant-scoped existentes ou de novo indice de competencia se necessario

**Constraints**: Preservar isolamento por tenant; nao alterar regras de cadastro, pagamento, cancelamento ou baixa; nao expor categorias/fornecedores fora do contexto do usuario; filtros novos devem compor com periodo de vencimento e status existentes

**Scale/Scope**: Tela administrativa de contas a pagar existente; dezenas a centenas de contas por mes no piloto, com desenho compativel com crescimento por tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. A feature reduz trabalho manual real do financeiro na tela ja usada para operacao.
- **TypeScript Strict By Default**: Pass. O plano exige contratos compartilhados e DTOs tipados para novos filtros.
- **Modular Monolith, Domain-Oriented**: Pass. A mudanca permanece no dominio Management/Financial, atravessando API, contratos e UI da mesma feature slice.
- **Tenant Isolation Is A Design Constraint**: Pass. Todos os filtros continuam resolvidos por `tenantId` do usuario autenticado; opcoes e resultados seguem contexto do tenant.
- **Tests Protect Operational Flow**: Pass. A pesquisa financeira sera coberta por testes de combinacao de filtros e estado vazio, sem mexer em pagamento/cancelamento.

## Project Structure

### Documentation (this feature)

```text
specs/009-payables-search-filters/
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
|   |   `-- management/
|   |       `-- financial/
|   |           |-- dto/
|   |           |   `-- payable.dto.ts
|   |           `-- accounts-payable/
|   |               |-- accounts-payable.controller.ts
|   |               |-- accounts-payable.service.ts
|   |               `-- accounts-payable.service.spec.ts
|   `-- test/
|       `-- accounts-payable.integration.spec.ts
`-- web/
    |-- app/
    |   `-- admin/
    |       `-- finance/
    |           `-- payables/
    |               |-- page.tsx
    |               |-- payables-client.tsx
    |               `-- payables-client.spec.tsx
    `-- lib/
        `-- api.ts

packages/
|-- database/
|   `-- prisma/
|       `-- schema.prisma
`-- types/
    `-- src/
        `-- index.ts
```

**Structure Decision**: Preservar o modulo financeiro existente. A API continua em `management/financial/accounts-payable`, os tipos compartilhados continuam em `packages/types`, e a tela permanece em `apps/web/app/admin/finance/payables`.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Representar o filtro de mes de referencia como `competenceMonth=YYYY-MM`, convertido para intervalo mensal sobre `Payable.competenceDate`.
- Reutilizar `categoryId` e `supplierId` ja existentes em DTO/API, apenas formalizando contrato compartilhado e expondo na UI.
- Manter periodo `start`/`end` como filtro de vencimento, sem reinterpretar esses campos como competencia.
- Continuar usando `/api/admin/financial/payables/options` para popular categorias e fornecedores ativos do tenant.
- Considerar indice por `tenantId, competenceDate` somente se validacao de volume indicar necessidade; para a base piloto, o filtro mensal sobre campo existente e suficiente.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. O quickstart valida o fluxo administrativo real de localizar contas por categoria, fornecedor e competencia.
- **TypeScript Strict By Default**: Pass. O design inclui `PayablesFilters` compartilhado e DTO validado para `competenceMonth`.
- **Modular Monolith, Domain-Oriented**: Pass. A feature permanece no modulo financeiro, sem novo deployable ou abstracao transversal desnecessaria.
- **Tenant Isolation Is A Design Constraint**: Pass. Contratos e modelo preservam tenant pelo contexto autenticado, sem query de tenant fornecida pelo cliente.
- **Tests Protect Operational Flow**: Pass. Testes planejados cobrem filtros individuais, combinados, limpeza e opcoes restritas ao tenant.

## Complexity Tracking

No constitution violations.
