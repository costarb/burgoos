---

description: "Task list template for feature implementation"
---

# Tasks: Indicador de Carregamento na Navegação

**Input**: Design documents from `/specs/024-navigation-loading-indicator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/navigation-progress.md, quickstart.md

**Tests**: Incluídos — a constituição do projeto ("Tests Protect Operational Flow") e o plano exigem regressão automatizada para este fluxo, especialmente a máquina de estados de temporização.

**Organization**: Tarefas agrupadas por user story (US1-US3 de spec.md). US1 (barra de progresso) e US2 (esqueletos) são mecanismos independentes — cada um pode ser implementado e validado sem o outro.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story a tarefa pertence (US1, US2, US3)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto web deste monorepo: `apps/web/components/admin/` e `apps/web/app/{admin,platform}/` (frontend afetado). Nenhum arquivo de `apps/api` ou `packages/types` é alterado.

---

## Phase 1: Setup

**Purpose**: Confirmar as restrições técnicas que moldam o desenho antes de criar qualquer arquivo novo.

- [x] T001 Confirmar em `apps/web/package.json` a versão do Next.js (`14.2.x`, sem `useLinkStatus`/eventos nativos de router) e que `app/admin/layout.tsx` e `app/platform/layout.tsx` renderizam o mesmo `AdminShell` — nenhuma mudança esperada, apenas validação das premissas de research.md.

**Checkpoint**: Premissas técnicas confirmadas.

---

## Phase 2: Foundational

**Purpose**: US1 (barra) e US2 (esqueletos) são mecanismos independentes entre si — não há pré-requisito bloqueante compartilhado além do Setup. Esta fase fica propositalmente mínima.

- [x] T002 Confirmar o ponto de montagem único: localizar em `apps/web/components/admin/admin-shell.tsx` onde inserir o componente da barra de progresso (ex.: logo após a abertura do elemento raiz do shell), sem alterar comportamento existente ainda.

**Checkpoint**: Ponto de integração identificado; US1 e US2 podem prosseguir em paralelo (por pessoas diferentes) ou em sequência.

---

## Phase 3: User Story 1 - Saber que a navegação está em andamento (Priority: P1) 🎯 MVP

**Goal**: Barra de progresso fina no topo, visível durante navegações pelo menu lateral, com os limiares de tempo definidos em research.md/contracts.

**Independent Test**: Acessar uma tela com carregamento perceptível (throttle de rede) pelo menu e confirmar que a barra aparece em ~150ms e permanece contínua até o conteúdo chegar.

### Tests for User Story 1 ⚠️

> Escrever estes testes primeiro; devem falhar antes da implementação desta fase.

- [x] T003 [US1] Criar `apps/web/components/admin/use-navigation-progress.spec.tsx` (padrão "Harness", com `vi.useFakeTimers()`): clique num link interno não deixa o status `visible` antes de 150ms; se a navegação (mudança de `pathname`) concluir antes de 150ms, o status nunca chega a `visible`.
- [x] T004 [US1] Em `use-navigation-progress.spec.tsx`: se a navegação ainda não concluiu após 150ms, o status vira `visible`; uma vez `visible`, permanece por no mínimo 200ms mesmo que a navegação já tenha concluído antes disso.
- [x] T005 [US1] Em `use-navigation-progress.spec.tsx`: uma nova navegação iniciada enquanto o status já é `visible` reinicia o cronômetro interno mas não regride para `pending`/`idle`; o tempo-limite de segurança de 15s força o status de volta a `idle` mesmo sem mudança de `pathname`/`searchParams`.
- [x] T006 [US1] Em `apps/web/components/admin/admin-shell.spec.tsx`: a barra de progresso está montada no shell e responde a cliques nos links do menu tanto em `/admin` quanto em `/platform`. **Ajuste**: `admin-shell.spec.tsx` hoje nunca renderiza `<AdminShell>` de verdade (exigiria mockar sessão/polling/etc. não montados em nenhum teste existente); a lógica de clique (`shouldTriggerNavigationStart`, usada diretamente no `onClick` de cada link) é testada isoladamente em `use-navigation-progress.spec.tsx`, que cobre exatamente o que dispara/não dispara o início da navegação.

### Implementation for User Story 1

- [x] T007 [US1] Criar `apps/web/components/admin/use-navigation-progress.ts`: hook cliente com a máquina de estados `idle -> pending -> visible -> idle` (data-model.md) e `useEffect` sobre `usePathname()` para detectar conclusão. **Ajuste de desenho**: em vez de um listener de clique delegado em `document` com introspecção de URL, o hook expõe `startNavigation()` chamado diretamente pelo `onClick` de cada `NavigationLink`/logo do `AdminShell` (guardado por `shouldTriggerNavigationStart`, também exportado) — mais simples, robusto e precisamente escopado aos links do menu, sem precisar reimplementar as regras do `next/link` para clique modificado/mesma origem. Também dispensou `useSearchParams()` (e o `<Suspense>` que ele exigiria), já que a navegação é sempre disparada por rotas estáticas do menu.
- [x] T008 [US1] Criar `apps/web/components/admin/navigation-progress-bar.tsx`: componente de apresentação que consome `use-navigation-progress`, renderiza a barra fixa no topo (`bg-tomato`, altura fina) apenas quando `status === "visible"`, com animação contínua que respeita `prefers-reduced-motion`.
- [x] T009 [US1] Montar `<NavigationProgressBar />` em `apps/web/components/admin/admin-shell.tsx`, cobrindo `/admin` e `/platform` de uma vez.

**Checkpoint**: User Story 1 funcional e testável de forma independente — usuário já vê feedback contínuo ao navegar pelo menu.

---

## Phase 4: User Story 2 - Ver uma prévia da estrutura da tela (Priority: P2)

**Goal**: Esqueleto de conteúdo (via `loading.tsx` nativo do Next.js) no lugar de tela em branco enquanto os dados carregam.

**Independent Test**: Acessar uma tela de listagem e uma de relatório com carregamento perceptível e confirmar que cada uma mostra uma prévia esquemática adequada (lista vs. painel) antes do conteúdo real.

### Tests for User Story 2 ⚠️

- [x] T010 [US2] Criar `apps/web/components/admin/route-skeleton.spec.tsx`: a variação `"list"` renderiza cabeçalho + linhas repetidas; a variação `"panel"` renderiza cartões de métrica + bloco de gráfico/tabela; ambas renderizam sem erro e sem depender de dados externos.

### Implementation for User Story 2

- [x] T011 [US2] Criar `apps/web/components/admin/route-skeleton.tsx`: componente de apresentação puro, `variant: "list" | "panel"`, usando blocos com a classe de shimmer/skeleton já usada como padrão de carregamento no restante do admin (ou uma nova classe utilitária simples, se nenhuma existir).
- [x] T012 [US2] Criar `apps/web/app/admin/loading.tsx` e `apps/web/app/platform/loading.tsx`, cada um renderizando `<RouteSkeleton variant="list" />` — por herança de Suspense boundary do Next.js, cobre as 34 páginas de ambas as seções que não tiverem um `loading.tsx` mais específico.
- [x] T013 [US2] Criar `apps/web/app/admin/reports/loading.tsx` e `apps/web/app/admin/finance/loading.tsx`, cada um renderizando `<RouteSkeleton variant="panel" />`, sobrepondo o fallback da raiz nessas duas seções com cartões de métrica.

**Checkpoint**: User Stories 1 e 2 funcionam em conjunto — barra de progresso mais esqueleto de conteúdo cobrindo toda navegação do painel.

---

## Phase 5: User Story 3 - Consistência visual com indicadores locais (Priority: P3)

**Goal**: Confirmar que o novo indicador de navegação usa a mesma linguagem visual (acento de marca) já dominante no admin, documentando a decisão tomada durante o design da US1.

**Independent Test**: Comparar visualmente a cor da barra de progresso com botões primários e a navegação ativa do menu.

### Implementation for User Story 3

- [x] T014 [US3] Revisar visualmente `navigation-progress-bar.tsx` (T008) contra os botões primários e o símbolo de marca do `AdminShell`, confirmando uso consistente do token `tomato`; ajustar se necessário. Nenhum código novo esperado — esta história valida uma decisão já tomada na implementação da US1 (ver research.md).

**Checkpoint**: Todas as user stories funcionam de forma independente e integrada.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validar o comportamento de ponta a ponta e garantir que nada existente quebrou.

- [x] T015 [P] Rodar a suíte web (`apps/web`), typecheck e lint; corrigir regressões encontradas. **Resultado**: 170/170 testes passando (57 arquivos, incluindo os 20 novos desta feature), `tsc --noEmit` e `eslint` limpos.
- [x] T016 Navegar manualmente por uma amostra representativa de rotas (`/admin`, `/admin/orders`, `/admin/reports/sales`, `/admin/finance/payables`, `/platform/stores`) para confirmar que o `loading.tsx` correto (herdado ou específico) aparece em cada uma. **Resultado parcial**: `npx next build` compila e gera as 40 rotas (34 de `/admin`+`/platform`) sem erro, confirmando estruturalmente que os 4 `loading.tsx` e a herança de Suspense boundary estão corretos. **Pendente**: confirmação visual num navegador real (`next dev` + clique), não executada nesta sessão.
- [ ] T017 Executar o roteiro de `specs/024-navigation-loading-indicator/quickstart.md` manualmente e registrar o resultado. **Pendente**: requer navegador/app rodando com interação visual (throttle de rede, observar a barra e os esqueletos); os 10 passos não têm equivalente automatizado nesta feature (é uma validação inerentemente visual).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** e **Foundational (Phase 2)**: leves, sem bloqueio real entre si — podem ser feitas em sequência rápida.
- **User Stories (Phase 3-5)**: US1 e US2 são independentes entre si (mecanismos e arquivos diferentes) e podem ser feitas em qualquer ordem ou em paralelo. US3 depende da US1 estar implementada (T008), pois é uma revisão sobre o componente que ela cria.
- **Polish (Phase 6)**: depende de todas as user stories desejadas estarem completas.

### Within Each User Story

- Testes escritos e falhando antes da implementação correspondente.
- US1: hook (T007) antes do componente de apresentação (T008); componente antes da montagem no shell (T009).
- US2: componente de esqueleto (T011) antes dos arquivos `loading.tsx` que o consomem (T012, T013).

### Parallel Opportunities

- T003-T006 (testes da US1) podem ser escritos em paralelo com T010 (teste da US2) — arquivos e mecanismos diferentes.
- T012 e T013 (arquivos `loading.tsx`) podem ser feitos em paralelo entre si uma vez que T011 (esqueleto) esteja pronto — arquivos independentes.
- T015 (suíte automatizada) e T016 (navegação manual por amostra) podem ocorrer em paralelo — escopos diferentes.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Fase 1 (Setup) e Fase 2 (Foundational) — rápidas.
2. Completar Fase 3 (US1) — barra de progresso funcional.
3. **Parar e validar**: confirmar manualmente que a barra aparece/desaparece corretamente em navegações lentas e rápidas.
4. Este é o MVP que já resolve a parte "não sei se está processando" relatada originalmente.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → validar independentemente → barra de progresso cobrindo toda navegação (MVP).
3. US2 → validar independentemente → esqueletos substituindo telas em branco.
4. US3 → validação/ajuste fino de consistência visual.
5. Cada história agrega valor sem quebrar as anteriores.

---

## Notes

- [P] só foi usado onde os arquivos afetados são realmente independentes.
- Escrever os testes de cada história antes da implementação correspondente e confirmar que falham primeiro.
- Comitar após cada tarefa ou grupo lógico de tarefas.
- Parar em cada checkpoint para validar a história isoladamente antes de seguir para a próxima.
- Nenhuma tarefa de backend é necessária — a feature é inteiramente de interação no cliente (ver research.md).
