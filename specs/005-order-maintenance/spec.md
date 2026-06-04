# Feature Specification: Manutencao Auditavel de Pedidos

**Feature Branch**: `005-order-maintenance`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "Preciso ter uma forma de fazer alteracao de pedido, desde os que estao na fila, quanto os que ja foram finalizados. Opcoes de alteracao/exclusao."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Corrigir pedido na fila (Priority: P1)

Como administrador da loja, quero alterar os dados de um pedido que ainda esta na fila para corrigir itens, quantidades, valores, cliente, entrega, pagamento e observacoes antes da finalizacao.

**Why this priority**: Erros operacionais precisam ser corrigidos rapidamente enquanto o pedido ainda esta em atendimento, evitando divergencias no preparo, cobranca e estoque.

**Independent Test**: Criar um pedido pendente, alterar itens e dados de pagamento e confirmar que a fila, o total e a reserva estimada de estoque refletem apenas a versao corrigida.

**Acceptance Scenarios**:

1. **Given** um pedido pendente ou em preparacao, **When** o administrador abre a edicao e salva dados validos, **Then** o pedido atualizado substitui os dados anteriores na fila e seu total e recalculado.
2. **Given** um pedido em andamento com itens reservados, **When** itens ou quantidades sao alterados, **Then** o impacto estimado em estoque e ajustado para corresponder ao pedido corrigido.
3. **Given** um pedido sendo editado, **When** outro usuario o altera antes da confirmacao, **Then** o sistema impede a sobrescrita silenciosa e solicita que o administrador recarregue os dados.
4. **Given** uma alteracao invalida, **When** o administrador tenta salvar, **Then** o sistema preserva o pedido atual e informa os campos que precisam de correcao.

---

### User Story 2 - Corrigir pedido finalizado (Priority: P2)

Como administrador da loja, quero corrigir um pedido entregue ou cancelado para que historico, vendas, DRE, rentabilidade, valores liberados e valores a receber representem a informacao correta.

**Why this priority**: Pedidos importados ou finalizados podem conter classificacoes e valores incorretos que distorcem a leitura financeira do negocio.

**Independent Test**: Corrigir valor, data, pagamento e itens de um pedido entregue e confirmar que o historico e todos os indicadores derivados passam a considerar somente a versao corrigida.

**Acceptance Scenarios**:

1. **Given** um pedido entregue, **When** o administrador altera campos financeiros, data da venda ou pagamento, **Then** vendas, DRE, rentabilidade e liberacao financeira sao recalculadas sem duplicar resultados.
2. **Given** um pedido entregue, **When** itens ou quantidades sao alterados, **Then** os impactos anteriores de estoque e rentabilidade sao compensados e refeitos conforme a versao corrigida.
3. **Given** um pedido cancelado, **When** seus dados descritivos ou financeiros sao corrigidos sem reativa-lo, **Then** ele permanece cancelado e continua fora dos resultados realizados.
4. **Given** qualquer pedido finalizado, **When** uma correcao e confirmada, **Then** o sistema registra quem alterou, quando alterou, o motivo e os valores anteriores e posteriores.

---

### User Story 3 - Excluir pedido com seguranca (Priority: P2)

Como administrador da loja, quero excluir um pedido incorreto ou duplicado sem perder a rastreabilidade e sem deixar impactos indevidos em estoque ou relatorios.

**Why this priority**: Importacoes e operacoes manuais podem gerar duplicidades; a remocao precisa corrigir os indicadores sem apagar evidencias importantes.

**Independent Test**: Excluir um pedido em andamento e um pedido entregue, informar o motivo e confirmar que ambos deixam as visoes operacionais e financeiras, mantendo um registro auditavel da exclusao.

**Acceptance Scenarios**:

1. **Given** um pedido em andamento, **When** o administrador confirma a exclusao e informa o motivo, **Then** o pedido sai da fila e qualquer reserva de estoque e liberada.
2. **Given** um pedido entregue, **When** o administrador confirma a exclusao e informa o motivo, **Then** os impactos realizados de estoque, rentabilidade e financeiro sao compensados e o pedido deixa de integrar os totais e consultas padrao.
3. **Given** um pedido excluido, **When** o administrador consulta o historico de manutencoes, **Then** encontra o pedido, o motivo, o responsavel, a data e um resumo dos impactos revertidos.
4. **Given** uma solicitacao de exclusao, **When** o administrador nao informa um motivo, **Then** o sistema nao conclui a operacao.

---

### User Story 4 - Consultar historico de alteracoes (Priority: P3)

Como administrador da loja, quero consultar o historico de alteracoes de um pedido para entender correcoes, exclusoes e seus responsaveis.

**Why this priority**: A trilha de auditoria reduz duvidas sobre divergencias e permite conferir manutencoes em dados financeiros.

**Independent Test**: Realizar duas alteracoes e uma exclusao logica e confirmar que a linha do tempo apresenta as tres operacoes em ordem, com responsavel, motivo e resumo das mudancas.

**Acceptance Scenarios**:

1. **Given** um pedido com manutencoes, **When** o administrador abre seu historico, **Then** visualiza as operacoes em ordem cronologica, com responsavel, data, motivo e campos alterados.
2. **Given** um pedido sem manutencoes, **When** seu historico e consultado, **Then** o sistema informa que nao existem alteracoes registradas.

### Edge Cases

- Edicao de pedido cujo produto foi desativado ou teve preco alterado depois da venda.
- Edicao de pedido importado sem cliente, endereco ou produto originalmente identificavel.
- Alteracao da data da venda entre periodos financeiros diferentes.
- Alteracao de instituicao, meio de pagamento, valor liquido ou data prevista de liberacao.
- Correcao de um pedido entregue quando nao ha saldo suficiente para refazer o consumo de estoque.
- Exclusao repetida ou tentativa de editar um pedido ja excluido.
- Pedido alterado simultaneamente por dois administradores.
- Falha durante a compensacao de estoque ou recalculo financeiro.
- Alteracao que faria o valor liquido superar o valor bruto ou deixaria totais negativos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que administradores autorizados iniciem a edicao de pedidos em andamento e finalizados pertencentes a sua loja.
- **FR-002**: O sistema MUST permitir alterar cliente, contato, forma de atendimento, endereco, observacoes, data da venda, itens, quantidades, precos, instituicao de pagamento, meio de pagamento, identificador externo, valor bruto, taxa, valor liquido, bandeira e data prevista de liberacao.
- **FR-003**: O sistema MUST recalcular o total do pedido a partir dos itens quando itens, quantidades ou precos forem alterados.
- **FR-004**: O sistema MUST validar que quantidades sejam positivas e que valores financeiros sejam coerentes antes de aceitar uma alteracao.
- **FR-005**: O sistema MUST exigir um motivo informado pelo administrador para alterar campos financeiros, alterar um pedido finalizado ou excluir um pedido.
- **FR-006**: O sistema MUST ajustar as reservas de estoque quando itens ou quantidades de um pedido em andamento forem alterados.
- **FR-007**: O sistema MUST compensar os impactos anteriores e aplicar os novos impactos quando itens ou quantidades de um pedido entregue forem alterados.
- **FR-008**: O sistema MUST recalcular os resultados derivados de um pedido finalizado corrigido, incluindo vendas, DRE, rentabilidade, valores liberados e valores a receber.
- **FR-009**: O sistema MUST concluir alteracoes e suas compensacoes relacionadas como uma unica operacao; em caso de falha, nenhum efeito parcial pode permanecer.
- **FR-010**: O sistema MUST impedir sobrescrita silenciosa quando o pedido tiver sido alterado depois de ser aberto para edicao.
- **FR-011**: O sistema MUST oferecer uma acao de exclusao para pedidos em andamento e finalizados.
- **FR-012**: A exclusao de um pedido MUST ser logica e auditavel, preservando seus dados e seu historico para consulta administrativa.
- **FR-013**: Pedidos excluidos MUST deixar de aparecer na fila, historico operacional padrao, vendas, DRE, rentabilidade e demais totalizadores.
- **FR-014**: Ao excluir um pedido, o sistema MUST liberar reservas ou compensar consumos, resultados e efeitos financeiros relacionados ao pedido.
- **FR-015**: O sistema MUST impedir novas alteracoes operacionais em pedidos excluidos.
- **FR-016**: O sistema MUST registrar uma trilha de auditoria para cada alteracao e exclusao, contendo pedido, loja, responsavel, data e hora, motivo, tipo de operacao e dados anteriores e posteriores relevantes.
- **FR-017**: O sistema MUST permitir consultar a trilha de auditoria a partir do pedido.
- **FR-018**: O sistema MUST destacar visualmente que a edicao de um pedido finalizado pode alterar resultados financeiros e de estoque antes da confirmacao.
- **FR-019**: O sistema MUST apresentar confirmacao explicita antes da exclusao, informando os principais impactos que serao revertidos.
- **FR-020**: O sistema MUST manter o isolamento entre lojas, impedindo que um administrador altere, exclua ou consulte auditoria de pedidos de outra loja.
- **FR-021**: O sistema MUST preservar no pedido os nomes e precos historicos dos itens, mesmo que o cadastro atual do produto tenha sido alterado.
- **FR-022**: O sistema MUST permitir localizar pedidos finalizados e excluidos por periodo, status, identificador e dados de pagamento para manutencao e auditoria.
- **FR-023**: O sistema MUST tratar um pedido excluido como removido dos resultados sem reutilizar automaticamente seu identificador externo em uma nova importacao.
- **FR-024**: O sistema MUST informar claramente quando uma alteracao ou exclusao foi concluida ou falhou.

