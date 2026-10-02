export const METRICS_GLOSSARY = `# Glossario de metricas - RRFive OS

## Regras gerais
- Datas no formato AAAA-MM-DD, no fuso America/Sao_Paulo.
- Cada consulta aceita no maximo 92 dias. Para periodos maiores, consulte em partes e some.
- Valores monetarios em reais (campos terminados em "Reais"), com duas casas decimais.
- Percentuais de 0 a 100 (campos terminados em "Percentual"), com uma casa decimal.
- Listas trazem no maximo 50 itens; "truncado: true" indica que existem mais ("totalItens").
- "semMovimento: true" indica que nao houve dados no periodo (nao e erro).
- Toda resposta informa o periodo efetivamente usado em "periodo" ("padraoAplicado" indica que as datas nao foram informadas).

## Vendas
- **Faturamento bruto**: soma do valor pago pelos clientes nos pedidos (por padrao, apenas pedidos entregues).
- **Receita liquida**: faturamento bruto menos taxas da adquirente/plataforma de pagamento.
- **Liberado / a receber**: parte da receita liquida ja disponivel ou ainda a ser repassada pela instituicao.
- **Ticket medio**: faturamento bruto dividido pela quantidade de pedidos.
- **Participacao**: fatia do faturamento bruto de uma plataforma, meio de pagamento ou instituicao.

## DRE
- **Receita liquida (DRE)**: receita bruta menos descontos.
- **CMV (custo da mercadoria vendida)**: custo dos ingredientes dos itens vendidos, pela ficha tecnica.
- **Taxas e impostos**: taxa da plataforma, taxa de pagamento e impostos estimados.
- **Lucro bruto / margem de contribuicao**: receita liquida menos CMV, taxas e impostos.
- **Despesas fixas**: custo fixo mensal configurado pela loja.
- **Lucro liquido estimado**: lucro bruto menos despesas fixas.
- **Ponto de equilibrio**: receita necessaria para cobrir as despesas fixas com a margem de contribuicao atual.

## Engenharia de cardapio
Cada produto e comparado com a media de volume vendido e de margem do periodo:
- **STAR (estrela)**: volume e margem acima da media. Manter e destacar.
- **WORKHORSE (burro de carga)**: volume alto, margem baixa. Revisar preco ou ficha tecnica.
- **PUZZLE (quebra-cabeca)**: margem alta, volume baixo. Promover ou reposicionar.
- **DOG (cao)**: volume e margem abaixo da media. Avaliar retirada.
"dadosInsuficientes" indica menos de 2 produtos vendidos, sem classificacao confiavel.

## Caixa
- **Saldo atual**: soma das entradas e saidas realizadas ate a data de referencia.
- **Projecao**: saldo atual + recebiveis previstos - contas a pagar em aberto, dia a dia.
- **saldoNegativoPrevisto**: indica algum dia da projecao com saldo abaixo de zero.

## Contas a pagar
- **OPEN**: em aberto, dentro do prazo. **PARTIALLY_PAID**: pago em parte.
- **OVERDUE**: vencida e nao quitada. **PAID**: quitada. **CANCELLED**: cancelada.

## Estoque
- **Saldo estimado**: estoque atual + entradas manuais - consumo/reservas de pedidos.
- **OK**: acima do minimo. **BUY**: no minimo ou abaixo (comprar). **INSUFFICIENT**: saldo zerado ou negativo.
`;
