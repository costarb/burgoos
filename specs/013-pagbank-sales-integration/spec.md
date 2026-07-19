# Feature Specification: Integracao de Vendas PagBank

**Feature Branch**: `013-pagbank-sales-integration`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Integrar com o PagBank para consultar transacoes de venda em um periodo e importa-las para o sistema, evoluindo a importacao CSV para uma arquitetura extensivel por provider e meio de comunicacao. O primeiro provider sera o PagBank, com possibilidade futura de Mercado Pago e outros."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar a integracao PagBank (Priority: P1)

Como administrador da loja, quero configurar as credenciais EDI e o identificador do meu estabelecimento PagBank para que o sistema possa consultar as vendas pertencentes a minha loja sem expor dados sensiveis.

**Why this priority**: A conexao corretamente vinculada a loja e pre-requisito para qualquer consulta ou importacao segura.

**Independent Test**: Informar um identificador de estabelecimento e uma credencial valida, salvar a integracao e confirmar que ela fica disponivel apenas para a loja configurada, com a credencial ocultada nas consultas posteriores.

**Acceptance Scenarios**:

1. **Given** um administrador autorizado e uma loja sem integracao PagBank, **When** ele informa identificador do estabelecimento e credencial obrigatorios, **Then** o sistema registra uma integracao PagBank vinculada somente a essa loja.
2. **Given** uma integracao PagBank existente, **When** seus dados sao exibidos, **Then** a credencial secreta nunca e apresentada em texto aberto.
3. **Given** dados obrigatorios ausentes ou uma conexao recusada pelo provider, **When** o administrador tenta usar a integracao, **Then** o sistema impede a consulta e informa o que deve ser corrigido sem revelar a credencial.

---

### User Story 2 - Consultar vendas por periodo (Priority: P1)

Como administrador da loja, quero selecionar um periodo e consultar as movimentacoes de venda disponiveis no PagBank antes de importa-las, para conferir a origem, a abrangencia e o resultado esperado.

**Why this priority**: A consulta por periodo elimina a coleta manual de CSV e permite que o usuario valide o conjunto de dados antes de alterar o historico de pedidos.

**Independent Test**: Configurar uma integracao, selecionar um periodo com exemplos oficiais de venda e confirmar que o sistema apresenta um resumo das datas consultadas, vendas encontradas, ocorrencias ja importadas, ocorrencias novas e impedimentos.

**Acceptance Scenarios**:

1. **Given** uma integracao ativa, **When** o administrador consulta um periodo encerrado, **Then** o sistema consulta todas as datas elegiveis do periodo e consolida o resultado em uma unica pre-visualizacao.
2. **Given** um periodo que inclui o dia atual ou uma data ainda nao integralmente processada, **When** a consulta e realizada, **Then** o sistema identifica a data como indisponivel ou incompleta e nao a libera para importacao.
3. **Given** mais resultados do que o limite retornado em uma consulta, **When** o provider informa paginas adicionais, **Then** o sistema percorre todas as paginas antes de apresentar o resumo da data.
4. **Given** vendas novas e vendas ja importadas no mesmo periodo, **When** a pre-visualizacao e exibida, **Then** o administrador consegue distinguir as novas, as duplicadas e as rejeitadas, com seus respectivos motivos.

---

### User Story 3 - Importar vendas consultadas (Priority: P1)

Como administrador da loja, quero confirmar a importacao das vendas validas encontradas no PagBank para criar os pedidos historicos e seus dados de pagamento sem duplicidade.

**Why this priority**: A entrega de valor ocorre quando as vendas externas passam a integrar pedidos, relatorios e resultados financeiros do sistema de forma confiavel.

**Independent Test**: Consultar um periodo com venda valida, confirmar a importacao e verificar a criacao do pedido historico; repetir a mesma operacao e confirmar que nenhum pedido ou efeito financeiro e duplicado.

**Acceptance Scenarios**:

1. **Given** uma pre-visualizacao com vendas novas de datas integrais, **When** o administrador confirma a importacao, **Then** o sistema cria os pedidos historicos com data, valor, instituicao, meio de pagamento e identificadores externos disponiveis.
2. **Given** uma venda PagBank previamente importada por API ou arquivo, **When** ela volta a aparecer em uma consulta, **Then** o sistema a ignora como duplicada e preserva o pedido existente.
3. **Given** que uma parte das vendas e invalida, **When** a importacao e confirmada, **Then** as vendas validas sao importadas e cada item ignorado apresenta um motivo acionavel no resultado.
4. **Given** uma falha durante a persistencia de uma venda, **When** o processamento termina, **Then** nenhum pedido parcialmente criado fica visivel e a venda pode ser tentada novamente com seguranca.
5. **Given** uma venda importada, **When** relatorios e consultas de pedidos abrangem sua data, **Then** ela aparece como originada do PagBank e produz os mesmos resultados de negocio esperados para uma venda historica equivalente importada por CSV.

