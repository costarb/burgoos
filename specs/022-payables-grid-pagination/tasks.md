---

description: "Task list template for feature implementation"
---

# Tasks: Paginação no Grid de Contas a Pagar

**Input**: Design documents from `/specs/022-payables-grid-pagination/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/payables-query.md, quickstart.md

**Tests**: Incluídos — a constituição do projeto ("Tests Protect Operational Flow") e o plano exigem regressão automatizada para este fluxo.

**Organization**: Tarefas agrupadas por user story (US1/US2/US3 de spec.md), com uma fase fundacional prévia que expõe o estado de página necessário para todas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story a tarefa pertence (US1, US2, US3)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto web deste monorepo: `apps/web/app/admin/finance/payables/` (frontend afetado). Nenhum arquivo de `apps/api` é alterado — backend já implementa `page`/`pageSize`/`total` (ver research.md).

---

## Phase 1: Setup

**Purpose**: Confirmar que os contratos compartilhados já suportam a feature antes de tocar na tela.

- [x] T001 Confirmar que `PayablesFilters` e `PayablesResponse` em `packages/types/src/index.ts` já expõem `page`, `pageSize` e `total`; se algum campo estiver ausente, adicioná-lo nesse arquivo (não esperado, conforme research.md).

**Checkpoint**: Contrato compartilhado confirmado — nenhuma mudança de tipos esperada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Introduzir o estado de página e o encanamento de requisição/resposta que todas as user stories vão consumir.

**⚠️ CRITICAL**: Nenhuma user story pode ser implementada antes desta fase.

- [x] T002 Em `apps/web/app/admin/finance/payables/payables-client.tsx`, adicionar estado `page` (inicial `1`) e alterar `refresh` para `refresh(nextFilters = filters, nextPage = page)`, enviando `{ ...nextFilters, page: nextPage }` para `getPayables` e sincronizando `page` com `response.payables.page` retornado.
- [x] T003 Em `apps/web/app/admin/finance/payables/payables-client.tsx`, calcular valores derivados a partir de `payables` (`total`, `pageSize`, `page`): `totalPages = Math.max(1, Math.ceil(payables.total / payables.pageSize))`, `hasPreviousPage`, `hasNextPage`, disponíveis para o JSX da lista.

**Checkpoint**: Estado e cálculo de paginação prontos; as user stories abaixo só adicionam UI/comportamento sobre essa base.

---

## Phase 3: User Story 1 - Navegar por todos os resultados da consulta (Priority: P1) 🎯 MVP

**Goal**: Permitir que o usuário avance/volte entre páginas de resultados e veja registros além dos primeiros N.

**Independent Test**: Com mais registros do que uma página, abrir a tela, clicar em "Próxima página" e confirmar que novos registros aparecem; voltar com "Página anterior" e confirmar o retorno aos registros originais.

### Tests for User Story 1 ⚠️

> Escrever estes testes primeiro; devem falhar antes da implementação desta fase.

- [x] T004 [US1] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: clicar em "Próxima página" chama `getPayables` com `page: 2` e renderiza os itens da resposta mockada da página 2.
- [x] T005 [US1] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: clicar em "Página anterior" a partir da página 2 chama `getPayables` com `page: 1`.
- [x] T006 [US1] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: botão "Próxima página" fica desabilitado quando `page * pageSize >= total`; botão "Página anterior" fica desabilitado quando `page <= 1`.

### Implementation for User Story 1

- [x] T007 [US1] Em `apps/web/app/admin/finance/payables/payables-client.tsx`, implementar `goToNextPage`/`goToPreviousPage` que chamam `refresh(filters, page + 1)` / `refresh(filters, page - 1)` dentro do wrapper `run(...)` já existente (reaproveitando estado `busy`/`operation`).
- [x] T008 [US1] Em `apps/web/app/admin/finance/payables/payables-client.tsx`, adicionar bloco de navegação abaixo do grid com botões "Página anterior" e "Próxima página", desabilitados conforme `hasPreviousPage`/`hasNextPage` e enquanto `busy` for verdadeiro.

**Checkpoint**: User Story 1 funcional e testável de forma independente — usuário já consegue ver todos os registros navegando entre páginas.

---

## Phase 4: User Story 2 - Saber quantos registros existem e em qual página está (Priority: P2)

**Goal**: Exibir o total de registros da consulta e a posição da página atual, e garantir que os totais financeiros continuem refletindo toda a consulta.

**Independent Test**: Aplicar uma consulta com total conhecido de registros distribuídos em mais de uma página e verificar o texto "Página X de Y" e o total exibido; navegar entre páginas e confirmar que os cartões de resumo financeiro não mudam.

### Tests for User Story 2 ⚠️

- [x] T009 [US2] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: com resposta mockada (`total`, `page`, `pageSize`), a tela exibe "Página {page} de {totalPages}" e o total de registros encontrados.
- [x] T010 [US2] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: ao navegar da página 1 para a página 2 (mock com `summary` idêntico em ambas respostas), os valores dos cartões `Previsto`/`Pago`/`Em aberto`/`Vencido` permanecem inalterados.

### Implementation for User Story 2

- [x] T011 [US2] Em `apps/web/app/admin/finance/payables/payables-client.tsx`, adicionar texto "Página {page} de {totalPages}" e "{total} registro(s) encontrado(s)" junto ao bloco de navegação criado em T008.

**Checkpoint**: User Stories 1 e 2 funcionam em conjunto — usuário navega, sabe onde está e confia nos totais exibidos.

---

## Phase 5: User Story 3 - Reiniciar a navegação ao alterar filtros (Priority: P2)

**Goal**: Sempre que o usuário mudar qualquer filtro, a listagem volta para a primeira página; e se a página atual deixar de ser válida (ex.: dados mudaram), o sistema se recupera automaticamente.

**Independent Test**: Navegar até uma página diferente da primeira, alterar um filtro (ex.: status) e confirmar que o grid volta a exibir a primeira página do novo resultado.

### Tests for User Story 3 ⚠️

- [x] T012 [US3] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: estando na página 2, clicar em "Filtrar" chama `getPayables` com `page: 1` (mantendo os demais filtros).
- [x] T013 [US3] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: estando na página 2, clicar em "Limpar" chama `getPayables` com `page: 1` e filtros vazios.
- [x] T014 [US3] Adicionar teste em `apps/web/app/admin/finance/payables/payables-client.spec.tsx`: quando a resposta mockada retorna `page` maior que `Math.ceil(total / pageSize)` (ex.: registros removidos), a tela dispara nova busca ajustando para a última página válida (ou `1` quando `total = 0`), sem exibir grid vazio por página inválida.

### Implementation for User Story 3

- [x] T015 [US3] Em `apps/web/app/admin/finance/payables/payables-client.tsx`, alterar `applyFilters` e `clearFilters` para chamar `refresh(nextFilters, 1)`, reiniciando a página.
- [x] T016 [US3] Em `apps/web/app/admin/finance/payables/payables-client.tsx`, após cada `refresh`, comparar `response.payables.page` com o `totalPages` recém-calculado; se inválido, disparar nova chamada a `getPayables` com a última página válida (ou `1` se `total === 0`) antes de atualizar o estado exibido.

**Checkpoint**: Todas as user stories funcionam de forma independente e integrada — navegação completa, informativa e resiliente a mudanças de filtro/dados.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validar o comportamento de ponta a ponta e garantir que nada existente quebrou.

- [x] T017 [P] Rodar a suíte web (`apps/web`) incluindo `payables-client.spec.tsx`, typecheck e lint; corrigir regressões encontradas. **Resultado**: 137/137 testes passando, `tsc --noEmit` e `eslint` limpos.
- [x] T018 [P] Rodar a suíte da API (`apps/api`), especialmente `accounts-payable.service.spec.ts`, para confirmar que o backend segue inalterado e compatível. **Resultado**: `accounts-payable.service.spec.ts`/`payable-rules.spec.ts` (8/8) passam. A suíte completa tem 26 arquivos falhando por `this.prisma.$queryRaw is not a function` e timeouts de rede/timing — pré-existentes neste ambiente sem Postgres real, **não relacionados** a esta feature (nenhum arquivo de `apps/api` foi alterado).
- [ ] T019 Executar o roteiro de `specs/022-payables-grid-pagination/quickstart.md` manualmente (ou via E2E, se aplicável) e registrar o resultado. **Pendente**: requer navegador/app rodando; os 10 passos do roteiro estão cobertos por equivalentes automatizados em `payables-client.spec.tsx` (T004-T014), mas a validação manual em ambiente real ainda não foi executada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode iniciar imediatamente.
- **Foundational (Phase 2)**: depende do Setup — bloqueia todas as user stories.
- **User Stories (Phase 3-5)**: todas dependem da Fase 2 concluída.
  - US1 (P1) é o MVP e não depende de US2/US3.
  - US2 (P2) reaproveita o bloco de navegação criado em US1 (T008) para inserir o texto de posição/total — pode ser feita logo após US1.
  - US3 (P2) reaproveita `refresh`/`page` de Fase 2 e é independente de US2, mas ambas tocam `payables-client.tsx`, então recomenda-se sequência US1 → US2 → US3 para evitar conflitos de edição simultânea no mesmo arquivo.
- **Polish (Phase 6)**: depende de todas as user stories desejadas estarem completas.

### Within Each User Story

- Testes (T004-T006, T009-T010, T012-T014) escritos e falhando antes da implementação correspondente.
- Implementação da US1 antes da US2 (US2 insere texto no mesmo bloco de navegação criado pela US1).
- História completa e validada antes de seguir para a próxima prioridade.

### Parallel Opportunities

- T017 e T018 (Phase 6) podem rodar em paralelo — suítes de projetos diferentes (`apps/web` vs `apps/api`).
- Como praticamente todas as tarefas de implementação e teste tocam os dois mesmos arquivos (`payables-client.tsx` e `payables-client.spec.tsx`), não há paralelismo seguro dentro das Fases 2-5 — execução sequencial é recomendada mesmo sem marcação `[P]`.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Fase 1 (Setup).
2. Completar Fase 2 (Foundational) — obrigatório antes de qualquer história.
3. Completar Fase 3 (US1) — navegação básica entre páginas.
4. **Parar e validar**: confirmar manualmente que dá para ver todos os registros de uma consulta grande navegando entre páginas.
5. Este é o MVP que resolve o problema relatado pelo usuário.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → validar independentemente → já resolve o problema relatado (MVP).
3. US2 → validar independentemente → usuário passa a ver total/posição e confia nos totais entre páginas.
4. US3 → validar independentemente → navegação resiliente a troca de filtro e a mudanças de dados.
5. Cada história agrega valor sem quebrar as anteriores.

---

## Notes

- [P] só foi usado onde os arquivos afetados são realmente independentes (Fase 6); as demais tarefas tocam os mesmos dois arquivos e devem ser feitas em sequência.
- Escrever os testes de cada história antes da implementação correspondente e confirmar que falham primeiro.
- Comitar após cada tarefa ou grupo lógico de tarefas.
- Parar em cada checkpoint para validar a história isoladamente antes de seguir para a próxima.
- Nenhuma tarefa de backend é necessária — `apps/api` já suporta `page`/`pageSize`/`total` (ver research.md); T018 é apenas confirmação de regressão.
