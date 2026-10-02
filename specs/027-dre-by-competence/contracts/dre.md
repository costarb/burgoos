# Contratos: DRE por Competência

## `GET /api/admin/reports/financial/dre`

Permissão: `finance.view` ou `finance.manage` (sem mudança).

Query: `competence=AAAA-MM` (opcional; padrão: mês corrente no fuso da loja). Compatibilidade: sem `competence` e com `start`, usa o mês de `start`. Formato inválido: `400`.

```json
{
  "competence": "2026-09",
  "periodStart": "2026-09-01",
  "periodEnd": "2026-09-30",
  "grossRevenue": "15000.00",
  "discounts": "300.00",
  "netRevenue": "14700.00",
  "acquiredNetRevenue": "14100.00",
  "cmv": "4410.00",
  "feesAndTaxes": "1470.00",
  "salesFees": "1050.00",
  "taxes": "420.00",
  "taxRate": 0.06,
  "realSalesFees": "900.00",
  "estimatedSalesFees": "150.00",
  "realFeeOrderCount": 120,
  "estimatedFeeOrderCount": 15,
  "grossProfit": "8820.00",
  "contributionMarginRate": 0.6,
  "variableExpenses": "500.00",
  "fixedExpenses": "3000.00",
  "estimatedNetProfit": "5320.00",
  "netMarginRate": 0.3619,
  "breakEvenRevenue": "5300.48",
  "plannedFixedCost": "5000.00",
  "fixedCostVariance": "-2000.00",
  "expensesByCategory": [
    { "categoryId": "…", "categoryName": "Aluguel", "dreClass": "FIXED_COST", "amount": "3000.00", "count": 1 },
    { "categoryId": "…", "categoryName": "Prestador de Serviço", "dreClass": "VARIABLE_EXPENSE", "amount": "500.00", "count": 2 }
  ]
}
```

`salesFees` = taxas de plataforma + pagamento: bruto − líquido do pedido quando houver valores reais (`realSalesFees`, `realFeeOrderCount`), senão a estimativa por percentual (`estimatedSalesFees`, `estimatedFeeOrderCount`). `taxes` é sempre estimado (`taxRate` da configuração). `feesAndTaxes` = `salesFees` + `taxes` (mantido por compatibilidade).

`breakEvenRevenue` é `null` quando a margem após despesas variáveis é ≤ 0 ("não atingível"). `estimatedNetProfit` mantém o nome atual (resultado líquido).

## Categorias financeiras

- `POST|PATCH /api/admin/financial/categories[/:id]`: body ganha `dreClass?: "FIXED_COST" | "VARIABLE_EXPENSE" | "EXCLUDED"` (POST sem valor = `VARIABLE_EXPENSE`; PATCH sem valor mantém o atual).
- `GET /api/admin/financial/categories` e as opções de contas a pagar devolvem `dreClass`.

## Contas a pagar

- `POST|PUT /api/admin/financial/payables[/:id]`: body ganha `dreClassOverride?: "FIXED_COST" | "VARIABLE_EXPENSE" | "EXCLUDED" | null` (`null` ou ausente = seguir a categoria). Na criação com recorrência, todas as ocorrências recebem o valor.
- Resposta de cada conta: `dreClassOverride`, `categoryDreClass` e `effectiveDreClass`.
- `GET /api/admin/financial/payables`: novo parâmetro `competenceIncludesDueDate=true`. Com `competenceMonth`, considera `COALESCE(competencia, vencimento)`; é usado pelo link do DRE.

## MCP

- `dre`: entrada `mesCompetencia?: "AAAA-MM"` (padrão: mês corrente); `inicio`/`fim` legados viram o mês de `inicio`, com `observacao` explicando. Saída: campos atuais + `margemContribuicaoPercentual`, `despesasVariaveisReais`, `custosFixosReais` (antes `despesasFixasReais`, mantido como alias), `custoFixoPrevistoReais`, `diferencaCustoFixoReais` e `despesasPorCategoria[] { categoria, classificacao, valorReais, quantidade }`.
- `contas_a_pagar`: cada conta ganha `classificacaoDre` (`FIXED_COST|VARIABLE_EXPENSE|EXCLUDED`) e `classificacaoAjustada` (boolean).
