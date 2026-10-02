# Feature Specification: DRE por Competência com Despesas Lançadas

**Feature Branch**: `027-dre-by-competence`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Quero fazer uma mudança no DRE. Hoje os cálculos consideram valores de custos fixos por parametrização. Gostaria de deixar ajustável, de acordo com o que temos de despesas no período. Gostaria de avaliar incluir nas despesas um atributo, para indicar se a despesa é fixa, no DRE, considerar como custos fixos essas despesas, respeitando a competência (mês). Além das despesas fixas, também considerar as despesas lançadas para a competência selecionada. Na tela de DRE, considerar a competência e não um período."

## Contexto

Hoje o DRE calcula o resultado dos pedidos entregues (receita, CMV, taxas e impostos) e subtrai um único valor de "custo fixo mensal" informado em Configurações, aplicado inteiro qualquer que seja o tamanho do período consultado. As despesas reais lançadas em **Contas a pagar** não entram no resultado.

Os lançamentos de contas a pagar já têm categoria e competência (mês). Parte deles, porém, não deve entrar como despesa no DRE, sob pena de contar o mesmo custo duas vezes:
- compras de insumos, cujo custo já entra no CMV pelas fichas técnicas;
- taxas que já são descontadas dos pedidos;
- investimentos, como a compra de equipamentos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Classificar despesas para o DRE (Priority: P1)

Como gestor financeiro, eu quero indicar como cada despesa entra no DRE (custo fixo, despesa variável ou fora do DRE), para que o resultado reflita os gastos reais da loja sem contar duas vezes o que já está no CMV ou nas taxas dos pedidos.

**Why this priority**: Sem a classificação, não dá para separar custos fixos de variáveis nem evitar a dupla contagem. É a base das demais histórias.

**Independent Test**: Classificar "Aluguel" como custo fixo, "Prestador de Serviço" como despesa variável e "Insumos" como fora do DRE, e conferir que a classificação aparece nas telas de categorias e de contas a pagar.

**Acceptance Scenarios**:

1. **Given** as categorias financeiras da loja, **When** o gestor edita uma categoria, **Then** pode escolher a classificação para o DRE: **Custo fixo**, **Despesa variável** ou **Fora do DRE**, com uma explicação curta de cada opção.
2. **Given** uma categoria nova, **When** criada sem escolha explícita, **Then** recebe a classificação padrão **Despesa variável**.
3. **Given** a classificação definida, **When** o gestor lança ou edita uma conta a pagar, **Then** a conta herda a classificação da categoria e pode **sobrescrevê-la** com uma das três opções, ou voltar a "Seguir a categoria". A lista de contas a pagar mostra a classificação efetiva e indica quando ela foi ajustada na conta.
4. **Given** contas recorrentes (geradas por recorrência), **When** criadas com um ajuste de classificação, **Then** todas as ocorrências recebem o mesmo ajuste.
5. **Given** uma conta que segue a categoria, **When** a categoria muda de classificação, **Then** a conta passa a usar a nova classificação. Contas com ajuste próprio mantêm o ajuste.
6. **Given** a mudança de classificação de uma categoria, **When** salva, **Then** os DREs de qualquer competência passam a refletir a nova classificação e a alteração é registrada na auditoria financeira.

---

### User Story 2 - DRE por competência com despesas lançadas (Priority: P1)

Como dono da loja, eu quero escolher um mês de competência e ver o DRE com as vendas do mês, os custos fixos e as despesas variáveis lançados para aquela competência, para saber o resultado real do mês.

**Why this priority**: É o objetivo principal do pedido: resultado ajustável conforme as despesas reais.

**Independent Test**: Para setembro de 2026, lançar aluguel (custo fixo) de R$ 3.000, um prestador de serviço (despesa variável) de R$ 500 e uma compra de insumos (fora do DRE) de R$ 2.000, todos com competência 09/2026. O DRE de 09/2026 deve mostrar custos fixos de R$ 3.000 e despesas variáveis de R$ 500, sem considerar os insumos, e o resultado líquido igual a margem de contribuição − 500 − 3.000.

**Acceptance Scenarios**:

1. **Given** a tela de DRE, **When** aberta, **Then** mostra um seletor de **mês de competência** (padrão: mês corrente) no lugar do período de datas.
2. **Given** um mês de competência, **When** o DRE é calculado, **Then** a receita, o CMV e as taxas consideram os pedidos entregues do mês (no fuso da loja), com as mesmas regras de hoje.
3. **Given** contas a pagar com competência no mês, **When** o DRE é calculado, **Then**:
   - contas de **Custo fixo** somam na linha **Custos fixos**;
   - contas de **Despesa variável** somam na linha **Despesas variáveis**;
   - contas **Fora do DRE** não entram.
