# Feature Specification: Gestao de CMV, Precificacao e Estoque

**Feature Branch**: `002-gestao-cmv-precificacao`

**Created**: 2026-05-15

**Status**: Draft

**Input**: User description: "Evoluir a plataforma atual considerando a proposta da planilha de CMV delivery hamburgueria: estimar custo dos produtos, precificar produtos, configurar parametros, calcular CMV, DRE, controlar estoque baixando conforme pedidos em andamento, e criar dominios/telas de manutencao para todos os cadastros e configuracoes, incluindo unidade de compra, fornecedor e plataformas de pedido."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configurar parametros e dominios operacionais (Priority: P1)

Como dono ou gestor da operacao, quero manter os parametros financeiros e cadastros auxiliares que alimentam CMV, precificacao, estoque e DRE, para que os calculos reflitam a realidade da loja sem depender de planilhas externas.

**Why this priority**: Sem parametros, dominios e cadastros confiaveis, os calculos de custo, margem, estoque e resultado ficam inconsistentes ou impossiveis de auditar.

**Independent Test**: Criar e editar parametros financeiros, unidades de compra, fornecedores e plataformas de pedido; usar esses registros em insumos, produtos e pedidos sem precisar inserir texto livre repetido.

**Acceptance Scenarios**:

1. **Given** uma loja piloto ativa, **When** o admin cadastra uma unidade de compra como grama, unidade ou kilo, **Then** a unidade fica disponivel para cadastro de insumos e fichas tecnicas.
2. **Given** uma loja piloto ativa, **When** o admin cadastra um fornecedor com contato e categoria, **Then** o fornecedor fica disponivel para associacao em insumos.
3. **Given** uma loja piloto ativa, **When** o admin cadastra uma plataforma de pedido com taxas padrao, como iFood, 99Food, Keeta ou WhatsApp, **Then** a plataforma fica disponivel para pedidos, precificacao e DRE.
4. **Given** parametros financeiros configurados, **When** o admin altera margem desejada, imposto, taxa de cartao, perda operacional, embalagem media, custo fixo mensal ou meta de faturamento, **Then** os calculos futuros passam a usar os novos valores.
5. **Given** qualquer cadastro usado por calculos da feature, **When** o admin acessa a area administrativa, **Then** existe uma tela de manutencao para criar, listar, editar, ativar/desativar e consultar esse cadastro.

---

### User Story 2 - Cadastrar insumos e ficha tecnica dos produtos (Priority: P1)

Como gestor da cozinha, quero cadastrar insumos com custo de compra, estoque e fornecedor, e montar a ficha tecnica de cada produto do cardapio, para saber o custo real de producao de cada item vendido.

**Why this priority**: A ficha tecnica e o custo unitario de insumos sao a base do CMV por produto, da baixa de estoque e da precificacao correta.

**Independent Test**: Cadastrar insumos, associar unidades e fornecedores, montar uma ficha tecnica para um produto ativo e verificar que o custo total do produto e recalculado automaticamente.

**Acceptance Scenarios**:

1. **Given** uma unidade de compra cadastrada, **When** o admin cria um insumo com quantidade comprada e valor de compra, **Then** o sistema calcula o custo unitario do insumo.
2. **Given** um produto do cardapio, **When** o admin adiciona insumos e quantidades usadas na ficha tecnica, **Then** o sistema calcula o custo de cada item e o CMV de ingredientes do produto.
3. **Given** um produto sem ficha tecnica completa, **When** o admin consulta precificacao ou dashboard, **Then** o sistema sinaliza que o produto precisa de ficha tecnica antes de confiar no CMV.
4. **Given** um insumo com custo atualizado, **When** o admin salva o novo custo, **Then** os custos dos produtos que usam esse insumo sao recalculados para analise futura.

---

### User Story 3 - Precificar produtos por CMV, taxas e margem alvo (Priority: P1)

Como dono da operacao, quero comparar o preco atual de cada produto com um preco ideal calculado por CMV, perdas, embalagem, taxas de canal e margem desejada, para identificar produtos que precisam de revisao.

**Why this priority**: A validacao comercial so e sustentavel se os produtos vendidos gerarem margem suficiente apos custos diretos, perdas, embalagem e taxas.

**Independent Test**: Selecionar um produto com ficha tecnica, configurar uma margem desejada e uma plataforma de pedido, e verificar CMV total, CMV percentual, preco ideal, lucro estimado, margem estimada e status de revisao.

**Acceptance Scenarios**:

1. **Given** um produto com ficha tecnica, embalagem e perdas configuradas, **When** o admin abre a analise de precificacao, **Then** o sistema mostra CMV de ingredientes, embalagem, perdas e CMV total.
2. **Given** uma plataforma de pedido com taxas configuradas, **When** o admin simula a precificacao do produto nesse canal, **Then** o sistema calcula o preco ideal considerando taxas do canal e margem desejada.
3. **Given** o preco atual e menor que o preco ideal, **When** o admin consulta a lista de precificacao, **Then** o produto aparece com status de revisao de preco.
4. **Given** o produto e vendido em mais de uma plataforma, **When** o admin alterna o canal de simulacao, **Then** o sistema mostra como margem e preco ideal mudam por canal.

---

### User Story 4 - Baixar estoque conforme pedidos em andamento (Priority: P1)

Como operador da loja, quero que os pedidos consumam estoque estimado desde o momento em que entram na fila operacional, para evitar vender produtos que dependem de insumos insuficientes durante o turno.

**Why this priority**: Em operacao real, esperar o pedido ser entregue para refletir estoque pode esconder ruptura durante preparo, especialmente quando varios pedidos entram ao mesmo tempo.

**Independent Test**: Criar pedidos com produtos que possuem ficha tecnica, manter alguns pedidos em andamento e verificar que o saldo disponivel dos insumos considera os pedidos ainda nao finalizados.

**Acceptance Scenarios**:

1. **Given** um produto com ficha tecnica e estoque suficiente, **When** um pedido entra como novo ou em preparo, **Then** o sistema reserva ou baixa o estoque estimado dos insumos desse produto.
2. **Given** um pedido em andamento e ainda nao entregue, **When** o admin consulta estoque, **Then** o saldo disponivel considera o consumo desse pedido.
3. **Given** um pedido em andamento e cancelado, **When** o cancelamento e confirmado, **Then** o sistema devolve ou compensa a reserva de estoque dos insumos.
4. **Given** um produto depende de insumo abaixo do minimo ou sem saldo suficiente, **When** o admin consulta estoque ou tenta operar o cardapio, **Then** o sistema sinaliza risco de ruptura.
5. **Given** entradas manuais de estoque foram registradas, **When** o admin consulta o saldo, **Then** o saldo considera estoque inicial, entradas, saidas por pedidos e ajustes manuais.

---

### User Story 5 - Medir resultado por DRE e dashboard gerencial (Priority: P2)

Como dono da operacao, quero acompanhar faturamento, CMV, taxas, lucro bruto, despesas fixas, lucro liquido, ponto de equilibrio e alertas de margem, para decidir preco, cardapio e metas do negocio.

**Why this priority**: A DRE transforma pedidos reais e custos cadastrados em leitura financeira minima para tomada de decisao.

**Independent Test**: Registrar ou importar pedidos entregues em diferentes plataformas e instituicoes de pagamento, configurar despesas fixas e verificar DRE, indicadores de dashboard, alertas de CMV alto, margem baixa e conciliacao entre valor bruto e valor liquido recebido.

**Acceptance Scenarios**:

1. **Given** pedidos entregues com produtos precificados, **When** o admin consulta DRE de um periodo, **Then** o sistema mostra faturamento bruto, descontos, faturamento liquido, recebido liquido das instituicoes de pagamento, CMV, taxas/impostos, lucro bruto, despesas fixas e lucro liquido estimado.
2. **Given** pedidos cancelados, **When** a DRE e calculada, **Then** eles nao entram como faturamento nem como resultado financeiro realizado.
3. **Given** o CMV percentual supera a referencia configurada, **When** o admin abre o dashboard, **Then** o sistema exibe alerta de CMV alto.
4. **Given** o faturamento esta abaixo da meta ou o lucro liquido e negativo, **When** o admin abre o dashboard, **Then** o sistema exibe status de atencao para faturamento, lucro e margem.
5. **Given** um extrato original do Mercado Pago, PagBank ou caixa local, **When** o admin importa as vendas historicas, **Then** o sistema cria pedidos entregues com data real da venda, valor bruto, taxa, valor liquido, instituicao de pagamento, meio de pagamento e identificador externo.
6. **Given** uma importacao de pedidos esta em andamento, **When** o admin aciona o processamento, **Then** a tela informa o andamento, bloqueia novo envio duplicado e mostra mensagem de conclusao ou erro.
7. **Given** vendas importadas de dias anteriores, **When** o admin filtra a DRE por esses dias, **Then** os resultados usam a data da venda informada no arquivo, nao a data da importacao.

---

### User Story 6 - Classificar produtos por menu engineering (Priority: P3)

Como dono da operacao, quero classificar produtos por volume vendido e margem, para saber quais itens impulsionar, revisar, reposicionar ou remover do cardapio.

