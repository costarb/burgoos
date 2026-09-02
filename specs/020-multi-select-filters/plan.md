# Implementation Plan: Filtros com seleção múltipla

**Branch**: `020-multi-select-filters` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-multi-select-filters/spec.md`

## Summary

Criar um componente React controlado de filtro multisseleção, sem nova dependência, e validar sua adoção nos dois filtros de contas do Controle de Caixa. O contrato REST aceitará `financialAccountId` repetido, preservando chamadas antigas de valor único. A camada financeira trabalhará com conjuntos deduplicados e escopados ao tenant. O inventário separa filtros combináveis de selects de formulário; a expansão subsequente usará o mesmo componente e padrão de query somente quando a união de valores for semanticamente válida.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+

**Primary Dependencies**: React 18, Next.js 14 App Router, TailwindCSS, NestJS, Prisma

**Storage**: PostgreSQL existente; nenhuma migração

**Testing**: Vitest, Testing Library via DOM/jsdom existente, testes unitários de serviços e controladores

**Target Platform**: Navegadores desktop/mobile modernos e API NestJS em Linux; desenvolvimento Windows

**Project Type**: Monorepo web com frontend Next.js, API NestJS e contratos TypeScript compartilhados

**Performance Goals**: manter a aplicação do filtro perceptível em até 1 segundo no volume operacional atual; seleção local sem requisição por clique

**Constraints**: acessibilidade por teclado; compatibilidade com query singular; isolamento por tenant; sem dependência visual adicional; filtros pendentes não podem aparentar estar aplicados

**Scale/Scope**: componente compartilhado com seleção total, dois filtros de conta no Controle de Caixa, quatro filtros de Vendas, três filtros de Contas a Pagar e seus contratos de consulta/exportação

## Constitution Check

- **Real Operation First**: Pass. A entrega começa no fluxo financeiro real solicitado e só generaliza o componente necessário.
- **TypeScript Strict By Default**: Pass. Props, filtros e parâmetros múltiplos terão contratos explícitos e sem `any`.
- **Modular Monolith, Domain-Oriented**: Pass. UI compartilhada permanece no web e regras financeiras no módulo Management/Financial.
- **Tenant Isolation Is A Design Constraint**: Pass. IDs recebidos serão sempre combinados com `tenantId`; testes cobrirão conta externa.
- **Tests Protect Operational Flow**: Pass. Interação acessível e cálculo financeiro terão regressão automatizada.
- **Quality Gates**: Pass. Spec, plano, modelo e contratos são explícitos; tasks.md precederá código.

## Project Structure

### Documentation (this feature)

```text
specs/020-multi-select-filters/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- multi-select-filter.md
|   `-- cash-flow-query.md
|-- checklists/requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/web/components/admin/
|-- multi-select-filter.tsx
`-- multi-select-filter.spec.tsx
apps/web/app/admin/finance/cash-flow/
|-- cash-flow-client.tsx
`-- cash-flow-client.spec.tsx
apps/web/lib/api.ts

apps/api/src/management/financial/
|-- cash-flow/cash-flow.controller.ts
|-- cash-flow/cash-flow.service.ts
|-- cash-flow/cash-flow.service.spec.ts
`-- dto/cash-flow.dto.ts

packages/types/src/index.ts
```

**Structure Decision**: manter o componente visual no conjunto administrativo compartilhado; serialização no cliente HTTP existente; parsing no controller e regra de consolidação no serviço proprietário do caixa. Nenhuma persistência nova é necessária.

## Design

### Componente

- Componente controlado recebe rótulo acessível, opções `{ value, label, disabled? }`, `value: string[]`, callback e textos configuráveis.
- Botão expõe resumo: placeholder para vazio, rótulo para uma opção, quantidade para múltiplas e “Todas” quando todas estiverem marcadas.
- Popover usa semântica de lista/checkbox, fecha por Escape e clique externo, preserva foco e oferece “Limpar”.
- A seleção altera apenas o estado local; o botão existente da tela aplica a consulta.

### Contrato financeiro

- Repetir `financialAccountId` na query para cada conta; valor singular continua válido.
- Normalizar `string | string[] | undefined` para array deduplicado e sem vazios.
- O serviço recebe `string[]`; array vazio significa todas.
- Consultas Prisma usam `in` e transferências são incluídas quando origem ou destino pertence ao conjunto, sem duplicar o evento.
- IDs externos ao tenant não retornam dados nem nomes; conjunto misto considera apenas contas válidas do tenant.

### Inventário de rollout

- **Nesta implementação**: os dois filtros de conta do Controle de Caixa; instituições, meios de pagamento, canais e status em Vendas; status, categorias e fornecedores em Contas a Pagar.
- **Elegíveis para adoção incremental**: ação/loja em Auditoria e categoria/status em Estoque e Ingredientes, condicionados a contratos de união próprios.
- **Não elegíveis**: formulários, troca de loja, seleção de conta para pagamento/movimento, destino de transferência e comandos de mudança de estado.

## Test Strategy

- **Componente**: resumo, abrir/fechar, checkbox, limpar, opções desabilitadas, teclado e clique externo.
- **API/client**: serialização repetida, singular legado, deduplicação e vazio.
- **Serviço**: uma/múltiplas/todas, transferência, ID inválido e isolamento por tenant.
- **Tela**: filtros independentes de posição e extrato, seleção pendente versus aplicada e atualização automática.
- **Regression**: suites web/API, typecheck, lint e `git diff --check`.

## Constitution Check - Post Design

Todos os gates permanecem aprovados. O desenho evita banco ou abstração de negócio nova, conserva compatibilidade e faz a generalização somente na fronteira visual compartilhada.

## Complexity Tracking

Nenhuma violação constitucional identificada.
