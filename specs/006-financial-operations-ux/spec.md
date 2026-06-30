# Feature Specification: Operacoes Financeiras e Experiencia Administrativa

**Feature Branch**: `006-financial-operations-ux`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Melhorar graficos, comunicacao de processamento, navegacao, contas a pagar e controle de caixa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar e executar operacoes com clareza (Priority: P1)

Como administrador da loja, quero navegar entre os modulos por uma estrutura consistente e receber comunicacao clara durante qualquer processamento, para concluir tarefas sem me perder ou repetir operacoes por engano.

**Why this priority**: A navegacao e os feedbacks afetam todas as rotinas existentes e sao a base de uso dos novos modulos financeiros.

**Independent Test**: Pode ser validada navegando por todas as telas administrativas em computador e celular e executando ao menos uma operacao de consulta e uma de alteracao em cada modulo aplicavel.

**Acceptance Scenarios**:

1. **Given** que o administrador acessou qualquer tela administrativa, **When** ele navega para outro modulo, **Then** encontra uma navegacao principal consistente, identifica a secao atual e consegue retornar ao contexto anterior.
2. **Given** que uma operacao foi iniciada, **When** ela estiver em processamento, **Then** a tela informa o andamento, impede envio duplicado e preserva o contexto do usuario.
3. **Given** que uma operacao terminou, **When** houver sucesso ou erro, **Then** a tela exibe uma mensagem clara com o resultado e, quando necessario, uma acao para corrigir ou tentar novamente.
4. **Given** que o usuario acessa a aplicacao em uma tela pequena, **When** navega e executa as principais tarefas, **Then** os controles permanecem acessiveis, legiveis e sem sobreposicao.

---

### User Story 2 - Gerenciar contas a pagar (Priority: P1)

Como responsavel financeiro, quero cadastrar e acompanhar compromissos a pagar, para conhecer vencimentos, valores em aberto, atrasos e pagamentos realizados.

**Why this priority**: Sem contas a pagar, a visao financeira considera entradas, mas nao permite conhecer as obrigacoes que reduzem o caixa.

**Independent Test**: Pode ser validada cadastrando contas avulsas e recorrentes, filtrando por periodo e situacao, registrando pagamento e verificando os totais apresentados.

**Acceptance Scenarios**:

1. **Given** que existe uma nova despesa conhecida, **When** o usuario cadastra valor, vencimento, descricao e categoria, **Then** a conta aparece como aberta nos compromissos e na projecao financeira.
2. **Given** que uma conta esta aberta, **When** o usuario registra seu pagamento, **Then** a conta passa a constar como paga e gera uma saida realizada na conta financeira escolhida.
3. **Given** que uma conta aberta ultrapassou o vencimento, **When** o usuario consulta os compromissos, **Then** ela e identificada como atrasada e destacada nos totais.
4. **Given** que uma despesa se repete, **When** o usuario define sua recorrencia, **Then** os compromissos futuros sao apresentados individualmente e podem ser administrados sem alterar pagamentos ja realizados.

---

### User Story 3 - Visualizar saldo atual e projecao de caixa (Priority: P1)

Como responsavel financeiro, quero visualizar o saldo atual real e sua projecao, considerando entradas a receber e contas a pagar, para antecipar necessidades de caixa e tomar decisoes.

**Why this priority**: Esta e a finalidade central dos dados de recebimentos e pagamentos reunidos no sistema.

**Independent Test**: Pode ser validada informando saldos iniciais, registrando movimentos, contas a pagar e pedidos a receber, e comparando a posicao atual e projetada com os eventos exibidos.

**Acceptance Scenarios**:

1. **Given** que existem contas financeiras com saldos e movimentos realizados, **When** o usuario consulta a posicao de caixa, **Then** visualiza saldo atual total e por conta.
2. **Given** que existem recebimentos futuros e contas a pagar abertas, **When** o usuario seleciona um periodo futuro, **Then** visualiza saldo projetado e a composicao das entradas e saidas previstas.
3. **Given** que um recebimento futuro e liberado ou uma conta e paga, **When** a realizacao e registrada, **Then** o valor deixa de ser apenas projetado e passa a compor o saldo realizado sem dupla contagem.
4. **Given** que o usuario identifica uma diferenca de caixa, **When** registra um ajuste com justificativa, **Then** o saldo e atualizado e o ajuste permanece identificavel no historico.
5. **Given** que existem lancamentos realizados de diferentes origens, **When** o usuario consulta o extrato por periodo, **Then** visualiza debitos, creditos, saldo do periodo e saldo acumulado agrupados por data.
6. **Given** que o usuario seleciona uma conta financeira especifica, **When** consulta o extrato, **Then** visualiza somente os lancamentos e saldos daquela conta, mantendo a opcao de consultar todas as contas.

---

### User Story 4 - Interpretar evolucao diaria de vendas (Priority: P2)

Como administrador, quero enxergar os valores diretamente no grafico de evolucao diaria, para interpretar rapidamente o desempenho sem depender apenas de apontar ou abrir detalhes.

**Why this priority**: Melhora a leitura do relatorio existente, mas nao bloqueia as rotinas financeiras.

**Independent Test**: Pode ser validada consultando periodos curtos e longos e verificando se os valores relevantes permanecem legiveis e coerentes com os totais diarios.

**Acceptance Scenarios**:

1. **Given** um periodo com vendas, **When** o grafico e exibido, **Then** os pontos ou barras apresentam labels de valor formatados e coerentes com os dados diarios.
2. **Given** um periodo com muitos dias, **When** nao houver espaco para todos os labels, **Then** o grafico reduz a densidade visual sem sobrepor informacoes e preserva o acesso aos valores.
3. **Given** dias sem vendas, **When** o periodo e consultado, **Then** o grafico diferencia claramente ausencia de vendas de dados indisponiveis.

---

### User Story 5 - Usar uma experiencia administrativa consistente (Priority: P2)

Como administrador, quero que listas, filtros, formularios e acoes sigam padroes consistentes, para aprender a interface uma vez e trabalhar com mais rapidez em todos os modulos.

**Why this priority**: Consolida a revisao geral de UX/UI e reduz atrito continuo apos a melhoria inicial de navegacao.

**Independent Test**: Pode ser validada por uma auditoria das telas administrativas com tarefas equivalentes de listar, filtrar, cadastrar, editar, excluir e consultar detalhes.

**Acceptance Scenarios**:

1. **Given** telas com funcoes equivalentes, **When** o usuario interage com filtros, formularios e acoes, **Then** encontra posicionamento, rotulos, estados e comportamento consistentes.
2. **Given** uma lista sem registros ou uma consulta sem resultados, **When** a tela e exibida, **Then** o usuario entende a situacao e encontra a proxima acao aplicavel.
3. **Given** uma acao destrutiva ou irreversivel, **When** o usuario a inicia, **Then** a interface explica o impacto e solicita confirmacao antes de concluir.

### Edge Cases

- Uma operacao demora mais que o esperado ou perde conectividade durante o processamento.
- O usuario tenta sair da tela enquanto uma alteracao ainda esta em andamento.
- Uma operacao termina parcialmente e exige informar itens processados, ignorados e com erro.
- Uma conta a pagar e paga parcialmente, antecipadamente, com atraso ou em valor diferente do previsto.
- Uma conta a pagar aberta vence hoje ou esta vencida e ainda deve compor a projecao ate ser paga, cancelada ou estornada.
- Uma conta paga precisa ser estornada ou corrigida sem apagar o historico financeiro.
- Uma recorrencia e alterada depois que algumas parcelas ja foram pagas.
- Um recebimento previsto nao possui data de liberacao informada.
- A data prevista de liberacao de um pedido precisa ser corrigida apos importacao ou manutencao manual.
- Uma movimentacao e transferida entre duas contas financeiras e nao deve alterar o saldo total.
- Um extrato e filtrado por uma conta especifica e transferencias precisam aparecer como debito na origem e credito no destino quando aplicavel.
- Um dia possui varios lancamentos de credito e debito, exigindo subtotal diario e detalhamento analitico.
- O periodo projetado possui saldo negativo, eventos no mesmo dia ou nenhum movimento.
- O grafico possui valores muito altos, negativos, nulos ou quantidade de dias que inviabiliza mostrar todos os labels.