---

### User Story 4 - Acompanhar execucoes e falhas (Priority: P2)

Como administrador da loja, quero consultar o historico das consultas e importacoes para saber qual periodo foi processado, quem iniciou a operacao e quais registros foram importados, ignorados ou falharam.

**Why this priority**: Integracoes externas podem ficar indisponiveis ou retornar dados incompletos; rastreabilidade reduz retrabalho e permite retomada segura.

**Independent Test**: Executar uma consulta com resultado parcial ou erro simulado e confirmar que o historico registra periodo, provider, loja, responsavel, estado, contagens e mensagem segura de falha.

**Acceptance Scenarios**:

1. **Given** uma consulta ou importacao concluida, **When** o administrador abre o historico, **Then** visualiza periodo, provider, responsavel, inicio, termino, estado e contagens do processamento.
2. **Given** indisponibilidade, limite de requisicoes ou falha de autenticacao do PagBank, **When** uma consulta falha, **Then** o sistema registra a falha, nao importa dados incompletos e orienta se a operacao pode ser repetida ou se a configuracao deve ser corrigida.
3. **Given** duas lojas distintas, **When** seus administradores consultam integracoes e execucoes, **Then** nenhum deles acessa credenciais, resultados ou historico da outra loja.

---

### User Story 5 - Adicionar novos providers sem alterar o fluxo comum (Priority: P3)

Como responsavel pelo produto, quero que consultas externas sejam organizadas por provider e por canal de entrada para que novos providers, como Mercado Pago, possam ser adicionados mantendo a mesma experiencia de pre-visualizacao, importacao, deduplicacao e auditoria.

**Why this priority**: O PagBank e o primeiro provider, mas a extensibilidade evita que cada nova instituicao crie um fluxo isolado e inconsistente.

**Independent Test**: Validar o contrato funcional com um provider simulado que entregue vendas por outro canal e confirmar que configuracao especifica, consulta, normalizacao e resultado usam o fluxo comum sem alterar as regras do PagBank.

**Acceptance Scenarios**:

1. **Given** um novo provider com credenciais, capacidades e canal proprios, **When** ele e disponibilizado, **Then** o fluxo comum consegue identifica-lo, coletar seus dados e transforma-los no formato de venda historica esperado pelo sistema.
2. **Given** providers com capacidades diferentes, **When** o usuario seleciona um provider, **Then** somente configuracoes e acoes suportadas por ele sao solicitadas ou apresentadas.
3. **Given** a mesma venda recebida por canais diferentes do mesmo provider, **When** ela e importada novamente, **Then** a identidade externa comum impede duplicidade.

### Edge Cases