### Key Entities

- **Pedido**: Venda operacional que possui estado, data, cliente, atendimento, pagamento, itens, totais e possiveis impactos financeiros e de estoque.
- **Item do Pedido**: Produto, nome historico, quantidade, preco unitario e total que compoem o pedido.
- **Manutencao do Pedido**: Registro auditavel de uma edicao ou exclusao, contendo motivo, responsavel, momento, versao anterior, versao posterior e resumo dos impactos.
- **Exclusao Logica do Pedido**: Estado que remove o pedido das operacoes e resultados padrao sem apagar seu registro historico.
- **Impacto Compensatorio**: Ajuste que neutraliza um efeito anterior do pedido em estoque, rentabilidade ou financeiro antes de aplicar uma versao corrigida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador consegue corrigir um pedido em andamento em ate 2 minutos, sem precisar exclui-lo e recria-lo.
- **SC-002**: Em 100% das alteracoes bem-sucedidas de pedidos entregues, os totais de vendas, DRE, rentabilidade e valores a receber correspondem a versao mais recente do pedido, sem duplicidade.
- **SC-003**: Em 100% das exclusoes bem-sucedidas, o pedido deixa de afetar as consultas padrao e todos os seus impactos de estoque e financeiro sao compensados.
- **SC-004**: Em 100% das alteracoes e exclusoes, a trilha de auditoria identifica responsavel, momento, motivo e mudancas realizadas.
- **SC-005**: Nenhuma falha durante uma manutencao deixa alteracoes parciais visiveis no pedido, estoque ou resultados.
- **SC-006**: Pelo menos 95% dos administradores conseguem localizar, corrigir e conferir o historico de um pedido na primeira tentativa.

## Assumptions

- A primeira versao sera utilizada por administradores autenticados da loja; perfis de permissao mais granulares podem ser adicionados posteriormente.
- "Excluir" significa exclusao logica e auditavel. Exclusao fisica permanece restrita a rotinas tecnicas de limpeza de ambiente.
- Pedidos finalizados incluem entregues e cancelados; a edicao nao altera automaticamente seu status.
- A correcao de pedidos entregues deve neutralizar impactos anteriores antes de registrar os novos impactos.
- Produtos desativados podem permanecer em itens historicos; adicionar um novo item exige selecionar um produto existente da loja.
- Pedidos excluidos permanecem pesquisaveis apenas nas visoes administrativas de manutencao e auditoria.
- A reativacao de pedidos excluidos nao faz parte desta primeira versao.
