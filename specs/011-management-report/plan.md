# Implementation Plan: Relatorio Gerencial Consolidado

**Branch**: `011-management-report` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-management-report/spec.md`

## Summary

Criar uma tela administrativa de relatorio gerencial com filtro de periodo para reunir indicadores ja existentes de caixa, vendas e contas a pagar em uma unica visao executiva. A implementacao deve reaproveitar os services de caixa, vendas e contas a pagar, adicionar um agregador de relatorio gerencial, expor contrato compartilhado para frontend/backend e incluir exportacao PDF assincrona usando o mecanismo generico de export jobs e notificacoes ja existente.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, JWT admin auth, export job/notificacoes existentes

**Storage**: PostgreSQL via Prisma. A feature nao exige novas tabelas para o relatorio em tela; reutiliza dados de pedidos, movimentacoes financeiras, contas financeiras, contas a pagar, pagamentos e jobs de exportacao existentes.

**Testing**: Vitest para service/controller de relatorio gerencial e provider de exportacao; testes React para filtros, cards, graficos e exportacao; typecheck e lint dos workspaces afetados.

**Target Platform**: Aplicacao web administrativa responsiva com API NestJS no monorepo.

**Project Type**: Web app com backend API e frontend administrativo.

**Performance Goals**: Consulta mensal deve carregar em ate 2 segundos na base piloto; trimestre/ano deve permanecer utilizavel e priorizar agregacoes; solicitacao de PDF deve responder em ate 1 segundo e processar em segundo plano.

**Constraints**: Preservar isolamento por tenant; respeitar permissoes financeiras e de relatorios; manter definicoes identicas aos relatorios/telas de origem; nao duplicar regras financeiras; exportacao PDF deve usar snapshot do periodo solicitado; tela deve permanecer utilizavel quando uma secao nao tem dados.

**Scale/Scope**: Administracao financeira de um restaurante/operacao piloto; periodos usuais de mes, trimestre e ano; dezenas a milhares de pedidos/movimentacoes por periodo; foco em resumo executivo e agrupamentos, nao em listagens analiticas completas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. A feature reduz a comparacao manual entre telas e atende rotina real de fechamento mensal/trimestral.
- **TypeScript Strict By Default**: Pass. Novos contratos compartilhados e DTOs devem ser tipados e validados.
- **Modular Monolith, Domain-Oriented**: Pass. A implementacao fica em Management/Reports e reaproveita dominios financeiros/vendas existentes.
- **Tenant Isolation Is A Design Constraint**: Pass. Todas as consultas resolvem `tenantId` pelo usuario autenticado.
- **Tests Protect Operational Flow**: Pass. O plano exige testes para consistencia de totais, filtro de periodo, exportacao e UI.

## Project Structure

### Documentation (this feature)

```text
specs/011-management-report/
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
|   |       |-- reports/
|   |       |   |-- management-report.controller.ts
|   |       |   |-- management-report.service.ts
|   |       |   |-- management-report.types.ts
|   |       |   `-- management-report.service.spec.ts
|   |       `-- exports/
|   |           `-- providers/
|   |               `-- management-report-export.provider.ts
|   `-- test/
|       `-- management-report.integration.spec.ts
|-- web/
|   |-- app/
|   |   `-- admin/
|   |       `-- reports/
|   |           `-- management/
|   |               |-- page.tsx
|   |               |-- management-report-client.tsx
|   |               `-- management-report-client.spec.tsx
|   `-- lib/
|       `-- api.ts
packages/
`-- types/
    `-- src/
        `-- index.ts
```

**Structure Decision**: Relatorio gerencial entra no dominio Management/Reports, reutilizando services de vendas, caixa e contas a pagar. A exportacao usa o modulo compartilhado de exports com um provider novo para `MANAGEMENT_REPORT`, sem criar novo mecanismo paralelo.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Usar agregador proprio para compor dados de caixa, vendas e contas a pagar.
- Reaproveitar services existentes como fonte de verdade dos calculos.
- Adicionar agrupamento de despesas por categoria dentro do agregador, pois a tela de contas a pagar atual nao expõe esse resumo.
- Reaproveitar export jobs e notificacoes para PDF assincrono.
- Criar PDF gerencial proprio, com secoes e narrativa, distinto do PDF tabular de contas a pagar.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. O design prioriza fechamento gerencial mensal/trimestral com dados ja usados pela operacao.
- **TypeScript Strict By Default**: Pass. Contratos de resposta e filtros sao explicitos.
- **Modular Monolith, Domain-Oriented**: Pass. Sem novo deployable ou microservico.
- **Tenant Isolation Is A Design Constraint**: Pass. Contratos e services exigem tenant autenticado.
- **Tests Protect Operational Flow**: Pass. Quickstart e tasks devem cobrir consistencia dos totais e exportacao.

## Complexity Tracking

No constitution violations.
