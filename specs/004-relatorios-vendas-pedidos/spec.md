# Feature Specification: Relatorios de Vendas e Pedidos

**Feature Branch**: `004-relatorios-vendas-pedidos`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "Criar um modulo de relatorios, iniciando por vendas/pedidos, dando visibilidade de evolucao diaria, possibilidade de consulta por periodo, com possibilidade de consulta analitica."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acompanhar evolucao diaria de vendas (Priority: P1)

Como dono ou gestor da loja, quero visualizar a evolucao diaria de vendas e pedidos em um periodo, para entender rapidamente quais dias performaram melhor, pioraram ou precisam de investigacao.

**Why this priority**: A visao diaria e a primeira leitura operacional para acompanhar movimento, sazonalidade, efeito de campanhas, dias fracos e fechamento de turno.

**Independent Test**: Selecionar um periodo com pedidos importados ou cadastrados e verificar se o relatorio mostra, por dia, quantidade de pedidos, receita bruta, recebido liquido, taxas, ticket medio, variacao em relacao ao dia anterior e um grafico visual da evolucao diaria.

**Acceptance Scenarios**:

1. **Given** existem pedidos entregues em diferentes dias, **When** o admin abre o relatorio de vendas com um periodo selecionado, **Then** o sistema mostra uma linha por dia com totais consolidados.
2. **Given** um dia nao possui pedidos entregues, **When** o periodo inclui esse dia, **Then** o sistema exibe o dia com valores zerados ou indica ausencia de vendas sem quebrar a sequencia diaria.
3. **Given** os pedidos possuem dados de conciliacao de pagamento, **When** o admin consulta a evolucao diaria, **Then** o sistema diferencia receita bruta de recebido liquido.
4. **Given** ha taxas de pagamento registradas, **When** o admin consulta o periodo, **Then** o sistema mostra o total de taxas por dia e permite comparar com o faturamento bruto.
5. **Given** o periodo possui dois ou mais dias, **When** o admin abre a evolucao diaria, **Then** o sistema apresenta um grafico de tendencia por dia antes da tabela analitica diaria.
6. **Given** o admin altera periodo ou filtros, **When** o relatorio e atualizado, **Then** o grafico usa exatamente os mesmos dados consolidados exibidos nos cards e na tabela diaria.
7. **Given** existem dias sem venda no periodo, **When** o grafico e exibido, **Then** esses dias aparecem na linha temporal com valor zero para preservar a leitura da sequencia.

---

### User Story 2 - Filtrar vendas por periodo e dimensoes principais (Priority: P1)

Como gestor da operacao, quero consultar vendas por periodo e filtrar por instituicao de pagamento, meio de pagamento, canal/plataforma e status, para responder perguntas de fechamento e conciliacao sem abrir planilhas externas.

**Why this priority**: O relatorio precisa ser util para fechamento real, incluindo vendas importadas de Mercado Pago, PagBank, Caixa Local e canais operacionais.

**Independent Test**: Escolher um intervalo de datas, aplicar filtros de instituicao e meio de pagamento, e confirmar que os totais e a lista analitica refletem somente os pedidos filtrados.

**Acceptance Scenarios**:

1. **Given** existem vendas de Mercado Pago, PagBank e Caixa Local, **When** o admin filtra por uma instituicao, **Then** os indicadores e detalhes mostram apenas pedidos daquela instituicao.
2. **Given** existem vendas em debito, credito, pix, voucher e dinheiro, **When** o admin filtra por meio de pagamento, **Then** os totais respeitam o meio selecionado.
3. **Given** existem pedidos em canais diferentes, **When** o admin filtra por canal/plataforma, **Then** a visao consolida apenas as vendas do canal selecionado.
4. **Given** o admin altera o periodo, **When** o filtro e aplicado, **Then** todos os cards, graficos/tabelas e analitico usam o mesmo intervalo.

---

### User Story 3 - Consultar analitico de pedidos (Priority: P2)

Como dono ou operador financeiro, quero ver uma lista analitica dos pedidos que compoem os totais, para auditar valores, identificar divergencias e rastrear uma venda especifica.

**Why this priority**: A consolidacao diaria mostra o comportamento, mas a operacao precisa de detalhe por pedido para conciliacao e investigacao.

**Independent Test**: Selecionar um periodo e abrir o analitico com pedidos, verificando data/hora, identificador externo, instituicao, meio de pagamento, canal, valor bruto, taxa, recebido liquido, produto atribuido e status.

**Acceptance Scenarios**:

1. **Given** um dia do relatorio possui pedidos, **When** o admin acessa o analitico desse dia, **Then** o sistema lista os pedidos que formam os totais daquele dia.
2. **Given** um pedido foi importado de uma instituicao de pagamento, **When** ele aparece no analitico, **Then** o sistema mostra o identificador externo e valores bruto, taxa e liquido.
3. **Given** uma venda foi importada sem produto real informado, **When** o admin consulta o analitico, **Then** o sistema mostra o produto atribuido automaticamente e deixa claro que a origem foi importacao.
4. **Given** ha muitos pedidos no periodo, **When** o admin consulta o analitico, **Then** o sistema permite paginacao ou carregamento incremental para manter a consulta utilizavel.