**Why this priority**: A classificacao apoia decisoes de cardapio depois que CMV, vendas e margem ja estao confiaveis.

**Independent Test**: Usar pedidos entregues e custos calculados para classificar produtos como Estrela, Cavalo, Quebra-cabeca ou Abacaxi.

**Acceptance Scenarios**:

1. **Given** produtos com volume e margem calculados no periodo, **When** o admin abre menu engineering, **Then** o sistema mostra volume vendido, receita, CMV, lucro bruto, margem e classificacao.
2. **Given** um produto tem alto volume e alta margem, **When** a classificacao e calculada, **Then** ele aparece como Estrela.
3. **Given** um produto tem baixo volume e baixa margem, **When** a classificacao e calculada, **Then** ele aparece como Abacaxi.
4. **Given** nao ha vendas suficientes no periodo, **When** o admin consulta menu engineering, **Then** o sistema informa que a classificacao ainda nao e confiavel.

### Edge Cases

- Produto vendido sem ficha tecnica cadastrada.
- Insumo sem unidade de compra, fornecedor ou custo unitario valido.
- Unidade de compra inativada enquanto ainda e usada por insumos existentes.
- Plataforma de pedido inativada enquanto existem pedidos historicos associados.
- Pedido cancelado depois de ja ter reservado ou baixado estoque.
- Pedido alterado em quantidade ou item depois da reserva de estoque.
- Estoque negativo por venda acima do saldo estimado.
- Insumo com perda, rendimento ou conversao de unidade diferente da unidade de compra.
- Produto composto ou combo que usa outros produtos como componentes.
- Mudanca de custo de insumo depois de pedidos ja entregues.
- Pedidos de plataformas diferentes com taxas distintas no mesmo periodo.
- Configuracoes financeiras alteradas no meio de um periodo de DRE.
- Extratos de instituicoes com encoding, colunas ou status diferentes do esperado.
- Reimportacao do mesmo extrato ou da mesma transacao bancaria.
- Importacao de arquivo de caixa simplificado sem produto vendido informado.
- Vendas com valor bruto, taxa e valor liquido divergentes entre instituicoes de pagamento.
- Vendas em dinheiro ou caixa local sem identificador externo de adquirente.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST keep financial and operational parameters per tenant, including platform fees, taxes, card/payment fees, operational loss percentage, average packaging cost, desired margin, monthly fixed cost and monthly revenue goal.
- **FR-002**: System MUST provide maintenance screens for every CRUD entity introduced by this feature, including domain tables, parameters, suppliers, ingredients, technical sheets, stock adjustments and order platforms.
- **FR-003**: System MUST allow admins to create, view, edit, activate/deactivate and search purchase units such as gram, kilogram, unit, liter and package.
- **FR-004**: System MUST allow admins to create, view, edit, activate/deactivate and search suppliers with contact, category and notes.
- **FR-005**: System MUST allow admins to create, view, edit, activate/deactivate and search order platforms such as iFood, 99Food, Keeta, WhatsApp and own channel, including default fee rules.
- **FR-006**: System MUST allow admins to create, view, edit, activate/deactivate and search ingredients/inputs with purchase unit, purchase quantity, purchase cost, calculated unit cost, current stock, minimum stock and supplier.
- **FR-007**: System MUST allow admins to maintain technical sheets for sellable products, linking each product to ingredients, quantities used, unit, optional notes and calculated item cost.
- **FR-008**: System MUST calculate product ingredient CMV from the current technical sheet and ingredient unit costs.
- **FR-009**: System MUST calculate product total CMV using ingredient CMV, packaging cost and operational loss rules while preventing double counting when packaging is explicitly part of the technical sheet.
- **FR-010**: System MUST calculate current CMV percentage, ideal price, estimated profit, estimated margin and review status for each product.
- **FR-011**: System MUST support price simulation by order platform/channel, because each platform may have different fees.
- **FR-012**: System MUST identify products with missing or incomplete technical sheets before treating their CMV and ideal price as reliable.
- **FR-013**: System MUST associate orders with an order platform/channel for fee calculation and profitability analysis.
- **FR-014**: System MUST reserve or reduce estimated ingredient stock when orders enter an in-progress operational state.
- **FR-015**: System MUST release or compensate reserved ingredient stock when an in-progress order is cancelled.
- **FR-016**: System MUST preserve historical order profitability snapshots so later ingredient cost or configuration changes do not rewrite already delivered order results.
- **FR-017**: System MUST calculate estimated stock balance from current stock, manual entries, manual adjustments, reservations/outputs from in-progress orders and completed sales.
- **FR-018**: System MUST alert when estimated stock balance is at or below minimum stock or when a product is at risk because a required ingredient is insufficient.
- **FR-019**: System MUST provide a DRE view by period with gross revenue, discounts, net revenue, acquired/payment net revenue, CMV, platform/payment/tax costs, gross profit, fixed expenses, estimated net profit, net margin and break-even point.
- **FR-020**: System MUST exclude cancelled orders from realized revenue and realized DRE results.
- **FR-021**: System MUST provide dashboard indicators for revenue goal, CMV percentage, net profit, net margin, average ticket, products needing price review and ingredients needing purchase.
- **FR-022**: System MUST classify products by menu engineering using sales volume and margin into Estrela, Cavalo, Quebra-cabeca or Abacaxi.
- **FR-023**: System MUST keep all financial, stock and catalog operations tenant-scoped.
- **FR-024**: System MUST log relevant changes to costs, parameters, stock adjustments, technical sheets and price recommendations for auditability.
- **FR-025**: System MUST support importing delivered historical orders from a simple CSV layout and institution-specific layouts for Mercado Pago and PagBank.
- **FR-026**: System MUST persist payment institution, payment method, external payment identifier, gross amount, fee amount, net amount and payment brand when those values are available in imported payment extracts.
- **FR-027**: System MUST prevent duplicate imports by recognizing previously imported payment identifiers or import keys.
- **FR-028**: System MUST use the sale/transaction date from the imported file for orders and profitability snapshots used by DRE and menu engineering.
- **FR-029**: System MUST support payment institutions PagBank, Mercado Pago, Dinheiro and Caixa Local, and payment methods debit, credit, voucher, pix and cash.
- **FR-030**: System MUST show visible import progress, completion and error messages when admins import historical orders.

