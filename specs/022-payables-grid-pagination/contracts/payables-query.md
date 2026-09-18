# REST Contract: Accounts payable pagination

Endpoint afetado (já existente, sem alteração de backend):

- `GET /api/admin/financial/payables`

## Query params relevantes (já suportados por `PayablesQueryDto`)

```text
?page=<int >= 1>&pageSize=<int 1..100>&start=...&end=...&status=...&categoryId=...&supplierId=...&competenceMonth=...
```

- `page` ausente: assume `1`.
- `pageSize` ausente: assume `50` (padrão atual do serviço).
- `pageSize` acima de `100`: rejeitado pela validação do DTO (`@Max(100)`).
- Demais filtros (`status`, `categoryId`, `supplierId`, repetíveis) inalterados por esta feature.

## Resposta (`PayablesResponse`, já existente)

```jsonc
{
  "items": [ /* até pageSize registros da página solicitada */ ],
  "summary": { /* totais agregados de TODA a consulta, não só da página */ },
  "page": 2,
  "pageSize": 50,
  "total": 137
}
```

- O cliente web usa `total` e `pageSize` para calcular o número de páginas e habilitar/desabilitar a navegação.
- Nenhum novo endpoint ou campo é criado; esta feature apenas passa a enviar `page`/`pageSize` a partir da tela e a consumir `page`/`pageSize`/`total` da resposta.

## Mudança no cliente (`apps/web/lib/api.ts` → `getPayables`)

- Nenhuma mudança de assinatura: `PayablesFilters` já aceita `page`/`pageSize`; a serialização de query genérica (`Object.entries(filters)...`) já cobre esses dois campos por serem valores escalares.
