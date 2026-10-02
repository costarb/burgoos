# Tasks: DRE por Competência com Despesas Lançadas

**Input**: `/specs/027-dre-by-competence/` (plan.md, spec.md, research.md, data-model.md, contracts/dre.md, quickstart.md)

**Tests**: incluídos (SC-001 a SC-003 exigem teste automatizado).

## Phase 1: Foundational

- [ ] T001 Adicionar o enum `DreExpenseClass`, `FinancialCategory.dreClass` (default `VARIABLE_EXPENSE`), `Payable.dreClassOverride` e `@@index([tenantId, competenceDate])` em `packages/database/prisma/schema.prisma`
- [ ] T002 Gerar `packages/database/prisma/migrations/20261003090000_dre_expense_class/migration.sql` (diff do schema) e acrescentar o backfill por nome do research R3 (`translate`/`lower`/`LIKE`); `npm run db:generate`
- [ ] T003 [P] Criar `apps/api/src/management/financial/dre-expense-class.ts` (rótulos, `suggestDreClass(name)` com as mesmas listas do backfill, `effectiveDreClass`), com testes em `dre-expense-class.spec.ts`
- [ ] T004 [P] Criar `apps/api/src/management/reports/dre-competence.ts` (`parseCompetence`, mês corrente no fuso da loja, fronteiras `periodStart/periodEnd` via `localDayStart/localDayEnd` e intervalo de competência local), com testes
- [ ] T005 [P] Tipos em `packages/types/src/index.ts`: `DreExpenseClass`, `dreClass` em categoria, `dreClassOverride`/`categoryDreClass`/`effectiveDreClass` em conta, novos campos do DRE

## Phase 2: User Story 1 - Classificar despesas (P1)

- [ ] T006 [US1] `FinancialCategoryDto.dreClass` opcional (`IsEnum`) e `financial-account.service.ts`: criar com padrão, alterar mantendo o atual quando ausente, auditar `financial_category` com `before/after`; categorias e opções devolvem `dreClass`
- [ ] T007 [US1] `PayableDto.dreClassOverride` (`IsEnum`, aceita `null`) e `accounts-payable.service.ts`: gravar na criação (todas as ocorrências da recorrência) e na edição; resposta com `dreClassOverride`, `categoryDreClass` e `effectiveDreClass` (incluir `category.dreClass` no `payableInclude`)
- [ ] T008 [P] [US1] Testes de integração (módulo focado + Prisma em memória) em `apps/api/test/dre-expense-class.integration.spec.ts`: categoria nova = variável; alteração auditada; override na recorrência; classe efetiva na resposta; mudar a categoria afeta só contas sem ajuste
- [ ] T009 [US1] Web: seletor de classificação com explicação no `financial-account-dialog.tsx` (e rótulo na lista de categorias); "Classificação no DRE" no `payable-form.tsx` (Seguir categoria (X) / Custo fixo / Despesa variável / Fora do DRE); badge da classificação efetiva (com "ajustada") em `payables-client.tsx`; testes nos specs existentes

## Phase 3: User Story 2 - DRE por competência (P1) 🎯

- [ ] T010 [US2] `dre-calculator.ts`: aceitar `variableExpenses`, `fixedExpenses`, `plannedFixedCost`; calcular resultado, margem líquida, margem de contribuição %, ponto de equilíbrio (`null` quando não atingível) e diferença do previsto; testes unitários com o cenário da US2 e casos de borda
- [ ] T011 [US2] `dre.service.ts`: `getMonthlySummary(tenantId, competence)` (snapshots do mês no fuso da loja + agregação de despesas por categoria e classe com `COALESCE(competencia, vencimento)`, excluindo `EXCLUDED` e canceladas) devolvendo o contrato de `contracts/dre.md`; remover `getSummary(start, end)`
- [ ] T012 [US2] `financial-reports.controller.ts`: `?competence=AAAA-MM` (padrão: mês corrente; compatibilidade com `start`; `400` para formato inválido)
- [ ] T013 [P] [US2] Testes de integração em `apps/api/test/dre-competence.integration.spec.ts`: cenário da US2 (SC-001), `EXCLUDED` nunca altera o resultado (SC-002), conta sem competência cai no vencimento, cancelada fora, ajuste na conta, mês sem dados zerado, fronteira do fuso
- [ ] T014 [US2] `accounts-payable.service.ts` e DTO: `competenceIncludesDueDate=true` aplica `COALESCE(competence_date, due_date)` no filtro de competência (`list`, `querySummary`, `summarizeByCategory`); teste de que a lista filtrada soma igual à linha do DRE
- [ ] T015 [US2] Web: `apps/web/app/admin/reports/dre/` com seletor de mês (padrão: mês corrente), estrutura de linhas da US2-6 com sinais, margem líquida, ponto de equilíbrio ("não atingível"), prejuízo em destaque, detalhamento expansível de Custos fixos e Despesas variáveis por categoria com link para contas a pagar; `lib/api.ts` `getFinancialDre(competence)`; testes
- [ ] T016 [US2] Web: `finance/payables/page.tsx` lê `competenceMonth`, `categoryId` e `competenceIncludesDueDate` da URL como filtros iniciais em `payables-client.tsx`; teste

## Phase 4: User Story 3 - Custo fixo previsto (P2)

- [ ] T017 [US3] DRE exibe "Custo fixo previsto (configuração)" e a diferença, e o aviso "Nenhum custo fixo lançado para esta competência" quando aplicável; Configurações renomeia para "Custo fixo mensal previsto" com a explicação; testes web

## Phase 5: User Story 4 - Mesma regra nos consumidores (P2)

- [ ] T018 [US4] `financial-dashboard.service.ts` usa `getMonthlySummary` do mês corrente (fuso da loja)
- [ ] T019 [US4] Tool MCP `dre` (`financial.tools.ts`): `mesCompetencia` (padrão: mês corrente), `inicio` legado com `observacao`, saída com despesas variáveis, custos fixos (alias `despesasFixasReais`), previsto, diferença e `despesasPorCategoria`; tool `contas_a_pagar` com `classificacaoDre` e `classificacaoAjustada`; atualizar fixtures e testes de paridade
- [ ] T020 [P] [US4] Teste de paridade em `apps/api/test/dre-parity.integration.spec.ts`: endpoint do DRE × dashboard × tool `dre` mostram o mesmo resultado líquido para o mesmo mês (SC-003)

## Phase 6: Polish

- [ ] T021 [P] Docs: `docs/USER_GUIDE.md` (DRE por competência, classificação das categorias e contas), contrato MCP em `specs/025-store-mcp-server/contracts/mcp-tools.md`, regenerar `docs/DATA_DICTIONARY.md`
- [ ] T022 Typecheck, lint e suítes completas de API e web (comparar com o baseline do `develop`)
- [ ] T023 Roteiro do `quickstart.md` no ambiente local e em produção

## Dependencies

Phase 1 → US1 → US2 → (US3, US4) → Polish. US3 e US4 podem andar em paralelo depois da US2. T014 é pré-requisito do link de detalhamento (T015/T016).
