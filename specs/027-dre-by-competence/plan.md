# Implementation Plan: DRE por Competência com Despesas Lançadas

**Branch**: `027-dre-by-competence` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

## Summary

O DRE passa a ser consultado por **mês de competência** e a subtrair as despesas reais lançadas em contas a pagar, separadas em **Custos fixos** e **Despesas variáveis**.

- **Classificação**: enum `DreExpenseClass` (`FIXED_COST`, `VARIABLE_EXPENSE`, `EXCLUDED`). Fica na categoria financeira (padrão) e pode ser ajustada por conta a pagar. A classificação efetiva é calculada na consulta.
- **Receita**: receita, CMV e taxas seguem a lógica atual dos snapshots, restrita ao mês no fuso da loja.
- **Despesas**: somam o valor previsto das contas não canceladas, pela competência (ou pelo vencimento, se não houver competência).
- **Custo fixo parametrizado**: vira "previsto", fora do cálculo do resultado.
- **Telas**:
  - a tela de DRE ganha seletor de mês, nova estrutura de linhas e detalhamento por categoria com link para contas a pagar;
  - categorias e contas a pagar ganham a classificação;
  - Configurações renomeia o campo.
- **Demais consumidores**: dashboard financeiro e tools MCP `dre` e `contas_a_pagar` usam a mesma regra.

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20 · **Dependencies**: NestJS 10, Prisma 5, Next.js 14 (nenhuma nova)

**Storage**: PostgreSQL. Enum `DreExpenseClass`, `financial_categories.dre_class`, `payables.dre_class_override`, índice `payables(tenant_id, competence_date)`, backfill por nome

**Testing**: Vitest. Unit (calculadora, backfill/sugestão, classificação efetiva), integração com módulo focado + Prisma em memória (padrão das features 025/026) para o DRE mensal, categorias e contas a pagar, paridade DRE × dashboard × MCP, e web (tela de DRE, diálogo de categoria, formulário de conta, filtros pela URL)

**Constraints**: zero dupla contagem (`EXCLUDED` nunca entra); o detalhamento por categoria soma igual ao total; DRE do mês abaixo de 2s (SC-005)

## Constitution Check

- **I. Real Operation First**: Pass. Resultado mensal real com as despesas da loja.
- **II. TypeScript Strict**: Pass. Enum compartilhado em `@rrfive/types`; DTOs validados.
- **III. Modular Monolith**: Pass. Mudança restrita ao domínio Management (financeiro e relatórios) e aos consumidores existentes.
- **IV. Tenant Isolation**: Pass. Todas as consultas por `tenant_id`; sem endpoints novos fora do escopo atual.
- **V. Tests**: Pass. Cenário da US2 como teste automatizado (SC-001/SC-002) e paridade entre consumidores (SC-003).

## Project Structure

```text
packages/database/prisma/
├── schema.prisma                                   # enum + FinancialCategory.dreClass + Payable.dreClassOverride + índice
└── migrations/20261003090000_dre_expense_class/    # DDL + backfill por nome
packages/types/src/index.ts                         # DreExpenseClass, campos novos em categoria, conta e DRE

apps/api/src/management/
├── financial/dto/financial-account.dto.ts          # dreClass em FinancialCategoryDto
├── financial/dto/payable.dto.ts                    # dreClassOverride; competenceIncludesDueDate na query
├── financial/cash-flow/financial-account.service.ts# grava dreClass + auditoria financial_category
├── financial/accounts-payable/accounts-payable.service.ts # override (inclui recorrência), resposta com classes, filtro com fallback
├── financial/dre-expense-class.ts                  # NOVO: rótulos, sugestão por nome, classe efetiva
├── reports/dre-calculator.ts                       # variableExpenses, fixedExpenses, previsto, ponto de equilíbrio
├── reports/dre.service.ts                          # getMonthlySummary(tenantId, "AAAA-MM")
├── reports/dre-competence.ts                       # NOVO: parse/validação do mês e fronteiras no fuso da loja
├── reports/financial-reports.controller.ts         # ?competence=
├── reports/financial-dashboard.service.ts          # mês corrente via getMonthlySummary
└── mcp/tools/financial.tools.ts, payables.tools.ts # mesCompetencia; classificacaoDre

apps/web/
├── app/admin/reports/dre/page.tsx (+ dre-client.tsx, spec) # seletor de mês, linhas novas, detalhamento, previsto
├── app/admin/finance/cash-flow/financial-account-dialog.tsx # classificação da categoria
├── app/admin/finance/payables/payable-form.tsx      # "Classificação no DRE" (seguir categoria / ajuste)
├── app/admin/finance/payables/payables-client.tsx   # badge da classificação; filtros iniciais pela URL
├── app/admin/finance/payables/page.tsx              # lê competenceMonth/categoryId da URL
├── app/admin/settings/page.tsx                      # "Custo fixo mensal previsto"
└── lib/api.ts                                       # getFinancialDre(competence), payloads novos
```

## Design

- **Classificação efetiva**: no SQL, `COALESCE(p.dre_class_override, c.dre_class)`. No TypeScript, `effectiveDreClass(payable)` em `dre-expense-class.ts`, reaproveitado na resposta de contas a pagar e no MCP.
- **DRE mensal**:
  1. `parseCompetence("AAAA-MM")` define as fronteiras no fuso da loja.
  2. Os snapshots do mês passam pelo `calculateDreSummary` atual (receita até a margem de contribuição).
  3. Uma consulta agregada busca as despesas por categoria e classe (data-model.md).
  4. A calculadora fecha despesas variáveis, custos fixos, resultado, margem, ponto de equilíbrio, previsto e diferença.
- **Compatibilidade**: `start` sem `competence` → mês de `start`. A tool MCP aceita `inicio` legado. `despesasFixasReais` continua como alias de `custosFixosReais`.
- **Backfill**: SQL na migration com `translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')` e `LIKE` pelas listas do research R3.
- **Detalhamento**: o link `competenceMonth=AAAA-MM&categoryId=…&competenceIncludesDueDate=true` usa o mesmo critério da soma.

## Test Strategy

- **Unit**:
  - calculadora: cenário da US2, receita zero, margem negativa (ponto de equilíbrio `null`), previsto e diferença;
  - `parseCompetence`: fronteiras no fuso, formato inválido;
  - sugestão por nome com acentos;
  - classe efetiva.
- **Integração**:
  - DRE mensal: fixo, variável e excluído, ajuste na conta, conta sem competência caindo no vencimento, cancelada fora;
  - categorias: criar com padrão, alterar com auditoria;
  - contas a pagar: override em recorrência e resposta com classes; filtro com fallback batendo com o total do DRE.
- **Paridade**: tela de DRE (endpoint) × dashboard × tool MCP `dre` para o mesmo mês (SC-003).
- **Web**: seletor de mês, linhas e sinais, previsto/diferença, aviso sem custo fixo lançado, detalhamento com link; diálogo de categoria; formulário de conta (seguir categoria/ajuste); filtros iniciais pela URL.
- **Regressão**: suítes de contas a pagar, relatório gerencial (usa `summarizeByCategory`), MCP e DRE.

## Complexity Tracking

Nenhuma violação constitucional.
