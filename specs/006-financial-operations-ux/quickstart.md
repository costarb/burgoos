# Quickstart: Operacoes Financeiras e Experiencia Administrativa

## Goal

Validate the complete pilot flow from clear admin navigation through payable management and cash projection.

## Preconditions

- API, web application and PostgreSQL are running.
- An authenticated OWNER or ADMIN exists for the pilot tenant.
- The tenant has delivered/imported orders with payment institution, net value and release date.
- At least one supplier exists.

## Financial seed-data plan

The pilot seed creates the minimum financial domains required to use payables and cash flow without overwriting user-maintained data.

Default financial accounts:

- PagBank mapped to `PAGBANK`
- Mercado Pago mapped to `MERCADO_PAGO`
- Dinheiro mapped to `DINHEIRO`
- Caixa Local mapped to `CAIXA_LOCAL`

Default financial categories:

- Insumos
- Aluguel
- Energia
- Taxas
- Equipamentos
- Prestador de Serviço
- Outros

Rules:

- Existing accounts are preserved when an account with the same name or payment institution already exists.
- Existing categories are preserved when a category with the same name already exists.
- Opening balances are created as zero only for new seed-created accounts.
- The seed does not reactivate, rename, remap or rebalance user-maintained records.

## Validation flow

1. Open any admin page on desktop.
2. Navigate through Operacao, Cadastros, Financeiro and Relatorios without returning to the admin home.
3. Repeat navigation in a mobile-sized viewport and confirm the drawer exposes the same destinations.
4. Submit a valid and an invalid mutation on an existing maintenance screen.
5. Confirm pending, success and error states are visible and duplicate submission is blocked.
6. Create financial accounts for PagBank, Mercado Pago, Caixa Local and Dinheiro with opening balances.
7. Create financial categories such as Insumos, Aluguel and Energia.
8. Create an open payable associated with a supplier and a future due date.
9. Create a monthly recurring payable and confirm individual future occurrences.
10. Register a partial payment and confirm remaining amount and cash outflow.
11. Register the remaining payment and confirm the payable becomes paid.
12. Reverse one payment and confirm status, balance and audit history are restored consistently.
13. Record a transfer between two financial accounts and confirm consolidated balance is unchanged.
14. Record a justified adjustment and confirm it appears in the ledger and audit.
15. Open cash flow and confirm current balance, receivables, payables and projected balance match their detailed events without double counting.
16. Open the cash statement for the same period and confirm daily credits, debits, net amount and running balance reconcile with analytical entries.
17. Filter the cash statement by one financial account and confirm transfers appear only as debit or credit for the selected account.
18. Open the daily sales report and confirm value labels match daily details without overlapping at desktop and mobile widths.

## Required verification

- Cross-tenant financial-account, payable, payment and cash queries are denied or return no foreign data.
- Cancelled payables and reversed events do not affect balances.
- Deleted/cancelled orders do not affect receipt totals.
- Transfer changes account balances but not consolidated balance.
- Cash statement daily totals match the analytical entries for the same period and optional account filter.
- No source event appears twice in realized or projected totals.
- All financial mutations identify actor, timestamp and before/after state.
- All administrative processing screens communicate pending, success and error states.