4. **Given** uma conta a pagar sem competência informada, **When** o DRE é calculado, **Then** ela é considerada no mês do seu vencimento.
5. **Given** contas canceladas, **When** o DRE é calculado, **Then** são ignoradas. Contas em aberto, parcialmente pagas e pagas entram pelo valor previsto (regime de competência, independente de pagamento).
6. **Given** o DRE calculado, **When** exibido, **Then** apresenta a estrutura:
   - Receita bruta
   - (−) Descontos
   - = Receita líquida
   - (−) CMV
   - (−) Taxas e impostos
   - = Margem de contribuição
   - (−) Despesas variáveis
   - (−) Custos fixos
   - = Resultado líquido

   Também mostra margem líquida (%) e ponto de equilíbrio (custos fixos ÷ % de margem de contribuição após despesas variáveis).
7. **Given** o DRE exibido, **When** o gestor expande **Custos fixos** ou **Despesas variáveis**, **Then** vê o total por categoria e pode abrir a lista de contas a pagar daquela categoria e competência.
8. **Given** um mês sem vendas ou sem despesas, **When** consultado, **Then** o DRE mostra zeros, sem erro.

---

### User Story 3 - Custo fixo parametrizado como referência (Priority: P2)

Como gestor, eu quero saber o que acontece com o "custo fixo mensal" da configuração, para não perder a referência que já uso.

**Why this priority**: Evita confusão na transição. Não bloqueia o cálculo com despesas reais.

**Independent Test**: Com custo fixo parametrizado de R$ 5.000 e R$ 3.000 de custos fixos lançados em 09/2026, abrir o DRE de 09/2026 e conferir o comportamento escolhido.

**Acceptance Scenarios**:

1. **Given** um custo fixo mensal parametrizado e custos fixos lançados no mês, **When** o DRE é exibido, **Then** o resultado usa **somente os custos fixos lançados**. O valor parametrizado aparece como **"Custo fixo previsto (configuração)"**, ao lado do realizado, com a diferença (acima ou abaixo do previsto).
2. **Given** a tela de Configurações, **When** exibida, **Then** o campo passa a se chamar "Custo fixo mensal previsto", com a explicação de que é referência para o DRE e não entra no cálculo do resultado.
3. **Given** um mês sem custos fixos lançados e um previsto maior que zero, **When** o DRE é exibido, **Then** mostra um aviso: "Nenhum custo fixo lançado para esta competência".

---

### User Story 4 - Mesmo critério nos demais consumidores do DRE (Priority: P2)

Como usuário do dashboard financeiro e dos assistentes de IA (MCP), eu quero que os números do resultado sejam os mesmos da tela de DRE.

**Why this priority**: Consistência entre telas e assistentes. Depende das histórias 1 e 2.

**Independent Test**: Comparar o lucro líquido do mês corrente na tela de DRE, no dashboard financeiro e na tool `dre` do MCP.

**Acceptance Scenarios**:

1. **Given** o dashboard financeiro, **When** exibido, **Then** os indicadores de resultado do mês corrente usam a mesma regra do DRE por competência.
2. **Given** a tool `dre` do MCP, **When** chamada, **Then** aceita `mesCompetencia` (`AAAA-MM`, padrão: mês corrente) e devolve as novas linhas (despesas variáveis, custos fixos por categoria). Chamadas antigas com `inicio`/`fim` passam a usar o mês de `inicio`, informando isso na resposta.
3. **Given** a tool `contas_a_pagar` do MCP, **When** devolve contas, **Then** inclui a classificação para o DRE de cada conta.
4. **Given** o Painel (tela principal), **When** exibido, **Then** o bloco de resultado indica o mês de competência, mostra as mesmas linhas do DRE (receita líquida, CMV, taxas, impostos, margem de contribuição, despesas variáveis, custos fixos, resultado líquido), destaca prejuízo, avisa quando não há custo fixo lançado e leva ao DRE do mês.

---

### User Story 5 - Taxas reais dos pedidos (Priority: P1)

Como gestor, eu quero que o DRE use as taxas que as plataformas e adquirentes realmente cobraram em cada pedido, para não superestimar o resultado.

**Why this priority**: Pedidos importados (Mercado Pago, PagBank, Food Truck) trazem bruto e líquido reais, mas o DRE estimava as taxas por percentual — e essas plataformas estão a 0%, então nenhuma taxa era descontada. No Mercado Pago o campo de taxa ainda omite o custo de parcelamento; o custo real é bruto − líquido.

**Independent Test**: Mês com um pedido importado (bruto R$ 139,00, líquido R$ 134,69) e um pedido de balcão no cartão (R$ 100,00, taxa de cartão configurada 3,5%, imposto 6%). Taxas de venda = 4,31 (real) + 3,50 (estimada) = R$ 7,81; impostos = 6% sobre a receita líquida dos dois.

**Acceptance Scenarios**:

1. **Given** um pedido entregue com bruto e líquido de pagamento reais, **When** o DRE é calculado, **Then** as taxas de plataforma e de pagamento desse pedido são substituídas por bruto − líquido (nunca negativo).
2. **Given** um pedido sem esses valores, **When** o DRE é calculado, **Then** continua a estimativa pelos percentuais da plataforma e da configuração.
3. **Given** o DRE, **When** exibido, **Then** "Taxas de plataforma e pagamento" e "Impostos (estimados)" aparecem em linhas separadas, informando quanto das taxas é real e quanto é estimado (valor e quantidade de pedidos).
4. **Given** meses anteriores, **When** consultados, **Then** a regra vale também para eles (é aplicada no cálculo, sem alterar os snapshots).

