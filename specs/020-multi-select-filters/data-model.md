# Data Model: Filtros com seleção múltipla

Não há alteração persistente de banco.

## FilterOption

- `value`: identificador estável e não vazio.
- `label`: texto visível e acessível.
- `disabled`: impede alteração quando verdadeiro.

## FilterSelection

- `selectedValues`: conjunto ordenado, sem duplicidades, de `FilterOption.value`.
- vazio representa ausência de restrição.
- valores indisponíveis são descartados quando as opções mudam.

## AppliedCashFlowFilters

- `asOf` / `projectionEnd` ou `start` / `end`: datas já existentes.
- `financialAccountIds`: zero ou mais IDs de conta.
- estados editado e aplicado permanecem separados até a ação explícita.

## Validation

- Remover strings vazias e duplicadas.
- Consultar contas sempre junto de `tenantId`.
- Normalizar seleção de todas as opções para conjunto vazio.
- Não permitir que uma conta inexistente amplie os resultados.