---

### User Story 4 - Comparar mix de pagamento e canais (Priority: P3)

Como gestor financeiro, quero resumir vendas por instituicao, meio de pagamento e canal, para entender concentracao de recebimentos, custo de taxa e dependencia de plataformas.

**Why this priority**: Depois da visao diaria e do analitico, agregacoes por dimensao ajudam decisao sobre maquininha, pix, dinheiro, marketplaces e canal proprio.

**Independent Test**: Filtrar um periodo com vendas em multiplas instituicoes e verificar rankings por instituicao, meio de pagamento e canal com quantidade, bruto, taxas e liquido.

**Acceptance Scenarios**:

1. **Given** existem vendas em mais de uma instituicao, **When** o admin abre o resumo por instituicao, **Then** o sistema mostra quantidade, bruto, taxas e liquido por instituicao.
2. **Given** existem meios de pagamento diferentes, **When** o admin consulta o resumo por meio, **Then** o sistema mostra participacao de cada meio no total.
3. **Given** existem vendas por canais diferentes, **When** o admin consulta o resumo por canal, **Then** o sistema mostra quais canais geram maior receita e maior custo de taxa.

---

### User Story 5 - Acompanhar valores a receber por liberacao de pagamento (Priority: P1)

Como dono ou gestor financeiro, quero diferenciar valores ja liberados pelo banco/adquirente dos valores ainda a receber, para entender o saldo real disponivel sem confundir vendas aprovadas com dinheiro efetivamente liberado.

**Why this priority**: Vendas em voucher e alguns meios de pagamento podem ser aprovadas no dia da venda, mas liberadas apenas depois, como D+30. Sem essa separacao, o relatorio superestima o saldo disponivel no periodo.

**Independent Test**: Importar extratos Mercado Pago e PagBank com data de liberacao preenchida e vazia, filtrar o periodo das vendas e verificar se o relatorio mostra valores liberados, valores a receber e data prevista de liberacao conforme a regra.

**Acceptance Scenarios**:

1. **Given** uma venda importada do Mercado Pago possui `RELEASE_DATETIME`, **When** o pedido e importado, **Then** o sistema guarda essa data como data prevista de liberacao do pagamento.
2. **Given** uma venda importada do PagBank possui `Data prevista de liberacao`, **When** o pedido e importado, **Then** o sistema guarda essa data como data prevista de liberacao do pagamento.
3. **Given** a data prevista de liberacao veio vazia no extrato, **When** o pedido e importado, **Then** o sistema define a liberacao prevista como 30 dias apos a data da venda.
4. **Given** uma venda possui liberacao prevista futura, **When** o admin consulta o relatorio de vendas, **Then** o valor liquido dessa venda nao entra no total de valores liberados/disponiveis do dia.
5. **Given** existem vendas filtradas com liberacao prevista futura, **When** o admin consulta o relatorio, **Then** o sistema mostra uma caixa de "Valores a receber" somando os valores liquidos pendentes.
6. **Given** o admin aplica filtros por instituicao, meio de pagamento, canal ou status, **When** existem valores pendentes nesse subconjunto, **Then** a caixa de "Valores a receber" considera apenas as operacoes filtradas.
7. **Given** um pedido aparece no analitico, **When** ele possui data prevista de liberacao, **Then** o sistema mostra essa data e indica se o pagamento esta liberado ou a receber.

### Edge Cases

