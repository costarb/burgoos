# Data Model: DRE por Competência

**Feature**: `027-dre-by-competence` | Migration: `packages/database/prisma/migrations/20261003090000_dre_expense_class/`

## Enum novo `DreExpenseClass`

| Valor | Rótulo | Efeito no DRE |
|---|---|---|
| `FIXED_COST` | Custo fixo | Soma em **Custos fixos** |
| `VARIABLE_EXPENSE` | Despesa variável | Soma em **Despesas variáveis** |
| `EXCLUDED` | Fora do DRE | Não entra (já está no CMV ou nas taxas dos pedidos, ou é investimento) |

## `FinancialCategory` (campo novo)

| Campo | Tipo | Regras |
|---|---|---|
| `dreClass` | `DreExpenseClass`, default `VARIABLE_EXPENSE`, `@map("dre_class")` | Obrigatório. Backfill por nome na migration (research R3) |

## `Payable` (campo novo)

| Campo | Tipo | Regras |
|---|---|---|
| `dreClassOverride` | `DreExpenseClass?`, `@map("dre_class_override")` | `null` = seguir a categoria. Copiado para todas as ocorrências de uma recorrência na criação |

Índice novo: `@@index([tenantId, competenceDate])` (o filtro por competência hoje não tem índice).

**Classificação efetiva**: `dreClassOverride ?? category.dreClass`.

## `FinancialConfiguration.monthlyFixedCost`

Sem mudança no schema. Passa a ser só "Custo fixo mensal previsto" (referência), fora do cálculo do resultado.

## Consulta de despesas do mês (SQL)

```sql
SELECT c.id, c.name, COALESCE(p.dre_class_override, c.dre_class) AS dre_class,
       SUM(p.expected_amount) AS amount, COUNT(*) AS count
FROM payables p JOIN financial_categories c ON c.id = p.category_id
WHERE p.tenant_id = $tenant AND p.cancelled_at IS NULL
  AND COALESCE(p.competence_date, p.due_date) >= $monthStart
  AND COALESCE(p.competence_date, p.due_date) <  $nextMonthStart
  AND COALESCE(p.dre_class_override, c.dre_class) <> 'EXCLUDED'
GROUP BY c.id, c.name, 3
ORDER BY amount DESC;
```

O filtro de competência da tela de contas a pagar passa a usar a mesma expressão `COALESCE(competence_date, due_date)` quando o filtro de competência for informado a partir do DRE (parâmetro `competenceIncludesDueDate=true`), para o detalhamento bater com o total.
