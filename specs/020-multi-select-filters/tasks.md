# Tasks: Filtros com seleção múltipla

**Input**: Design documents from `/specs/020-multi-select-filters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup

- [x] T001 Confirmar contratos e scripts de teste dos workspaces em `apps/web/package.json` e `apps/api/package.json`

## Phase 2: Foundational

- [x] T002 [P] Criar testes de interação do componente em `apps/web/components/admin/multi-select-filter.spec.tsx`
- [x] T003 Criar componente controlado, acessível e reutilizável em `apps/web/components/admin/multi-select-filter.tsx`

## Phase 3: User Story 1 - Consultar várias contas no Controle de Caixa (P1)

**Goal**: filtrar posição, projeção e extrato por várias contas.

**Independent Test**: duas contas selecionadas produzem consolidado e extrato exclusivos sem duplicar transferências.

- [x] T004 [P] [US1] Ampliar testes financeiros de conjuntos e tenant em `apps/api/src/management/financial/cash-flow/cash-flow.service.spec.ts`
- [x] T005 [P] [US1] Testar parsing de query singular e repetida em `apps/api/src/management/financial/cash-flow/cash-flow.controller.spec.ts`
- [x] T006 [US1] Normalizar IDs múltiplos no controller em `apps/api/src/management/financial/cash-flow/cash-flow.controller.ts`
- [x] T007 [US1] Aplicar conjuntos de contas nas consultas e cálculos em `apps/api/src/management/financial/cash-flow/cash-flow.service.ts`
- [x] T008 [P] [US1] Serializar parâmetros repetidos no cliente em `apps/web/lib/api.ts`
- [x] T009 [P] [US1] Atualizar contratos compartilhados de filtros/retorno em `packages/types/src/index.ts`
- [x] T010 [US1] Integrar os dois filtros de conta em `apps/web/app/admin/finance/cash-flow/cash-flow-client.tsx`
- [x] T011 [US1] Criar regressão da tela e distinção seleção/aplicação em `apps/web/app/admin/finance/cash-flow/cash-flow-client.spec.tsx`

## Phase 4: User Story 2 - Filtro claro e acessível (P2)

**Goal**: operação consistente com mouse, teclado e leitor de tela.

**Independent Test**: abrir, percorrer, marcar, limpar e fechar sem mouse, com resumo correto.

- [x] T012 [US2] Completar semântica ARIA, foco, Escape e clique externo em `apps/web/components/admin/multi-select-filter.tsx`
- [x] T013 [US2] Cobrir estados vazio, todas, desabilitado e opções removidas em `apps/web/components/admin/multi-select-filter.spec.tsx`

## Phase 5: User Story 3 - Reutilização em filtros equivalentes (P3)

**Goal**: registrar e preparar adoção segura nos filtros combináveis sem alterar selects operacionais.

**Independent Test**: inventário classifica cada select e o componente não fica acoplado ao domínio financeiro.

- [x] T014 [US3] Validar o inventário de filtros elegíveis e excluídos em `specs/020-multi-select-filters/research.md`
- [x] T015 [US3] Documentar padrão de adoção e contrato para próximos domínios em `specs/020-multi-select-filters/contracts/multi-select-filter.md`

## Phase 6: Polish & Cross-Cutting

- [x] T016 Executar testes web/API, typecheck, lint e corrigir regressões nos arquivos alterados
- [x] T017 Validar manualmente os cenários de `specs/020-multi-select-filters/quickstart.md`
- [x] T018 Atualizar marcações concluídas em `specs/020-multi-select-filters/tasks.md`

## Dependencies & Execution Order

- T001 precede T002–T018.
- T002 precede T003; T004/T005 precedem T006/T007; T003, T6–T9 precedem T010.
- US1 entrega o MVP; US2 endurece acessibilidade; US3 consolida o rollout incremental.

## Parallel Opportunities

- T002, T004, T005, T008 e T009 atuam em arquivos distintos.
- Após o contrato base, testes de serviço e do componente podem evoluir em paralelo.

## Implementation Strategy

Implementar primeiro a consulta financeira fim a fim, validar os dois filtros, concluir acessibilidade e então fechar o inventário de expansão. Filtros de outros domínios serão migrados em incrementos próprios porque requerem contratos, paginação e exportação específicos.