- Periodo sem pedidos entregues.
- Pedidos importados com data de venda anterior a data de importacao.
- Pedidos sem valor liquido de adquirente, como caixa local ou registros manuais.
- Reimportacao de vendas ja existentes.
- Divergencia entre valor bruto, taxa e valor liquido no extrato.
- Vendas de dias diferentes por causa de horario/fuso local.
- Pedido cancelado ou nao entregue aparecendo indevidamente no relatorio.
- Produto atribuido automaticamente em importacao, sem item real vendido informado.
- Volume alto de pedidos no analitico, exigindo paginacao.
- Filtros combinados que retornam vazio.
- Periodos muito curtos, como apenas um dia, em que o grafico deve continuar legivel ou mostrar comparacao limitada.
- Periodos com muitos dias, em que o grafico deve permanecer legivel sem sobrepor rotulos.
- Diferencas grandes entre receita bruta e recebida liquida, em que o grafico deve deixar claro qual serie esta sendo visualizada.
- Extratos de pagamento sem data prevista de liberacao.
- Vendas de voucher aprovadas no dia, mas com repasse previsto apenas em D+30.
- Data prevista de liberacao anterior ou igual ao dia atual.
- Data prevista de liberacao futura fora do periodo filtrado.
- Operacoes manuais/dinheiro/caixa local sem dependencia de banco adquirente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a sales/orders report module accessible from the admin area.
- **FR-002**: System MUST allow admins to select a date period for the sales report.
- **FR-003**: System MUST show daily evolution for the selected period with order count, gross revenue, acquired net revenue, payment fees and average ticket.
- **FR-004**: System MUST use the realized order sale date for period grouping, including imported historical orders.
- **FR-005**: System MUST exclude cancelled or non-delivered orders from realized sales totals by default.
- **FR-006**: System MUST allow filtering by payment institution, payment method, order platform/channel and order status when applicable.
- **FR-007**: System MUST provide an analytical order list for the selected period and filters.
- **FR-008**: Analytical order rows MUST show date/time, status, channel/platform, payment institution, payment method, external payment ID, gross amount, fee amount, net amount and assigned product summary when available.
- **FR-009**: System MUST support drill-down from a daily row into the analytical orders for that day.
- **FR-010**: System MUST show totals that remain consistent between daily summary, filters and analytical list.
- **FR-011**: System MUST show empty states when no sales exist for a selected period or filter combination.
- **FR-012**: System MUST provide summaries by payment institution, payment method and order platform/channel.
- **FR-013**: System MUST identify imported orders and show reconciliation fields when available.
- **FR-014**: System MUST handle orders without acquired net amount by using gross amount as fallback for received net reporting.
- **FR-015**: System MUST keep all report data tenant-scoped.
- **FR-016**: System SHOULD allow exporting or copying analytical results in a later increment, but export is not required for the first release.
- **FR-017**: System MUST show a visual daily evolution chart for the selected period.
- **FR-018**: The daily evolution chart MUST support comparing at least gross revenue and acquired net revenue over time.
- **FR-019**: The daily evolution chart MUST use the same active period and filters as the summary cards, daily table and analytical list.
- **FR-020**: The daily evolution chart MUST remain readable on desktop and mobile layouts, including periods with zero-sale days.
- **FR-021**: The daily evolution chart MUST provide clear empty-state feedback when no sales exist for the selected period or filters.
- **FR-022**: System MUST persist the payment release expected date when imported extracts provide it.
- **FR-023**: System MUST map Mercado Pago `RELEASE_DATETIME` and PagBank `Data prevista de liberacao` into the order payment reconciliation data.
- **FR-024**: System MUST set payment release expected date to sale date plus 30 calendar days when an imported payment row has no release date.
- **FR-025**: System MUST separate net payment amount into released/available and pending receivable amounts.
- **FR-026**: System MUST exclude payments with future release expected date from released/available daily totals.
- **FR-027**: System MUST show a "Valores a receber" summary for the active filters when one or more payments are pending release.
- **FR-028**: Analytical order rows MUST show payment release expected date and release status when available.

### Key Entities *(include if feature involves data)*

- **Sales Report Period**: Date interval selected by the admin for all summaries and analytical queries.
- **Daily Sales Summary**: Aggregated sales metrics for one local business day.
- **Daily Sales Trend Chart**: Visual representation of daily sales metrics across the selected period, derived from the same daily summary data.
- **Sales Analytical Order**: Order-level row containing operational, payment and reconciliation details.
- **Payment Dimension Summary**: Aggregation by payment institution or payment method.
- **Channel Summary**: Aggregation by order platform/channel.
- **Report Filter Set**: Selected period, institution, method, channel and status constraints applied consistently across the report.
- **Payment Release Expected Date**: Date when the bank, acquirer or voucher provider is expected to release the net payment amount.
- **Receivable Amount**: Net payment amount from approved sales whose release expected date is later than the report reference date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can identify daily gross revenue, received net revenue and order count for a selected month in under 30 seconds.
- **SC-002**: Admin can filter vendas by institution or payment method and see updated totals in under 3 seconds for pilot-scale data.
- **SC-003**: Daily summary totals and analytical order totals match for the same filters in 100% of sampled validation periods.
- **SC-004**: Imported sales from previous days appear on their original sale date in the report in 100% of sampled imports.
- **SC-005**: Admin can locate a specific imported payment transaction by external ID in under 1 minute.
- **SC-006**: Report handles periods with no sales without errors and clearly communicates that no records were found.
- **SC-007**: Admin can identify the highest and lowest sales day in a selected period from the chart in under 15 seconds.
- **SC-008**: Chart values and daily table values match for 100% of sampled validation periods.
- **SC-009**: Voucher or other imported sales without release date are classified as receivable with D+30 release in 100% of sampled imports.
- **SC-010**: Released/available net amount plus receivable amount equals total acquired net amount in 100% of sampled filtered periods.
- **SC-011**: Admin can identify pending receivables for the current filter set in under 15 seconds.

## Assumptions

- The module starts with sales/orders reports only; DRE, inventory and menu engineering remain in their existing areas.
- Existing order, payment institution, payment method, platform and reconciliation fields will be reused.
- The first release prioritizes on-screen analysis; export can be added later.
- Period filters use local business dates for the operation.
- Reports are for admin/owner usage and are scoped to the authenticated tenant.
- The first chart increment focuses on daily trend readability; advanced interactions such as custom series selection, export and annotations can be added later.
- For imported payment rows without release date, the default release rule is D+30 from the sale date.
- Cash, manual pix and caixa local operations are considered immediately available unless a payment release expected date is explicitly provided.