---

### Edge Cases

- **Categoria classificada como Fora do DRE com contas já lançadas**: as contas deixam de entrar no DRE de qualquer competência, inclusive passadas. A tela de categorias avisa isso ao alterar.
- **Conta com competência em um mês e vencimento em outro**: vale a competência.
- **Conta editada mudando de competência**: sai do DRE do mês antigo e entra no novo.
- **Mês com receita líquida zero**: margens e ponto de equilíbrio mostram zero, sem divisão por zero.
- **Resultado negativo**: exibido como prejuízo, em destaque.
- **Ponto de equilíbrio sem margem positiva**: exibido como "não atingível com a margem atual".
- **Competências futuras**: permitidas (útil para projeção com contas já lançadas). A receita aparece zerada.

## Requirements *(mandatory)*

### Functional Requirements

**Classificação**

- **FR-001**: O sistema MUST permitir classificar despesas para o DRE em **Custo fixo**, **Despesa variável** ou **Fora do DRE**. A classificação padrão fica na **categoria financeira**, e cada **conta a pagar** pode sobrescrevê-la ou seguir a categoria. A classificação efetiva é a da conta, quando ajustada, ou a da categoria.
- **FR-002**: Categorias novas MUST nascer como **Despesa variável**. Categorias existentes MUST receber uma classificação inicial na implantação, com sugestão automática pelo nome. Por exemplo, aluguel, energia, água, internet e salários como custo fixo; insumos, taxas e equipamentos como fora do DRE. O gestor revisa depois.
- **FR-003**: Contas recorrentes MUST manter a mesma classificação em todas as ocorrências.
- **FR-004**: Alterações de classificação MUST ser auditadas.

**DRE**

- **FR-005**: A tela de DRE MUST usar um **mês de competência** como filtro, com padrão no mês corrente.
- **FR-006**: Receita, descontos, CMV e impostos MUST seguir as regras atuais, restritas aos pedidos entregues do mês no fuso da loja. Taxas de plataforma e pagamento seguem a FR-011.
- **FR-011**: Para pedidos com bruto e líquido de pagamento reais, as taxas de venda MUST ser bruto − líquido (mínimo zero), no lugar das taxas estimadas; sem esses valores, MUST seguir a estimativa por percentual. Impostos continuam estimados pelo percentual configurado. O DRE, o Painel e o MCP MUST exibir taxas e impostos separados, com a parcela real e a estimada das taxas.
- **FR-007**: Custos fixos e despesas variáveis MUST somar o valor previsto das contas a pagar não canceladas cuja competência, ou na falta dela o vencimento, cai no mês, conforme a classificação.
- **FR-008**: O DRE MUST exibir as linhas de US2-6, com margem líquida e ponto de equilíbrio, e o detalhamento por categoria com acesso às contas.
- **FR-009**: O custo fixo mensal parametrizado MUST deixar de entrar no cálculo do resultado e ser exibido no DRE como "previsto", com a diferença para o realizado.
- **FR-010**: O dashboard financeiro, o Painel e a tool `dre` do MCP MUST usar a mesma regra de cálculo. A tool `contas_a_pagar` MUST expor a classificação.

### Key Entities

- **Classificação para o DRE**: Custo fixo, Despesa variável ou Fora do DRE. Fica na categoria financeira (padrão) e, opcionalmente, na conta a pagar (ajuste).
- **Competência**: mês (`AAAA-MM`) que define em qual DRE a despesa e as vendas entram.
- **DRE do mês**: resultado calculado para uma competência, com linhas de receita, custos e despesas e o detalhamento por categoria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No cenário do teste independente da US2, o DRE de 09/2026 bate exatamente com o cálculo manual: insumos fora, prestador como variável, aluguel como fixo.
- **SC-002**: Zero dupla contagem: despesas classificadas como Fora do DRE nunca alteram o resultado, verificado em teste automatizado.
- **SC-003**: Tela de DRE, dashboard financeiro e tool `dre` do MCP mostram o mesmo resultado líquido para o mesmo mês.
- **SC-004**: O gestor encontra, a partir do DRE, quais contas compõem os custos fixos do mês em até 2 cliques.
- **SC-005**: O DRE de um mês abre em menos de 2 segundos em lojas com até 2.000 contas a pagar no ano.

## Assumptions

- Despesas vêm de **Contas a pagar**. Saídas manuais do caixa ficam fora nesta versão (são movimentações de caixa, não lançamentos de despesa por competência).
- O DRE é por regime de competência: o valor previsto da conta conta no mês de competência, pago ou não.
- O critério de receita e CMV continua o atual (pedidos entregues, com snapshot de rentabilidade).
- A consulta por intervalo de datas deixa de existir na tela de DRE. Comparações entre meses são feitas consultando cada mês.