- Periodo com data inicial posterior a final, data futura ou dia atual ainda nao consolidado.
- Periodo parcialmente disponivel, com algumas datas integrais e outras marcadas como incompletas.
- Dia sem movimentacoes, sem que isso seja tratado como falha.
- Periodo amplo que exige diversas consultas diarias e varias paginas por dia.
- Credencial expirada, revogada, incorreta ou sem acesso ao estabelecimento informado.
- Resposta lenta, indisponibilidade temporaria, limite de requisicoes ou interrupcao no meio da paginacao.
- Resposta sem o indicador confiavel de integralidade ou marcada explicitamente como nao validada.
- Registros repetidos na mesma resposta, entre paginas, entre dias ou ja recebidos via CSV.
- Venda sem campos suficientes para formar um pedido historico ou com valores inconsistentes.
- Eventos de cancelamento, chargeback ou ajuste relacionados a uma venda; devem ser identificados no resultado, mas nao alterar automaticamente pedidos nesta primeira versao.
- Formas de pagamento e operacoes que o extrato EDI nao contempla, como vouchers, tentativas nao autorizadas e recargas em maquininhas.
- Alteracao de versao ou formato de dados do provider que torne um registro incompativel com o mapeamento conhecido.
- Inicio simultaneo de importacoes sobrepostas para a mesma loja, provider e datas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que administradores autorizados configurem uma integracao de vendas por provider para sua propria loja.
- **FR-002**: Cada integracao MUST identificar, no minimo, a loja, o provider, o estado de ativacao e os dados de conexao exigidos por esse provider.
- **FR-003**: Para o PagBank, o sistema MUST aceitar o identificador USER do estabelecimento e o TOKEN especifico da API EDI.
- **FR-004**: O sistema MUST armazenar, transmitir, exibir e registrar credenciais de modo que o valor secreto nao seja revelado em telas, respostas, historicos ou mensagens de erro.
- **FR-005**: O sistema MUST impedir que usuarios de uma loja consultem ou operem integracoes, execucoes e dados de outra loja.
- **FR-006**: O sistema MUST permitir consultar vendas externas informando provider, data inicial e data final inclusivas.
- **FR-007**: Para o PagBank, o sistema MUST decompor o periodo solicitado em consultas por data, pois o provider disponibiliza movimentos de uma unica data por vez.
- **FR-008**: A primeira versao PagBank MUST consultar apenas movimentos transacionais; movimentos financeiros, cashouts e saldos ficam fora do escopo.
- **FR-009**: O sistema MUST percorrer todas as paginas informadas pelo provider, respeitando os limites de quantidade por pagina, antes de considerar uma data completamente consultada.
- **FR-010**: O sistema MUST considerar uma data PagBank elegivel para importacao somente quando o provider confirmar que seus dados estao integralmente processados.
- **FR-011**: O sistema MUST impedir a importacao do dia atual, de datas futuras e de qualquer data ausente, incompleta ou nao validada, indicando o motivo por data.
- **FR-012**: O sistema MUST apresentar uma pre-visualizacao consolidada antes da confirmacao, contendo periodo, datas processadas, vendas novas, duplicadas, rejeitadas e datas impedidas.
- **FR-013**: O sistema MUST normalizar cada venda externa para um formato comum de importacao, independente do provider e do canal que forneceu os dados.
- **FR-014**: O formato comum MUST preservar provider, canal de origem, identificador externo da venda/transacao, data e hora, valor bruto, valor liquido quando disponivel, taxas quando disponiveis, meio de pagamento, parcelas e identificador do estabelecimento quando fornecidos.
- **FR-015**: A importacao MUST reutilizar as regras existentes de composicao de pedido historico, inclusive as estrategias de distribuicao por produtos, quando os dados externos nao contiverem itens de produto.
- **FR-016**: O sistema MUST criar pedidos historicos importados com a instituicao de pagamento correspondente ao provider e com rastreabilidade para a venda externa de origem.
- **FR-017**: O sistema MUST aplicar identidade unica por loja, provider e identificador externo estavel para impedir duplicidade entre reprocessamentos e entre canais, inclusive quando a venda ja tiver sido importada por CSV.
- **FR-018**: Quando o provider oferecer mais de um identificador, o sistema MUST priorizar aquele definido como estavel para a transacao e preservar os demais para rastreabilidade e conciliacao futura.
- **FR-019**: Uma falha ao importar uma venda MUST desfazer qualquer alteracao parcial daquela venda e MUST permitir nova tentativa sem duplicar vendas ja concluidas.
- **FR-020**: Registros invalidos MUST ser ignorados individualmente com um motivo; eles nao MUST impedir a importacao de outros registros validos do mesmo processamento.
- **FR-021**: A primeira versao MUST reconhecer e classificar eventos transacionais que nao representem uma nova venda, incluindo cancelamentos, chargebacks e ajustes, sem criar pedidos duplicados nem alterar automaticamente pedidos existentes.
- **FR-022**: O sistema MUST alertar que o EDI PagBank nao contempla todas as operacoes, incluindo tentativas nao autorizadas, vendas com voucher e recargas em maquininhas, para evitar expectativa de cobertura integral.
- **FR-023**: O sistema MUST registrar cada execucao de consulta e importacao com loja, provider, canal, periodo, responsavel, horarios, estado, datas processadas e contagens de encontrados, novos, importados, duplicados, rejeitados e falhos.
- **FR-024**: Mensagens de erro MUST distinguir, sem expor segredos, entre configuracao invalida, autenticacao recusada, dados ainda incompletos, indisponibilidade temporaria, limite do provider e resposta incompativel.
- **FR-025**: O sistema MUST impedir ou coordenar importacoes concorrentes com sobreposicao de loja, provider e datas para evitar processamento duplicado.
- **FR-026**: O sistema MUST suportar capacidades declaradas por provider, incluindo dados de configuracao requeridos, canal de coleta, tipos de movimento e restricoes de periodo.
- **FR-027**: A inclusao futura de outro provider MUST poder reutilizar o fluxo comum de selecao de periodo, pre-visualizacao, normalizacao, deduplicacao, importacao e auditoria, mantendo isoladas suas regras especificas de conexao e mapeamento.
- **FR-028**: A validacao da primeira versao MUST poder ser realizada com os cenarios JSON oficiais do PagBank sem exigir credencial real, pois o provider nao oferece ambiente sandbox.
- **FR-029**: O uso de uma credencial real MUST ser reservado a validacao controlada com dados reais da loja depois que o token EDI estiver disponivel.

