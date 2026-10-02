# Quickstart: DRE por Competência

1. `npm run db:migrate` (aplica `20261003090000_dre_expense_class` e classifica as categorias existentes por nome).
2. Em **Caixa → Contas e categorias**, revise a classificação de cada categoria:
   - **Custo fixo**: aluguel, energia, água, internet, salários, contador etc.
   - **Despesa variável**: prestadores pontuais, marketing, manutenção.
   - **Fora do DRE**: insumos (já no CMV), taxas de plataforma/cartão (já nos pedidos), equipamentos (investimento).
3. Lance, com competência 09/2026: aluguel R$ 3.000 (Custo fixo), prestador R$ 500 (Despesa variável), insumos R$ 2.000 (Fora do DRE). Edite um prestador e ajuste a conta para **Custo fixo**.
4. Abra **Relatórios → DRE**, escolha **09/2026** e confira:
   - Custos fixos = aluguel + o prestador ajustado; Despesas variáveis = demais prestadores; insumos fora.
   - "Custo fixo previsto (configuração)" e a diferença.
   - Expanda Custos fixos e abra uma categoria: a lista de contas a pagar abre filtrada pela competência e categoria, com a mesma soma.
5. Compare o resultado líquido do mês corrente na tela de DRE, no dashboard financeiro e pergunte ao assistente (tool `dre` com `mesCompetencia`).

## Regras de classificação inicial (migration)

| Classificação | Nomes de categoria que contêm |
|---|---|
| Custo fixo | aluguel, energia, luz, agua, internet, telefone, salario, folha, contab, contador, seguro, condominio, iptu, sistema, software, assinatura |
| Fora do DRE | insumo, mercadoria, materia prima, taxa, equipamento, investimento, emprestimo, financiamento, retirada, distribuicao |
| Despesa variável | demais |