### Key Entities _(include if feature involves data)_

- **Financial Configuration**: Tenant-level financial parameters used in pricing, CMV, DRE and dashboard.
- **Purchase Unit**: Domain record for units such as gram, kilogram, unit, liter and package.
- **Supplier**: Provider of ingredients or packaging, with contact and category information.
- **Order Platform**: Sales channel such as iFood, 99Food, Keeta, WhatsApp or own channel, including fee configuration and active state.
- **Payment Institution**: Payment processor or local cash source such as PagBank, Mercado Pago, Dinheiro or Caixa Local.
- **Payment Reconciliation Data**: Payment fields linked to an order, including external transaction identifier, gross amount, fee amount, net amount and card/payment brand.
- **Ingredient/Input**: Purchasable item used in products, with purchase quantity, purchase cost, unit cost, stock level, minimum stock and supplier.
- **Technical Sheet**: Product recipe/composition defining which ingredients and quantities are consumed by one sellable product.
- **Product Cost Snapshot**: Calculated CMV and pricing values for a product at a point in time or for a specific channel.
- **Stock Movement**: Entry, adjustment, reservation, consumption or release that changes estimated stock.
- **Order Profitability Snapshot**: Per-order financial snapshot containing revenue, discounts, CMV, channel fees, taxes and gross profit, dated by the realized sale date.
- **DRE Period Summary**: Aggregated financial result for a selected period.
- **Menu Engineering Classification**: Product classification based on volume and margin for a selected period.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admin can configure required domains and financial parameters for a pilot store in under 30 minutes.
- **SC-002**: Admin can create a complete technical sheet for a product with at least 5 ingredients in under 5 minutes.
- **SC-003**: For products with complete technical sheets, product CMV and ideal price are recalculated immediately after relevant cost or parameter changes.
- **SC-004**: When a new in-progress order is created, estimated stock impact appears in stock views within 5 seconds.
- **SC-005**: Cancelled in-progress orders release their stock impact with no manual correction required in at least 95% of standard cancellation cases.
- **SC-006**: DRE for a selected period matches manually checked revenue, CMV and fee totals for sampled pilot orders.
- **SC-007**: Dashboard identifies products needing price review and ingredients below minimum stock without spreadsheet export.
- **SC-008**: Pilot operator can identify top 5 products by volume and margin classification for a period in under 1 minute.

## Assumptions

- Existing tenant, authentication, catalog and order flows from the delivery pilot will be reused.
- The first version focuses on estimated operational stock, not fiscal inventory or accounting-grade stock valuation.
- In-progress orders include operational statuses before final delivery or cancellation.
- Delivered orders should keep historical financial snapshots even if costs or parameters change later.
- Platform fee rules start as percentage-based defaults, with room for later fixed fees or tiered rules.
- Manual stock entries and adjustments are in scope; supplier purchase orders and accounts payable are out of scope for the first version.
- Combo products may initially be represented through technical sheet components; advanced nested product recipes can be refined later if needed.
