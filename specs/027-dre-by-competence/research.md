# Research: DRE por Competência com Despesas Lançadas

**Feature**: `027-dre-by-competence` | **Date**: 2026-10-02

## R1. Situação atual (levantamento no código e no banco local)

- `DreService.getSummary(tenantId, start, end)` soma os `OrderProfitabilitySnapshot` do período (pedidos entregues) e subtrai `FinancialConfiguration.monthlyFixedCost` inteiro, **independente do tamanho do período**. Um DRE de 92 dias desconta um único mês de custo fixo.
- `monthlyFixedCost` só é usado pelo DRE. Também aparece em Configurações, no dashboard financeiro (via DRE) e na tool `dre` do MCP.
- `Payable` tem `categoryId` (obrigatório), `competenceDate` (opcional; a UI grava o 1º dia do mês) e `dueDate`. `FinancialCategory` tem só nome e ativo.
- Banco local: as categorias "Insumos" (R$ 10.342), "Taxas" (R$ 269) e "Equipamentos" mostram que somar todas as contas a pagar no DRE duplicaria CMV e taxas e trataria investimento como despesa.
- O consumidor do DRE em contas a pagar já tem filtro por competência (`competenceSql`, intervalo local `[1º dia, 1º dia do mês seguinte)`).

## R2. Onde guardar a classificação

- **Decision** (do usuário): enum `DreExpenseClass { FIXED_COST, VARIABLE_EXPENSE, EXCLUDED }`.
  - `FinancialCategory.dreClass` (obrigatório, padrão `VARIABLE_EXPENSE`).
  - `Payable.dreClassOverride` (opcional; `null` = seguir a categoria).
  - Classificação efetiva = `COALESCE(p.dre_class_override, c.dre_class)`.
- **Rationale**: a categoria resolve o caso comum com um único ajuste (ex.: Aluguel = fixo); o ajuste na conta cobre exceções (ex.: um "Prestador de Serviço" que é a mensalidade do contador). Calcular a classificação efetiva no momento da consulta faz a mudança de classificação da categoria valer para o histórico (US1-5) sem migrar dados.
- **Recorrência**: o ajuste informado na criação é copiado para todas as ocorrências (US1-4), como já acontece com categoria e fornecedor.

## R3. Backfill da classificação nas categorias existentes (FR-002)

- **Decision**: a migration define `dre_class` por correspondência de nome, sem diferenciar maiúsculas nem acentos (`translate()` para remover acentos + `lower()`):
  - `FIXED_COST`: aluguel, energia, luz, agua, internet, telefone, salario, folha, contab, contador, seguro, condominio, iptu, sistema, software, assinatura.
  - `EXCLUDED`: insumo, mercadoria, materia prima, taxa, equipamento, investimento, emprestimo, financiamento, retirada, distribuicao.
  - demais: `VARIABLE_EXPENSE`.
- **Rationale**: dá um ponto de partida seguro (evita dupla contagem imediata de insumos e taxas) e o gestor revisa na tela. A lista fica documentada no quickstart.

## R4. Fronteira do mês

- **Decision**:
  - **Vendas**: snapshots com `createdAt` no mês **no fuso da loja** (`America/Sao_Paulo`), via `localDayStart/localDayEnd` de `sales-report.types.ts`. Hoje o DRE usa o horário do servidor (UTC no Render) e o dashboard usa UTC; ambos passam ao fuso da loja.
  - **Despesas**: `COALESCE(competence_date, due_date)` no intervalo do mês, com a mesma regra de `competenceSql` já usada pelo filtro de competência de contas a pagar, para a lista aberta a partir do DRE bater com o total.
- **Rationale**: o mês de negócio é o do fuso da loja. Usar o mesmo critério da tela de contas a pagar garante que o detalhamento (SC-004) some igual ao total do DRE.
- **Efeito colateral aceito**: pedidos entregues entre 21h e 23h59 do último dia do mês (horário de Brasília), que hoje caem no mês seguinte por causa do UTC, passam a entrar no mês correto.

## R5. Cálculo

```text
Receita bruta − Descontos = Receita líquida
Receita líquida − CMV − Taxas e impostos = Margem de contribuição (= grossProfit atual)
Margem de contribuição − Despesas variáveis − Custos fixos = Resultado líquido
Margem líquida = Resultado líquido ÷ Receita líquida
Ponto de equilíbrio = Custos fixos ÷ ((Margem de contribuição − Despesas variáveis) ÷ Receita líquida)
```

- Valores das despesas = `expected_amount` das contas não canceladas (regime de competência).
- Custo fixo previsto = `monthlyFixedCost`, exibido com a diferença `realizado − previsto`. **Não entra no resultado.**
- Divisões com base ≤ 0 retornam 0 (margem) ou `null` (ponto de equilíbrio "não atingível").

## R6. API e compatibilidade

- `GET /api/admin/reports/financial/dre?competence=AAAA-MM` (padrão: mês corrente no fuso da loja). Os parâmetros `start`/`end` deixam de ser aceitos; se enviados sem `competence`, usa o mês de `start` (compatibilidade com links antigos).
- `DreService.getMonthlySummary(tenantId, month)` substitui `getSummary(start, end)`. Consumidores atualizados: controller, `FinancialDashboardService.getIndicators` (mês corrente) e a tool MCP `dre`.
- A tool MCP `dre` passa a receber `mesCompetencia`; `inicio` legado vira o mês correspondente, com `observacao` na resposta.
- A tool MCP `contas_a_pagar` ganha `classificacaoDre` por conta (efetiva) e `classificacaoAjustada` (boolean).

## R7. Detalhamento até as contas (SC-004)

- **Decision**: o DRE devolve `expensesByCategory[]` (classe, categoria, total, quantidade). Na web, cada categoria leva a `/admin/finance/payables?competenceMonth=AAAA-MM&categoryId=<id>`. A tela de contas a pagar passa a ler esses parâmetros da URL como filtros iniciais.

## R8. Auditoria

- Mudança de `dreClass` em categoria: `FinancialAuditService.record` com `entityType: "financial_category"`, `action: UPDATE` e `before/after`.
- Ajuste na conta: já coberto pela auditoria de atualização de contas a pagar, que passa a incluir o campo.