## Requirements *(mandatory)*

### Functional Requirements

#### Navegacao e comunicacao de operacoes

- **FR-001**: O sistema MUST apresentar navegacao administrativa principal persistente e agrupada por areas de negocio.
- **FR-002**: O sistema MUST indicar claramente a pagina e a secao atuais, oferecendo caminho de retorno quando houver contexto anterior.
- **FR-003**: A navegacao e as tarefas principais MUST permanecer utilizaveis em telas pequenas e grandes, sem sobreposicao ou perda de acoes essenciais.
- **FR-004**: Toda operacao que possa levar tempo perceptivel MUST comunicar os estados de inicio, processamento, conclusao e erro.
- **FR-005**: Durante uma operacao em andamento, o sistema MUST impedir envios duplicados e informar qual acao esta sendo executada.
- **FR-006**: Mensagens de conclusao MUST informar o resultado obtido; mensagens de erro MUST explicar o problema em linguagem acionavel e oferecer nova tentativa quando aplicavel.
- **FR-007**: Operacoes em lote MUST informar quantidades processadas, concluidas, ignoradas e com erro quando esses resultados puderem divergir.
- **FR-008**: O sistema MUST preservar dados informados pelo usuario quando uma operacao falhar e a recuperacao for possivel.
- **FR-009**: A revisao de UX/UI MUST cobrir todas as telas administrativas existentes e registrar a conformidade de cada uma com navegacao, responsividade, feedback, estados vazios e acoes destrutivas.
- **FR-010**: Listas, filtros, formularios, mensagens e acoes equivalentes MUST seguir comportamento e linguagem consistentes entre modulos.

#### Contas a pagar

- **FR-011**: Usuarios autorizados MUST poder cadastrar, consultar, editar, cancelar e registrar pagamento de contas a pagar.
- **FR-012**: Cada conta a pagar MUST possuir descricao, categoria, valor previsto, data de vencimento e situacao.
- **FR-013**: Uma conta a pagar MAY ser associada a fornecedor, competencia, observacoes, documento de referencia e conta financeira.
- **FR-013a**: Quando informada, a competencia da conta a pagar MUST ser capturada em formato mes/ano para refletir o periodo economico da despesa.
- **FR-014**: O sistema MUST distinguir contas abertas, parcialmente pagas, pagas, atrasadas e canceladas.
- **FR-015**: O sistema MUST permitir pagamentos parciais e manter o saldo restante da obrigacao.
- **FR-016**: Cada registro de pagamento MUST informar valor, data e conta financeira de origem.
- **FR-017**: O sistema MUST permitir definir despesas recorrentes e apresentar seus compromissos futuros individualmente.
- **FR-018**: Alteracoes em recorrencias MUST preservar pagamentos realizados e permitir escolher se afetam somente uma ocorrencia ou as ocorrencias futuras.
- **FR-019**: O sistema MUST apresentar totais de contas a pagar por periodo, situacao, categoria e fornecedor.
- **FR-020**: Contas canceladas MUST permanecer identificaveis no historico e deixar de compor obrigacoes abertas e projecoes.

#### Controle e projecao de caixa