### Key Entities

- **Integracao de Vendas**: Vinculo de uma loja com um provider, contendo estado, identificadores publicos, referencias protegidas de credenciais e capacidades disponiveis.
- **Provider de Vendas**: Instituicao ou origem externa que define como autenticar, consultar e interpretar vendas, como PagBank e, futuramente, Mercado Pago.
- **Canal de Entrada**: Meio pelo qual dados externos chegam ao sistema, como API, arquivo ou outro mecanismo suportado pelo provider.
- **Execucao de Consulta/Importacao**: Registro auditavel de uma operacao, com periodo, datas, estado, responsavel, contagens e falhas seguras.
- **Movimento Externo**: Registro original recebido do provider, identificado por tipo de evento, transacao e estabelecimento, antes da decisao de importar.
- **Venda Normalizada**: Representacao comum de uma venda externa apta a usar as regras de importacao de pedidos, independente de provider ou canal.
- **Pedido Historico**: Pedido criado a partir de uma venda normalizada e usado pelos fluxos existentes de vendas, relatorios e resultados.
- **Identidade Externa**: Chave estavel que relaciona loja, provider, venda externa e pedido, garantindo rastreabilidade e idempotencia entre canais.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador consegue configurar o PagBank, selecionar um periodo, conferir a pre-visualizacao e iniciar a importacao em ate 5 minutos, desconsiderando o tempo de resposta externo.
- **SC-002**: 100% das datas importadas possuem confirmacao de integralidade e nenhuma data atual, futura ou incompleta gera pedidos.
- **SC-003**: 100% das paginas informadas pelo provider sao consideradas antes de uma data ser apresentada como completamente consultada.
- **SC-004**: Repetir qualquer importacao concluida, inclusive por canal diferente, cria zero pedidos e zero efeitos financeiros duplicados.
- **SC-005**: 100% dos pedidos importados preservam provider, identificador externo, data, valor e meio de pagamento quando esses dados existem na origem.
- **SC-006**: Uma falha isolada nao deixa pedido parcial e nao impede que os demais registros validos do processamento sejam importados.
- **SC-007**: 100% das execucoes podem ser auditadas por loja, provider, periodo, responsavel, estado e contagens, sem exposicao de credenciais.
- **SC-008**: Os cenarios oficiais de venda PagBank aplicaveis a esta entrega, incluindo credito, parcelado, PIX, debito, split e boleto, sao interpretados sem erro estrutural a partir dos exemplos JSON publicados.
- **SC-009**: Pelo menos 95% dos administradores de teste concluem consulta e importacao na primeira tentativa sem precisar preparar ou enviar um arquivo CSV.
- **SC-010**: Um provider simulado adicional consegue percorrer pre-visualizacao, normalizacao, deduplicacao e resultado comum sem alterar o comportamento especifico do PagBank.

## Assumptions

- O administrador ja autenticado e autorizado a importar pedidos historicos tambem sera o perfil autorizado a configurar e executar integracoes de vendas da propria loja.
- O token solicitado pelo usuario e o token especifico da API EDI, diferente do token comum da conta PagBank.
- A primeira entrega e manual e sob demanda: o administrador escolhe o periodo, consulta, revisa e confirma; agendamento automatico fica fora do escopo.
- O periodo informado pelo usuario sera inclusivo, mas cada provider podera impor limites proprios; a interface devera informar e validar esses limites quando conhecidos.
- Para PagBank, D-1 e a expectativa normal de disponibilidade, mas a confirmacao de integralidade retornada pelo provider e a autoridade final para liberar uma data.
- A entrega cobre a criacao de pedidos a partir de eventos de venda. Aplicar cancelamentos, chargebacks, ajustes, liquidacoes, antecipacoes, cashouts ou saldos aos pedidos e ao financeiro fica para evolucao posterior.
- Como o EDI nao fornece itens de catalogo da venda, permanecem validas as estrategias atuais de composicao de pedidos historicos usadas na importacao CSV.
- A deduplicacao entre CSV e API depende de o CSV existente conter o mesmo identificador externo estavel recebido da API; quando isso nao ocorrer, o item sera sinalizado para revisao em vez de ser unido por heuristica arriscada.
- Os exemplos JSON oficiais serao a principal base de validacao antes do recebimento do token; nao sera feita chamada de teste aos endpoints reais sem credencial e autorizacao operacional.
- A documentacao oficial do PagBank e a referencia para versao, tipos de evento, campos e limitacoes do EDI durante o planejamento e implementacao.
