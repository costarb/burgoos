# Implementation Plan: Login e Gestao de Acessos por Loja

**Branch**: `006-financial-operations-ux` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-store-access-management/spec.md`

## Summary

Criar autenticacao administrativa, manutencao de usuarios, perfis de acesso, permissoes e auditoria, sempre respeitando o contexto de loja. A entrega adiciona um usuario master com controle global e permite que administradores de loja gerenciem usuarios e acessos somente dentro das lojas autorizadas. O desenho usa o monorepo existente, com controles de autorizacao no backend, telas administrativas no frontend e persistencia tenant-scoped.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, React Query, JWT com refresh token para usuarios administrativos

**Storage**: PostgreSQL via Prisma; usuarios, perfis, vinculos de loja, permissoes, sessoes/tokens e auditorias devem ser persistidos com escopo de tenant quando aplicavel

**Testing**: Vitest unit/integration tests para autenticacao, autorizacao, isolamento por tenant e regras de master/admin; Playwright E2E para login, troca de loja e manutencao de usuarios/perfis

**Target Platform**: Aplicacao web administrativa responsiva para usuario master, administradores de loja e usuarios operacionais

**Project Type**: Web app com backend API e frontend no monorepo existente

**Performance Goals**: Login e validacao de sessao concluem em ate 2 segundos no piloto; listas de usuarios/perfis respondem em ate 2 segundos com filtros basicos; feedback de operacao aparece em ate 300 ms

**Constraints**: Isolamento por tenant; nenhum admin de loja pode acessar outra loja; pelo menos um master ativo deve existir; credenciais nunca podem ser expostas; auditoria imutavel para eventos de acesso; rotas e acoes sensiveis devem validar permissao no servidor

**Scale/Scope**: Piloto com uma loja, mas pronto para multiplas lojas; dezenas de usuarios administrativos; dezenas de perfis/permissoes; acessos de backoffice e operacao diaria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. A feature protege a operacao administrativa real e permite delegar acessos sem bloquear o piloto.
- **TypeScript Strict By Default**: Pass. Contratos de autenticacao, usuario, perfil e permissao serao tipados entre API, frontend e testes.
- **Modular Monolith, Domain-Oriented**: Pass. Autenticacao e autorizacao entram como capacidade de Platform/Management dentro do monolito modular.
- **Tenant Isolation Is A Design Constraint**: Pass. Todo acesso administrativo resolve o tenant a partir do usuario autenticado e do contexto de loja permitido.
- **Tests Protect Operational Flow**: Pass. O plano exige testes para login, permissoes, master global, admin de loja e negacao cross-tenant.

## Project Structure

### Documentation (this feature)

```text
specs/007-store-access-management/
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
|   |   |-- auth/
|   |   |   |-- auth.controller.ts
|   |   |   |-- auth.service.ts
|   |   |   |-- guards/
|   |   |   |-- strategies/
|   |   |   `-- dto/
|   |   `-- management/
|   |       `-- access/
|   |           |-- users/
|   |           |-- profiles/
|   |           |-- permissions/
|   |           `-- access-audit.service.ts
|   `-- test/
|       |-- auth.spec.ts
|       |-- access-management.spec.ts
|       `-- access-tenant-isolation.e2e-spec.ts
`-- web/
    |-- app/
    |   |-- login/
    |   |   `-- page.tsx
    |   `-- admin/
    |       |-- users/
    |       |-- access-profiles/
    |       `-- access-audit/
    `-- components/admin/
        |-- store-switcher.tsx
        |-- access-denied.tsx
        `-- permission-gate.tsx

packages/
|-- database/
|   `-- prisma/
|-- types/
`-- ui/
```

**Structure Decision**: Preservar o monorepo e o monolito modular. Autenticacao fica em `apps/api/src/auth`; gestao de usuarios, perfis, permissoes e auditoria fica em `apps/api/src/management/access`; telas administrativas ficam sob `apps/web/app/admin`; primitivas compartilhadas e tipos continuam em `packages/types` e `packages/ui` quando fizer sentido.

## Phase 0: Research

Research is captured in [research.md](./research.md). Main decisions:

- Usar autenticacao administrativa com JWT e refresh token, alinhada a constituicao tecnica.
- Resolver tenant permitido a partir da sessao autenticada e de um contexto ativo de loja.
- Tratar `MASTER` como escopo global separado de perfis comuns de loja.
- Manter RBAC por perfis e permissoes, com permissoes agrupadas por area, tela e acao.
- Usar desativacao logica para usuarios, perfis e vinculos, preservando auditoria.
- Registrar auditoria imutavel para tentativas de login, alteracoes de acesso e negacoes relevantes.

## Phase 1: Design

Design outputs:

- Data model: [data-model.md](./data-model.md)
- API contract: [contracts/openapi.yaml](./contracts/openapi.yaml)
- Quickstart: [quickstart.md](./quickstart.md)

## Constitution Check - Post-Design

- **Real Operation First**: Pass. O quickstart valida login e gestao local de usuarios para operar o piloto com menos dependencia do master.
- **TypeScript Strict By Default**: Pass. O contrato explicita payloads, estados, permissoes e respostas de autenticacao.
- **Modular Monolith, Domain-Oriented**: Pass. O design nao cria servicos externos e mantem a autorizacao como modulo interno.
- **Tenant Isolation Is A Design Constraint**: Pass. Modelo de dados e contratos exigem storeId/tenant scope somente quando o ator tem autoridade sobre a loja.
- **Tests Protect Operational Flow**: Pass. O design cobre negacao cross-tenant, ultimo master ativo, troca de loja e auditoria de eventos criticos.

## Complexity Tracking

No constitution violations.
