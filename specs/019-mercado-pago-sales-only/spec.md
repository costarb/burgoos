# Feature Specification: Importação exclusiva de vendas do Mercado Pago

**Feature Branch**: `019-mercado-pago-sales-only`

**Created**: 2026-08-14

**Status**: Draft

**Input**: Importar somente vendas do Mercado Pago, independentemente do canal em que foram realizadas, e desconsiderar transferências, aplicações, resgates e demais movimentações da conta.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Importar somente recebimentos de vendas (Priority: P1)

Como gestor, quero que a sincronização do Mercado Pago gere pedidos somente para pagamentos originados por vendas, para que a listagem e os indicadores comerciais não sejam contaminados por movimentações financeiras da conta.

**Why this priority**: É o objetivo central da feature e evita pedidos, faturamento e análises incorretos.

**Independent Test**: Sincronizar um período que contenha uma venda aprovada e movimentações financeiras sem origem comercial; apenas a venda deve gerar ou atualizar um pedido.

**Acceptance Scenarios**:

1. **Given** uma venda aprovada recebida pelo Mercado Pago, **When** a integração sincroniza o movimento, **Then** o sistema o reconhece como venda elegível e gera ou atualiza o pedido correspondente.
2. **Given** um PIX recebido como pagamento de uma venda, **When** a integração sincroniza o movimento, **Then** o sistema importa a venda mesmo que ela não tenha sido iniciada no ERP.
3. **Given** uma transferência, aplicação, resgate, aporte ou outro movimento de conta sem origem em venda, **When** a integração sincroniza o período, **Then** o movimento é ignorado e nenhum pedido é gerado.
4. **Given** um movimento cuja origem comercial não possa ser comprovada, **When** a integração o processa, **Then** o movimento é ignorado por segurança.

---

### User Story 2 - Abranger todos os canais de venda (Priority: P1)

Como gestor que vende por diferentes canais, quero importar pagamentos de vendas online, presenciais e recorrentes, para que a origem do canal não impeça a conciliação comercial.

**Why this priority**: Filtrar somente um canal também produziria uma visão incompleta das vendas.

**Independent Test**: Sincronizar vendas aprovadas de canais distintos e verificar que todas são importadas uma única vez.

**Acceptance Scenarios**:

1. **Given** vendas aprovadas realizadas online, presencialmente ou de forma recorrente, **When** a sincronização é concluída, **Then** todas as vendas reconhecidas são importadas.
2. **Given** uma venda paga com cartão, PIX ou saldo da carteira, **When** a origem do movimento é uma venda, **Then** o meio de pagamento não impede a importação.
3. **Given** a mesma venda recebida por sincronização periódica e por notificação, **When** ambos os fluxos a processam, **Then** apenas um pedido lógico é mantido.

---

### User Story 3 - Tornar a decisão auditável (Priority: P2)

Como responsável pela operação, quero distinguir movimentos importados de movimentos ignorados, para investigar divergências sem transformar movimentos financeiros em pedidos.

**Why this priority**: A rastreabilidade reduz o risco de falsos positivos e facilita suporte e conciliação.

**Independent Test**: Processar um conjunto misto e confirmar que o resultado informa quantas vendas foram aceitas e quantos movimentos foram ignorados, sem expor dados financeiros sensíveis além dos já autorizados.

**Acceptance Scenarios**:

1. **Given** um movimento não comercial, **When** ele é ignorado, **Then** o processamento registra uma classificação técnica rastreável e não apresenta o movimento como falha operacional.
2. **Given** uma sincronização com vendas e movimentos ignorados, **When** o gestor consulta o resultado da importação, **Then** os totais refletem separadamente itens importados e desconsiderados.

### Edge Cases

