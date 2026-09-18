# Implementation Plan: Paginação no Grid de Contas a Pagar

**Branch**: `022-payables-grid-pagination` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-payables-grid-pagination/spec.md`

## Summary

Hoje o grid de Contas a Pagar exibe apenas os primeiros registros retornados pela consulta (padrão de 50), porque a tela nunca envia `page`/`pageSize` nem oferece navegação, embora o backend (`AccountsPayableService.list`) já implemente paginação completa (`page`, `pageSize`, `total`). A solução é puramente de frontend: adicionar estado de página em `PayablesClient`, reaproveitar `refresh()` para buscar a página desejada, exibir "Página X de Y" com navegação anterior/próxima (mesmo padrão já usado em `sales-report-client.tsx`), reiniciar para a página 1 ao aplicar/limpar filtros, e ajustar automaticamente para uma página válida caso o total mude. Nenhuma migração de banco ou mudança de contrato de API é necessária.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: React 18, Next.js 14 App Router, TailwindCSS, NestJS, Prisma (backend inalterado)

**Storage**: PostgreSQL existente; nenhuma migração

**Testing**: Vitest + Testing Library (frontend), Jest (backend, sem novos casos previstos além de regressão)

**Target Platform**: Navegadores desktop/mobile modernos e API NestJS em Linux; desenvolvimento Windows

**Project Type**: Monorepo web com frontend Next.js, API NestJS e contratos TypeScript compartilhados

**Performance Goals**: navegação entre páginas percebida em até 1 segundo no volume operacional atual; consulta por página não deve degradar com o crescimento do total de registros (uso de `skip`/`take`/`OFFSET`/`LIMIT` já existente)

**Constraints**: preservar filtros aplicados durante a navegação; preservar cálculo de resumo financeiro sobre o total da consulta; não alterar contrato de exportação (continua operando sobre a consulta completa, não sobre a página); acessibilidade dos controles de navegação (foco, texto legível por leitor de tela)

**Scale/Scope**: uma tela (Contas a Pagar), sem impacto em outras telas; reaproveita padrão de paginação já existente no Relatório de Vendas apenas como referência de UX, sem compartilhar código diretamente (arquiteturas diferentes: client-state vs. `searchParams`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Real Operation First**: Pass. Corrige um problema real relatado no uso diário da tela de Contas a Pagar, sem expandir escopo além do necessário.
- **TypeScript Strict By Default**: Pass. Reaproveita tipos já existentes (`PayablesFilters`, `PayablesResponse`); nenhum `any` introduzido.
- **Modular Monolith, Domain-Oriented**: Pass. Mudança concentrada no módulo Management/Financial (frontend) e não requer novo domínio.
- **Tenant Isolation Is A Design Constraint**: Pass. `page`/`pageSize` não afetam o isolamento de tenant, que já é resolvido pelo backend (`tenantId` no `where`); nenhuma mudança nessa camada.
- **Tests Protect Operational Flow**: Pass. Navegação de página, reinício ao filtrar e consistência do resumo financeiro serão cobertos por testes automatizados.
- **Quality Gates**: Pass. `spec.md`, `plan.md` (este arquivo) e `tasks.md` (próxima etapa) serão explícitos antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/022-payables-grid-pagination/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── payables-query.md
├── checklists/requirements.md
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/app/admin/finance/payables/
├── payables-client.tsx        # adiciona estado de pagina, navegacao e reset em filtros
└── payables-client.spec.tsx   # novos casos: navegar, limites, reset ao filtrar, ajuste de pagina invalida

apps/web/lib/api.ts             # nenhuma mudanca de assinatura; page/pageSize ja suportados

packages/types/src/index.ts     # nenhuma mudanca; PayablesFilters/PayablesResponse ja tem page/pageSize/total
```

Backend (`apps/api/src/management/financial/accounts-payable/*`, `apps/api/src/management/financial/dto/payable.dto.ts`) **não é alterado** — apenas revalidado por testes de regressão já existentes.

**Structure Decision**: manter a paginação como estado local do Client Component `PayablesClient` (mesmo padrão já usado para `filters`), sem introduzir `searchParams`/Server Component como em `sales-report-client.tsx`. Isso evita reescrever `page.tsx` e o fluxo de `refresh()` já validado, mantendo o escopo restrito ao problema relatado.

## Design

### Estado e fluxo em `PayablesClient`

- Novo estado `page` (número, inicial `1`), mantido junto de `filters`.
- `refresh(nextFilters, nextPage)` passa a incluir `page: nextPage` (e `pageSize` padrão implícito) na chamada a `getPayables`.
- `applyFilters` e `clearFilters` chamam `refresh(nextFilters, 1)`, reiniciando a navegação.
- Novas funções `goToNextPage` / `goToPreviousPage` chamam `refresh(filters, page ± 1)` e atualizam `page` com o valor retornado pela resposta (`payables.page`), não apenas com o valor otimista, para refletir eventuais ajustes do backend.
- Após cada resposta, se `payables.page` for maior que `Math.ceil(payables.total / payables.pageSize)` (ex.: dados mudaram), a tela recalcula e busca a última página válida automaticamente.

### UI de navegação

- Bloco abaixo do grid (mesma seção `<section>` da lista), com:
  - Texto "Página {page} de {totalPages}" e "{total} registro(s) encontrado(s)".
  - Botões "Página anterior" e "Próxima página", desabilitados nos limites e durante `busy`.
  - Indicador de carregamento reaproveitando o estado `busy`/`OperationFeedback` já existente (sem novo componente de loading).
- Estado vazio (`payables.items.length === 0`) mantém a mensagem atual e oculta/desabilita a navegação.

### Resumo financeiro e exportação

- Nenhuma mudança: `summary` já vem calculado sobre a consulta completa; `requestPayablesExport` já envia `filters` (sem `page`) para o job assíncrono, então continua exportando o conjunto completo.

## Test Strategy

- **Componente (`payables-client.spec.tsx`)**:
  - Renderiza segunda página ao clicar em "Próxima página", enviando `page: 2` na chamada de `getPayables`.
  - Desabilita "Próxima página" na última página e "Página anterior" na primeira.
  - Reinicia para `page: 1` ao aplicar ou limpar filtros a partir de uma página diferente da primeira.
  - Mantém os valores de resumo financeiro inalterados entre páginas (usa o mock de resposta).
  - Ajusta automaticamente para a última página válida quando o backend retorna `page` maior que o total de páginas possível.
- **Regression**: suíte web existente (`payables-client.spec.tsx` atual), typecheck e lint. Backend permanece coberto pelos testes já existentes de `accounts-payable.service.spec.ts` (sem novos casos previstos, apenas confirmação de que nada quebrou).

## Constitution Check - Post Design

Todos os gates permanecem aprovados. O desenho não introduz banco, endpoint ou dependência nova; reaproveita contrato e padrão de UX já existentes, mantendo o escopo restrito à tela de Contas a Pagar.

## Complexity Tracking

Nenhuma violação constitucional identificada.
