# REST Contract: Cash-flow account filters

Endpoints afetados:

- `GET /api/admin/financial/cash-flow/position`
- `GET /api/admin/financial/cash-flow/ledger`
- `GET /api/admin/financial/cash-flow/statement`

`financialAccountId` pode ocorrer zero, uma ou várias vezes:

```text
?financialAccountId=<uuid-a>&financialAccountId=<uuid-b>
```

- ausente: todas as contas do tenant.
- uma ocorrência: compatibilidade com comportamento anterior.
- múltiplas: união das contas válidas no tenant.
- duplicadas: consideradas uma vez.
- inválidas/externas: não concedem acesso nem ampliam o resultado.