- Movimento sem informação suficiente para comprovar que se originou de uma venda.
- PIX recebido de outra conta pertencente ao mesmo titular e acompanhado de transferência para cofrinho.
- Venda aprovada paga com saldo disponível na própria conta do Mercado Pago.
- Venda posteriormente cancelada, estornada ou submetida a chargeback.
- Movimento com valor zero ou negativo.
- Tipo de movimento novo ou desconhecido introduzido pelo provedor.
- Paginação que contenha somente movimentos ignorados antes de uma página com vendas válidas.
- Reprocessamento da mesma venda por sincronização, reconciliação e notificação.
- Instabilidade do provedor durante uma página de sincronização.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST importar como pedido somente movimentos que o provedor identifique como pagamentos originados por venda.
- **FR-002**: O sistema MUST aceitar vendas independentemente do canal comercial, incluindo vendas online, presenciais e recorrentes reconhecidas pelo provedor.
- **FR-003**: O sistema MUST aceitar meios de pagamento comerciais já suportados, incluindo cartão, PIX e saldo de carteira, quando o movimento tiver origem em venda.
- **FR-004**: O sistema MUST ignorar transferências de dinheiro, aplicações, resgates, aportes, retiradas, ajustes de saldo e qualquer outro movimento sem origem em venda.
- **FR-005**: O sistema MUST adotar classificação restritiva: movimentos com origem ausente, desconhecida ou não comprovadamente comercial não podem gerar pedidos.
- **FR-006**: O sistema MUST exigir que a venda esteja em estado elegível para importação e tenha valor positivo antes de gerar um pedido.
- **FR-007**: O mesmo critério de classificação MUST ser aplicado à sincronização manual, sincronização periódica, reconciliação e notificações do Mercado Pago.
- **FR-008**: O sistema MUST manter a idempotência quando a mesma venda for recebida por mais de um fluxo ou for reprocessada.
- **FR-009**: Movimentos ignorados MUST ser contabilizados como desconsiderados, e não como erro de integração que exija nova tentativa.
- **FR-010**: O sistema MUST preservar uma razão auditável para a decisão de ignorar um movimento, sem criar pedido ou impacto comercial.
- **FR-011**: Filtros enviados ao provedor MAY reduzir antecipadamente o volume de movimentos inelegíveis, mas o sistema MUST validar novamente cada movimento recebido antes de gerar pedidos.
- **FR-012**: Uma página sem vendas elegíveis MUST permitir que a sincronização continue até concluir todas as páginas do período solicitado.
- **FR-013**: Registros históricos incorretos não MUST ser excluídos automaticamente; a feature MUST impedir novas importações indevidas e permitir identificar candidatos históricos para revisão separada.
- **FR-014**: O sistema MUST desconsiderar pagamentos que o provedor identifique como transferência entre contas do mesmo titular, mesmo quando o tipo operacional genérico seja de pagamento regular.
- **FR-015**: A data comercial da venda MUST corresponder ao calendário de `America/Sao_Paulo`, inclusive para instantes UTC que ocorram no dia seguinte.

### Key Entities

- **Movimento do Mercado Pago**: Evento financeiro retornado pelo provedor, com identificação, origem operacional, estado, valor, data e meio de pagamento.
- **Venda elegível**: Movimento comprovadamente originado de venda, aprovado, com valor positivo e meio de pagamento suportado.
- **Movimento desconsiderado**: Movimento financeiro que não atende aos critérios de venda e permanece sem pedido associado.
- **Pedido importado**: Representação comercial idempotente criada ou atualizada a partir de uma venda elegível.
- **Resultado de sincronização**: Totais e estado do processamento, distinguindo vendas importadas, duplicidades e movimentos desconsiderados.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em um conjunto de validação contendo vendas e movimentos financeiros diversos, 100% dos movimentos sem origem comercial são desconsiderados e não geram pedidos.
- **SC-002**: 100% das vendas aprovadas dos canais online, presencial e recorrente presentes no conjunto de validação são importadas, independentemente do meio de pagamento suportado.
- **SC-003**: Reprocessar a mesma venda por dois ou mais fluxos mantém exatamente um pedido lógico.
- **SC-004**: Uma sincronização composta somente por movimentos não comerciais termina com sucesso, com zero pedidos criados e os itens contabilizados como desconsiderados.
- **SC-005**: O resultado de cada sincronização permite explicar a classificação de 100% dos movimentos processados como venda, duplicidade ou item desconsiderado.
- **SC-006**: O volume de pedidos indevidos originados por novas transferências, aplicações e resgates cai a zero após a ativação da feature.

## Assumptions

- O Mercado Pago fornece uma classificação operacional confiável que permite distinguir pagamentos de vendas de movimentos internos da conta.
- Vendas aprovadas online, presenciais e recorrentes fazem parte do escopo; a origem no ERP, em link de pagamento, checkout, maquininha ou recorrência não altera sua elegibilidade.
- Um pagamento feito com saldo da carteira pode representar uma venda válida; portanto, o meio de pagamento isoladamente não determina a exclusão.
- Cancelamentos, estornos e chargebacks posteriores continuam sendo tratados pelos fluxos de reconciliação existentes e não são considerados novas vendas.
- A correção automática de pedidos históricos potencialmente indevidos fica fora do escopo por poder afetar estoque, caixa e relatórios já fechados; a feature fornece identificação para uma revisão controlada posterior.
- Os controles atuais de autenticação, isolamento por loja e idempotência permanecem válidos.