- **FR-021**: Usuarios autorizados MUST poder manter contas financeiras usadas para representar dinheiro, instituicoes de pagamento e outros saldos operacionais.
- **FR-022**: Cada conta financeira MUST possuir identificacao, situacao ativa ou inativa e saldo inicial com data de referencia.
- **FR-023**: O sistema MUST registrar entradas, saidas, transferencias entre contas e ajustes de saldo com data, valor, origem e descricao.
- **FR-024**: Transferencias entre contas MUST alterar os saldos das contas envolvidas sem alterar o saldo total consolidado.
- **FR-025**: Ajustes manuais MUST exigir justificativa e permanecer identificaveis no historico.
- **FR-026**: O saldo atual MUST considerar somente movimentos realizados ate a data de consulta.
- **FR-027**: A projecao de caixa MUST considerar o saldo atual, recebimentos futuros de pedidos e contas a pagar abertas dentro do periodo selecionado.
- **FR-027a**: Contas a pagar abertas com vencimento hoje ou vencidas MUST continuar compondo o total a pagar e a projecao de caixa como saida imediata ate serem pagas, canceladas ou estornadas.
- **FR-028**: Recebimentos sem data prevista informada MUST usar a regra de previsao vigente definida para pedidos.
- **FR-029**: Eventos previstos que se tornarem realizados MUST deixar de compor a previsao sem serem contados duas vezes no saldo.
- **FR-030**: O sistema MUST apresentar saldo atual, total a receber, total a pagar e saldo projetado, com detalhamento dos eventos que formam cada total.
- **FR-031**: O usuario MUST poder consultar a evolucao do saldo por periodo e por conta financeira.
- **FR-032**: O sistema MUST destacar datas ou periodos em que o saldo projetado seja negativo.
- **FR-033**: Correcao ou estorno de um movimento realizado MUST preservar rastreabilidade da operacao original.
- **FR-042**: O sistema MUST disponibilizar uma visao de extrato de caixa com lancamentos realizados de credito e debito por periodo.
- **FR-043**: O extrato de caixa MUST permitir filtro opcional por conta financeira, mantendo a consulta consolidada quando nenhuma conta for selecionada.
- **FR-044**: O extrato de caixa MUST sumarizar os lancamentos por data com total de creditos, total de debitos, saldo liquido do dia e saldo acumulado.
- **FR-045**: Cada data do extrato MUST permitir consulta analitica dos lancamentos que compoem o subtotal, incluindo origem, descricao, conta financeira, valor e tipo credito/debito.
- **FR-046**: Transferencias entre contas MUST aparecer no extrato consolidado sem alterar o saldo total e no extrato por conta como debito na conta origem e credito na conta destino.
- **FR-047**: Lancamentos estornados ou revertidos MUST deixar de compor os totais do extrato, preservando rastreabilidade no historico apropriado.

#### Relatorios e graficos

- **FR-034**: O grafico de evolucao diaria de vendas MUST apresentar labels dos valores relevantes em formato monetario.
- **FR-035**: Os labels MUST permanecer legiveis, sem sobreposicao, e ter sua densidade ajustada conforme o espaco e a quantidade de dias.
- **FR-036**: O usuario MUST continuar podendo consultar o valor exato de qualquer dia mesmo quando seu label nao estiver exibido diretamente.
- **FR-037**: Os valores apresentados no grafico MUST ser consistentes com os totais e detalhes do relatorio para os mesmos filtros.

#### Seguranca e rastreabilidade

- **FR-038**: Somente usuarios autorizados MUST poder criar, alterar, pagar, cancelar, ajustar ou estornar registros financeiros.
- **FR-039**: Alteracoes financeiras MUST registrar quem realizou a acao, quando ocorreu e quais valores ou situacoes foram alterados.
- **FR-040**: Acoes destrutivas ou de impacto financeiro MUST exigir confirmacao explicita antes da conclusao.
- **FR-041**: A manutencao de pedidos MUST permitir alterar ou limpar a data prevista de liberacao do pagamento para corrigir projecoes de caixa e relatorios quando a importacao ou o extrato estiver incompleto.

### Key Entities

