# Quickstart: Filtros de Pesquisa em Contas a Pagar

## Preconditions

- Existe um usuario administrativo com permissao `finance.view` ou `finance.manage`.
- Existem ao menos duas categorias financeiras ativas.
- Existem ao menos dois fornecedores ativos.
- Existem contas a pagar em categorias, fornecedores e meses de referencia diferentes.

## Manual Validation

1. Acesse `/admin/finance/payables`.
2. Confirme que a area de filtros apresenta:
   - periodo de vencimento inicial e final;
   - status;
   - Categoria;
   - Fornecedor;
   - Mes de referencia;
   - acoes Filtrar e Limpar.
3. Selecione uma Categoria com contas cadastradas e clique em Filtrar.
4. Confirme que todos os resultados exibem a categoria selecionada e que os totais refletem a lista filtrada.
5. Selecione um Fornecedor e clique em Filtrar.
6. Confirme que todos os resultados exibem o fornecedor selecionado.
7. Selecione um Mes de referencia no formato mes/ano e clique em Filtrar.
8. Confirme que todos os resultados pertencem a competencia selecionada, independentemente da data de vencimento.
9. Combine Categoria, Fornecedor e Mes de referencia.
10. Confirme que todos os resultados atendem aos tres filtros simultaneamente.
11. Escolha uma combinacao sem resultados.
12. Confirme que a tela mostra "Nenhuma conta a pagar encontrada." e mantem os filtros preenchidos.
13. Clique em Limpar.
14. Confirme que Categoria, Fornecedor e Mes de referencia voltam ao estado vazio junto com os demais filtros.

## API Validation

Example request:

```http
GET /api/admin/financial/payables?categoryId=<uuid>&supplierId=<uuid>&competenceMonth=2026-06
Authorization: Bearer <token>
```

Expected:

- Response status is `200`.
- Every item has the requested `categoryId`.
- Every item has the requested `supplierId`.
- Every item with `competenceDate` falls inside June 2026.
- Summary totals match only the filtered items.

## Regression Checks

- Existing `start` and `end` filters still filter by due date.
- Existing `status` filter still works with the new filters.
- Creating, editing, paying, reversing and cancelling payables behave as before.
- Users cannot see category, supplier or payable data from another tenant.

## Implementation Validation Results

- Categoria filter: covered by service and web interaction tests.
- Fornecedor filter: covered by service and web interaction tests.
- Mes de referencia filter: covered by service, integration and web interaction tests.
- Combined filters: covered by API integration and web interaction tests.
- Clear action: covered by web interaction tests.

## Index Decision

No schema migration was added for this feature. The pilot scope remains small enough to use the existing `Payable.competenceDate` field without a dedicated `tenantId, competenceDate` index. Add that index later if monthly payable search becomes slow under real tenant volume.
