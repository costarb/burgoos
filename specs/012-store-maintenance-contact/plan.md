# Implementation Plan: Manutencao de lojas e dados publicos

**Branch**: `main` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-store-maintenance-contact/spec.md`

## Summary

Evoluir a manutencao existente de lojas em `/platform/stores`, adicionando filtros, dados de endereco e links sociais, persistidos no `Tenant.config`, e expondo essas informacoes no footer do cardapio publico.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: NestJS, Next.js App Router, Prisma, PostgreSQL, TailwindCSS, JWT platform/admin auth

**Storage**: PostgreSQL via Prisma. Usar `Tenant.config` para dados estruturados de contato publico, evitando migracao inicial.

**Testing**: Typecheck de API e web; testes React/API existentes podem ser ampliados em iteracao posterior.

**Target Platform**: Aplicacao web administrativa e cardapio publico.

**Project Type**: Web app com backend API e frontend administrativo/publico.

**Performance Goals**: Cardapio publico deve continuar servindo HTML pequeno e nao embutir imagens base64.

**Constraints**: Preservar isolamento e permissoes de plataforma; nao excluir tenants fisicamente; manter slug unico e rotas reservadas bloqueadas.

**Scale/Scope**: Dezenas a centenas de lojas administradas pela plataforma.

## Constitution Check

- **Real Operation First**: Pass. Remove dependencia tecnica para criar/alterar tenants.
- **TypeScript Strict By Default**: Pass. Contratos compartilhados serao tipados.
- **Modular Monolith, Domain-Oriented**: Pass. Alteracao fica em Platform/Stores e Catalog/Public Menu.
- **Tenant Isolation Is A Design Constraint**: Pass. Endpoints de plataforma seguem guarda de plataforma; cardapio resolve por slug ativo.
- **Tests Protect Operational Flow**: Pass. Typecheck e validacao manual cobrem fluxo principal nesta entrega.

## Project Structure

### Documentation (this feature)

```text
specs/012-store-maintenance-contact/
|-- spec.md
|-- plan.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   `-- src/
|       |-- platform/stores/
|       `-- catalog/
|-- web/
|   |-- app/platform/stores/
|   |-- app/(public-menu)/[slug]/
|   `-- lib/api.ts
packages/
`-- types/src/index.ts
```

**Structure Decision**: Reaproveitar a tela e API de lojas ja existentes, ampliando contratos e formulario de detalhe.

## Data Model

- `Tenant.config.storeProfile.address`: endereco publico opcional.
- `Tenant.config.storeProfile.socialLinks`: links publicos opcionais.

## Complexity Tracking

No constitution violations.