- **Conta a Pagar**: Compromisso financeiro previsto, com descricao, categoria, valor, vencimento, situacao, recorrencia opcional e associacao opcional a fornecedor.
- **Pagamento de Conta**: Realizacao total ou parcial de uma conta a pagar, identificando valor, data e conta financeira utilizada.
- **Categoria Financeira**: Classificacao utilizada para agrupar e analisar contas a pagar e movimentos.
- **Conta Financeira**: Representa um local de saldo operacional, como dinheiro, PagBank, Mercado Pago ou Caixa Local.
- **Movimento de Caixa**: Entrada, saida, transferencia ou ajuste realizado que altera uma ou mais contas financeiras.
- **Extrato de Caixa**: Visao derivada de lancamentos realizados, agrupada por data, com creditos, debitos, saldo liquido e detalhamento analitico por conta ou consolidado.
- **Evento Projetado**: Entrada ou saida futura originada por recebimento de pedido ou conta a pagar aberta.
- **Registro de Auditoria Financeira**: Historico de criacoes, alteracoes, pagamentos, cancelamentos, ajustes e estornos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuarios conseguem acessar qualquer modulo administrativo principal em ate tres interacoes a partir de qualquer tela administrativa.
- **SC-002**: 100% das operacoes administrativas com processamento perceptivel exibem estado de processamento e resultado final claro.
- **SC-003**: Em testes de uso, pelo menos 90% dos usuarios concluem as tarefas principais em computador e celular sem ajuda.
- **SC-004**: Nenhuma operacao submetida repetidamente enquanto estiver em andamento gera registros duplicados.
- **SC-005**: Usuarios conseguem cadastrar uma conta a pagar avulsa em menos de dois minutos e registrar seu pagamento em menos de um minuto.
- **SC-006**: Os totais de contas abertas, atrasadas, pagas e canceladas correspondem a 100% dos registros detalhados para os mesmos filtros.
- **SC-007**: O saldo atual e o saldo projetado correspondem a 100% dos eventos detalhados que os compoem, sem dupla contagem.
- **SC-008**: Usuarios conseguem identificar o saldo consolidado, valores a receber, valores a pagar e saldo projetado em ate 30 segundos.
- **SC-009**: O grafico permite identificar o valor exato de qualquer dia consultado e nao apresenta labels sobrepostos nos tamanhos de tela suportados.
- **SC-010**: 100% das alteracoes financeiras relevantes permanecem rastreaveis por usuario, data, acao e valor.
- **SC-011**: Usuarios conseguem consultar o extrato de uma conta ou consolidado por periodo e identificar os totais diarios em ate 30 segundos.
- **SC-012**: Os totais de credito, debito, saldo liquido e saldo acumulado do extrato correspondem a 100% dos lancamentos analiticos exibidos para os mesmos filtros.

## Assumptions

- A feature representa uma evolucao operacional de gestao financeira e nao substitui contabilidade fiscal ou conciliacao bancaria oficial.
- A primeira versao nao realiza integracao automatica com bancos; saldos realizados podem ser alimentados por operacoes do sistema e ajustes manuais auditaveis.
- As instituicoes ja usadas nos pedidos podem ser representadas como contas financeiras configuraveis, incluindo PagBank, Mercado Pago, Caixa Local e Dinheiro.
- Recebimentos previstos continuam seguindo as regras existentes de data de liberacao dos pedidos.
- O pagamento de uma conta a pagar gera uma saida realizada no caixa; seu cadastro gera apenas uma saida projetada.
- A confirmacao de recebimentos pode ocorrer por regra existente, importacao ou acao operacional, conforme definido no planejamento.
- O acesso usa os papeis e a autenticacao existentes, ampliados somente com as permissoes financeiras necessarias.
- A implementacao pode ser entregue em etapas independentes, desde que cada etapa preserve consistencia visual e financeira.

## Scope Boundaries

- Inclui navegacao administrativa, padroes de feedback, revisao responsiva, contas a pagar, contas financeiras, movimentos, saldo atual, projecao e labels no grafico de vendas.
- Inclui rastreabilidade operacional de alteracoes financeiras.
- Nao inclui contabilidade completa, plano de contas contabil, emissao fiscal, folha de pagamento ou integracao bancaria automatica nesta primeira versao.
- Nao inclui exclusao definitiva de registros financeiros realizados; correcoes devem ocorrer por cancelamento, ajuste ou estorno rastreavel.

## Dependencies

- Pedidos importados e suas datas previstas de liberacao para compor recebimentos futuros.
- Instituicoes de pagamento e meios de pagamento ja mantidos pela aplicacao.
- Fornecedores existentes para associacao opcional com contas a pagar.
- Autenticacao e controle de acesso administrativos existentes.
