# Data Model: Paginação no Grid de Contas a Pagar

Não há alteração de esquema de banco de dados. Os campos abaixo já existem no contrato (`PayablesFilters`/`PayablesResponse` em `packages/types/src/index.ts` e `PayablesQueryDto` em `apps/api/src/management/financial/dto/payable.dto.ts`); esta feature passa a consumi-los de fato no frontend.

## PayablesFilters (existente, reaproveitado)

- `page`: número da página solicitada (1-based). Ausente/omitido equivale a `1`.
- `pageSize`: quantidade de registros por página. Ausente/omitido equivale ao padrão do backend (50); limitado a 100 pelo DTO.
- Demais campos (`start`, `end`, `statuses`, `categoryIds`, `supplierIds`, `competenceMonth`) inalterados.

## PayablesResponse (existente, reaproveitado)

- `items`: registros da página atual (tamanho ≤ `pageSize`).
- `page`: página efetivamente retornada.
- `pageSize`: tamanho de página efetivamente aplicado.
- `total`: total de registros que atendem à consulta (todas as páginas).
- `summary`: totais financeiros agregados sobre o conjunto completo da consulta (não apenas a página atual) — comportamento já existente, preservado.

## PageState (novo, apenas estado de UI em `PayablesClient`)

- `page`: número inteiro ≥ 1, mantido em estado local junto dos filtros.
- Derivados calculados a partir da resposta mais recente:
  - `totalPages = Math.max(1, Math.ceil(total / pageSize))`
  - `hasPreviousPage = page > 1`
  - `hasNextPage = page < totalPages`

## Validation / Regras de consistência

- Alterar qualquer filtro (via "Filtrar" ou "Limpar") reinicia `page` para `1` antes de buscar.
- Ao navegar (anterior/próxima), os demais filtros aplicados são reenviados sem alteração.
- Se, após uma busca, `page` retornado pelo backend for maior que `totalPages` calculado a partir do novo `total` (ex.: dado removido entre ações), a tela deve buscar novamente ajustando `page` para `totalPages` (ou `1` quando `total = 0`), evitando grid vazio por página inválida.
- Os cartões de resumo (`Previsto`, `Pago`, `Em aberto`, `Vencido`) sempre usam `summary` da resposta mais recente, que já reflete o total da consulta — nenhuma mudança necessária.
