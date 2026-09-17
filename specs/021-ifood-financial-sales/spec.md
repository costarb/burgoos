# Feature Specification: Sincronização de Vendas Financeiras iFood

**Feature Branch**: `021-ifood-financial-sales`

**Created**: 2026-09-04

**Status**: Draft

**Input**: Integrar as vendas realizadas no iFood ao fluxo existente de sincronização por período, criando pedidos históricos quando necessário, enriquecendo pedidos já recebidos pela integração operacional, evitando duplicidades e preparando a solução para conciliação e homologação financeira.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consultar vendas iFood por período (Priority: P1)

Um administrador de estabelecimento com uma conexão iFood autorizada escolhe um período, inicia a consulta e visualiza uma prévia das vendas encontradas antes de confirmar qualquer criação ou atualização de pedidos.

**Why this priority**: Consultar e revisar as vendas é o valor central da funcionalidade e permite validar acesso, cobertura e qualidade dos dados sem alterar o histórico local.

**Independent Test**: Pode ser testada com uma loja autorizada e um período conhecido, comparando quantidade, identificadores, valores e estados da prévia com os registros financeiros disponibilizados pelo iFood, sem confirmar a importação.

**Acceptance Scenarios**:

1. **Given** uma conexão iFood ativa e autorizada para dados financeiros, **When** o administrador consulta um período permitido, **Then** todas as páginas disponíveis são processadas e a prévia informa vendas novas, pedidos já existentes, cancelamentos, inconsistências e falhas.
2. **Given** um período maior que 90 dias, **When** o administrador solicita a sincronização, **Then** a solicitação é rejeitada antes da coleta e o usuário recebe orientação clara para selecionar um intervalo válido.
3. **Given** uma venda com mais de um meio ou parcela de pagamento, **When** ela aparece na prévia, **Then** os meios, responsáveis pelo recebimento, valores e parcelas são apresentados sem consolidar informações incompatíveis.
4. **Given** uma credencial expirada, permissão ausente ou loja não autorizada, **When** a consulta é iniciada, **Then** nenhum dado é importado e o administrador recebe uma mensagem segura com a ação necessária.

---

### User Story 2 - Importar vendas sem duplicar pedidos (Priority: P1)

Após revisar a prévia, o administrador confirma a sincronização. O sistema relaciona cada venda ao pedido iFood já existente ou cria um pedido histórico consolidado quando não houver pedido local correspondente.

**Why this priority**: O sistema precisa completar o histórico de faturamento sem gerar pedidos duplicados nem perder vendas antigas que não chegaram pela integração operacional.

**Independent Test**: Pode ser testada com um período contendo uma venda já vinculada a um pedido local e outra ausente; a confirmação deve atualizar a primeira, criar somente a segunda e produzir zero duplicidades ao repetir todo o processo.

**Acceptance Scenarios**:

1. **Given** uma venda cujo identificador já está vinculado a um pedido iFood local, **When** a sincronização é confirmada, **Then** o pedido existente recebe os dados financeiros e nenhum novo pedido é criado.
2. **Given** uma venda concluída sem pedido local correspondente, **When** a sincronização é confirmada, **Then** é criado um pedido histórico consolidado, identificado como origem iFood e vinculado permanentemente à venda externa.
3. **Given** uma venda histórica sem detalhamento dos produtos, **When** ela gera um pedido, **Then** o pedido utiliza a estratégia de produto consolidado escolhida para a importação e sinaliza que não possui composição original dos itens.
4. **Given** uma sincronização repetida, concorrente ou retomada após falha, **When** a mesma venda é processada novamente, **Then** existe no máximo um pedido local associado àquela venda no mesmo estabelecimento e ambiente.
5. **Given** uma venda cancelada antes de ser faturada, **When** a sincronização é confirmada, **Then** ela permanece auditável, mas não cria uma nova venda concluída no histórico local.

---

### User Story 3 - Refletir corretamente valores e recebimentos (Priority: P1)

O administrador consulta vendas iFood com valor bruto, valor líquido, taxas, benefícios, método de pagamento, responsável pelo recebimento e previsão de repasse, distinguindo valores recebidos pelo iFood daqueles recebidos diretamente pela loja.

**Why this priority**: Classificar incorretamente o recebedor ou o saldo líquido distorce faturamento, caixa e contas a receber.

**Independent Test**: Pode ser testada com vendas online, dinheiro/cartão na entrega, benefício, parcelamento, desconto e comissão, confirmando que cada valor aparece na classificação correta e que somente valores devidos pelo iFood compõem o repasse esperado.

**Acceptance Scenarios**:

1. **Given** uma venda cujo pagamento foi recebido pelo iFood, **When** ela é sincronizada, **Then** o pedido registra o iFood como origem financeira e apresenta o saldo líquido e as previsões de repasse correspondentes.
2. **Given** uma venda cujo pagamento foi recebido diretamente pela loja, **When** ela é sincronizada, **Then** o recebimento não é tratado como valor a repassar pelo iFood, embora comissões ou ajustes relacionados permaneçam visíveis.
3. **Given** uma venda com subsídio, desconto, comissão, entrega ou taxa de serviço, **When** seus valores são apresentados, **Then** o valor pago pelo cliente, a receita da loja, os descontos e o saldo de repasse permanecem distinguíveis.
4. **Given** uma venda parcelada com datas de repasse diferentes, **When** ela é sincronizada, **Then** todas as parcelas e suas datas são preservadas, sem usar apenas uma data que torne o saldo enganoso.

---

### User Story 4 - Reconciliar alterações e repasses (Priority: P2)

O administrador acompanha eventos financeiros posteriores à venda, como cancelamentos, reembolsos, ajustes, retenções e liquidações, e consegue comparar o valor esperado com o efetivamente repassado.

**Why this priority**: A venda inicial não representa necessariamente o resultado financeiro final; a conciliação reduz divergências de caixa e suporte operacional.

**Independent Test**: Pode ser testada com um conjunto de vendas que sofra cancelamento, ajuste e liquidação posterior, verificando a evolução do saldo sem criar pedidos adicionais.

**Acceptance Scenarios**:

1. **Given** uma venda já sincronizada que recebe evento financeiro posterior, **When** a reconciliação é executada, **Then** o histórico financeiro é atualizado de forma idempotente e o pedido original permanece único.
2. **Given** um evento sem impacto no repasse, **When** ele é processado, **Then** permanece disponível para transparência, mas não altera o total esperado do iFood.
3. **Given** um valor liquidado diferente do esperado, **When** o fechamento é consultado, **Then** a divergência, o período, a situação e os lançamentos relacionados ficam visíveis para análise.
4. **Given** uma alteração financeira que possa exigir mudança operacional no pedido, **When** ela é identificada, **Then** o sistema sinaliza a ocorrência sem excluir, cancelar ou estornar automaticamente o pedido sem uma política aprovada.

---

### User Story 5 - Administrar saúde e homologação da integração (Priority: P2)

Administradores acompanham autorização, permissões, última sincronização, cobertura financeira, erros e prontidão para produção, enquanto responsáveis pela plataforma comprovam os comportamentos exigidos para homologação.

**Why this priority**: O acesso produtivo ao módulo financeiro depende de autorização e homologação, e falhas silenciosas podem deixar períodos inteiros incompletos.

**Independent Test**: Pode ser testada simulando conexão saudável, permissão pendente, token expirado, limite de consultas, falha parcial e integração não homologada, verificando o estado e a orientação exibidos em cada caso.

**Acceptance Scenarios**:

1. **Given** uma conexão ativa, **When** o administrador abre o painel, **Then** visualiza loja vinculada, ambiente, permissão financeira, última sincronização completa, período coberto e último erro seguro.
2. **Given** uma nova autorização ainda em propagação, **When** a validação temporariamente não encontra a loja, **Then** o sistema informa estado pendente e permite nova validação sem apagar a conexão.
3. **Given** indisponibilidade ou limite de consultas durante a paginação, **When** parte do período já foi processada, **Then** a execução pode ser retomada sem duplicar ou ocultar os dados anteriores.
4. **Given** que os critérios obrigatórios de produção não foram comprovados, **When** alguém tenta ativar a sincronização produtiva, **Then** a ativação é bloqueada e as pendências de homologação são apresentadas.

### Edge Cases

- Uma venda muda de concluída para cancelada ou parcialmente cancelada depois de já ter atualizado um pedido.
- O pedido operacional chega durante a importação histórica da mesma venda.
- Duas lojas usam o mesmo identificador curto de pedido, mas identificadores externos e permissões distintos.
- A venda contém método de pagamento futuro ou desconhecido, múltiplos recebedores ou valores que não fecham dentro da tolerância definida.
- O iFood retorna páginas sobrepostas, vazias antes da última página ou dados alterados durante a consulta.
- O período cruza mudança de mês, horário de verão ou diferença entre data local da loja e instante universal do evento.
- Uma parcela possui data prevista diferente das demais ou é posteriormente retida por acordo de recebíveis.
- Um pedido histórico não possui itens detalhados e não há produto consolidado selecionado para a estratégia de importação.
- A venda foi recebida diretamente pela loja, mas ainda possui comissão ou ajuste com impacto no repasse.
- Uma execução é interrompida após registrar a identidade externa e antes de concluir a criação ou atualização do pedido.
- O acesso à loja é revogado enquanto uma sincronização está em andamento.
- Dados financeiros incluem documentos, informações bancárias ou metadados que não devem aparecer em logs ou telas comuns.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir que administradores autorizados consultem vendas iFood por estabelecimento e período a partir de uma conexão válida.
- **FR-002**: O sistema MUST validar que a conexão possui acesso ao estabelecimento correto e permissão para consultar informações financeiras antes de iniciar uma execução.
- **FR-003**: O sistema MUST manter credenciais, autorizações, vendas, pedidos, eventos e execuções isolados por estabelecimento e ambiente.
- **FR-004**: O sistema MUST apresentar uma prévia antes da confirmação, separando vendas novas, pedidos existentes, cancelamentos, duplicidades, inconsistências e falhas.
- **FR-005**: A prévia MUST apresentar ao menos identificador, data local da venda, estado, valor dos itens, valor pago, saldo líquido, método de pagamento e responsável pelo recebimento quando disponíveis.
- **FR-006**: O sistema MUST percorrer todos os resultados do período e registrar evidência de cobertura suficiente para detectar execução incompleta.
- **FR-007**: Consultas MUST aceitar entre 1 e 90 dias; intervalos maiores MUST ser rejeitados antes da coleta com orientação clara, sem execução parcial ou silenciosa.
- **FR-008**: O sistema MUST respeitar limites de consulta, aplicar retomada controlada e informar falhas parciais sem marcar o período como completamente sincronizado.
- **FR-009**: Cada venda MUST possuir uma identidade externa durável que inclua estabelecimento, ambiente, origem e identificador da venda.
- **FR-010**: O sistema MUST garantir que a mesma venda origine no máximo um pedido local no mesmo estabelecimento e ambiente, inclusive sob repetição, concorrência e retomada.
- **FR-011**: Ao encontrar um pedido iFood já relacionado à venda, o sistema MUST enriquecer esse pedido com os dados financeiros em vez de criar outro.
- **FR-012**: Ao encontrar uma venda concluída sem pedido local, o sistema MUST permitir criar um pedido histórico consolidado após confirmação administrativa.
- **FR-013**: Pedidos históricos sem itens detalhados MUST usar uma estratégia explícita de produto consolidado e MUST indicar que sua composição de itens não veio da origem.
- **FR-014**: Vendas canceladas antes do faturamento MUST permanecer auditáveis e MUST NOT criar pedidos concluídos novos.
- **FR-015**: Cancelamentos, reembolsos ou ajustes posteriores MUST atualizar o histórico financeiro da venda e MUST NOT criar um segundo pedido.
- **FR-016**: O sistema MUST preservar separadamente valor dos itens, entrega, taxa de serviço, benefícios, valor pago, saldo líquido e lançamentos financeiros relevantes.
- **FR-017**: O saldo líquido da venda MUST refletir a composição financeira vigente e MUST NOT ser apresentado como sinônimo do valor total pago pelo cliente.
- **FR-018**: O sistema MUST preservar cada método de pagamento, valor, recebedor, bandeira, referência e parcelamento disponibilizados para uma venda.
- **FR-019**: Pagamentos recebidos diretamente pela loja MUST NOT compor o valor esperado de repasse do iFood.
- **FR-020**: Comissões, ajustes ou cancelamentos com impacto no repasse MUST permanecer associados à venda mesmo quando o pagamento original foi recebido pela loja.
- **FR-021**: Métodos ou classificações desconhecidos MUST ser preservados para revisão e MUST NOT ser convertidos silenciosamente para uma categoria financeira incorreta.
- **FR-022**: Quando houver várias parcelas ou datas previstas, o sistema MUST preservar todas elas e seus estados individualmente.
- **FR-023**: O administrador MUST conseguir repetir uma consulta e confirmar somente movimentos ainda não aplicados ou que necessitem reconciliação.
- **FR-024**: A reconciliação MUST preservar eventos financeiros posteriores, seus sinais, datas, impacto no repasse e associação com venda, pedido e período de apuração.
- **FR-025**: Somente eventos marcados como impactantes MUST compor o total esperado de repasse, mantendo os demais visíveis como informação.
- **FR-026**: O sistema MUST comparar valores esperados e liquidados e sinalizar divergências absolutas maiores que R$ 0,01.
- **FR-027**: Alterações financeiras MUST NOT excluir, cancelar, reabrir ou estornar automaticamente pedidos existentes até haver política operacional específica aprovada.
- **FR-028**: Toda execução MUST registrar solicitante ou rotina, estabelecimento, intervalo, início, término, cobertura, contagens, resultado e mensagem segura de erro.
- **FR-029**: O painel MUST exibir o estado da conexão financeira, loja vinculada, ambiente, última sincronização completa, período coberto, falhas e ação recomendada.
- **FR-030**: Somente administradores com acesso ao estabelecimento MUST poder consultar, confirmar importações, reconciliar ou alterar a conexão.
- **FR-031**: Credenciais, segredos, códigos de autorização, documentos completos, informações bancárias sensíveis e dados pessoais MUST NOT aparecer em logs, auditorias ou mensagens de erro.
- **FR-032**: O sistema MUST manter uma trilha auditável das autorizações, consultas, confirmações, criações, enriquecimentos, reconciliações e falhas sem expor dados sensíveis.
- **FR-033**: A revogação ou expiração de acesso MUST interromper novas consultas com segurança, preservar o histórico e orientar a recuperação da conexão.
- **FR-034**: A ativação produtiva MUST permanecer bloqueada até que os critérios financeiros obrigatórios do iFood sejam comprovados e registrados.
- **FR-035**: A entrega inicial MUST incluir consulta de vendas, deduplicação, enriquecimento de pedidos existentes e importação histórica; a liberação produtiva MUST também incluir eventos financeiros, liquidações e geração/download do arquivo de reconciliação sob demanda.
- **FR-036**: O sistema MUST manter compatibilidade com os fluxos existentes de PagBank e Mercado Pago e MUST NOT alterar suas identidades ou resultados durante a inclusão do iFood.
- **FR-037**: Relatórios e filtros de vendas MUST permitir identificar separadamente vendas originadas do iFood após a sincronização.

### Key Entities

- **Conexão Financeira iFood**: Autorização de um estabelecimento para consultar vendas e informações de repasse; registra ambiente, estabelecimento externo, permissões, estado e saúde sem expor credenciais.
- **Execução de Sincronização**: Consulta de um período com cobertura, progresso, contagens, resultado, falhas e possibilidade de retomada.
- **Venda Externa iFood**: Registro financeiro de uma venda com identidade externa, estado, datas, valores, pagamentos, recebedores e composição financeira.
- **Identidade Externa da Venda**: Vínculo único que impede duplicidade e relaciona a venda iFood a um único pedido local por estabelecimento e ambiente.
- **Pedido iFood**: Pedido operacional já recebido ou pedido histórico consolidado criado a partir de uma venda ausente.
- **Pagamento da Venda**: Método, valor, recebedor, bandeira, referência e eventual parcelamento associado à venda.
- **Parcela de Recebimento**: Parte de um pagamento com valor, previsão, situação e eventual liquidação próprios.
- **Evento Financeiro**: Crédito, débito, comissão, retenção, benefício, cancelamento, reembolso ou ajuste associado à venda e classificado quanto ao impacto no repasse.
- **Liquidação**: Fechamento que informa o valor efetivamente repassado ou retido e permite comparação com o saldo esperado.
- **Evento de Auditoria**: Evidência segura de ação administrativa ou automática e de seu resultado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em períodos de aceite com dados conhecidos, 100% das vendas disponibilizadas pelo iFood são classificadas na prévia como novas, existentes, canceladas, inconsistentes ou falhas, sem desaparecimento silencioso.
- **SC-002**: Repetir integralmente uma sincronização confirmada, inclusive com duas execuções concorrentes, cria zero pedidos duplicados.
- **SC-003**: 100% das vendas que já possuem pedido iFood local enriquecem esse pedido, sem criar um segundo registro operacional.
- **SC-004**: 100% das vendas históricas concluídas e elegíveis, após confirmação, geram um pedido consolidado ou uma justificativa visível de bloqueio.
- **SC-005**: Em cenários de pagamento online, recebimento pela loja, benefícios e parcelamento, os totais esperados de repasse coincidem com a fonte externa dentro de R$ 0,01 por venda e por fechamento.
- **SC-006**: Nenhum pagamento recebido diretamente pela loja aumenta o total esperado de repasse do iFood nos testes de aceite.
- **SC-007**: Uma consulta de até 90 dias apresenta confirmação de início ou estado de progresso ao administrador em até 5 segundos.
- **SC-008**: Após falha parcial, uma retomada processa 100% dos resultados restantes e duplica zero vendas ou pedidos já aplicados.
- **SC-009**: Testes envolvendo dois estabelecimentos e dois ambientes demonstram zero leitura, escrita ou uso de credencial cruzado.
- **SC-010**: 100% dos cancelamentos, reembolsos e ajustes de aceite permanecem associados ao pedido original e não criam novos pedidos.
- **SC-011**: Administradores identificam em uma única tela a última sincronização completa, período coberto, estado da conexão e ação de recuperação necessária.
- **SC-012**: Inspeções de logs, respostas e auditorias encontram zero credenciais, segredos, documentos completos ou informações bancárias sensíveis expostas.
- **SC-013**: A ativação produtiva só pode ocorrer após 100% dos critérios obrigatórios de homologação terem evidência registrada.
- **SC-014**: As suítes de aceite de PagBank e Mercado Pago mantêm seus resultados anteriores após a inclusão do iFood.

## Assumptions

- A conexão operacional iFood já existente será reutilizada quando possuir as permissões financeiras necessárias; uma nova autorização será solicitada quando essas permissões não estiverem presentes.
- A loja é representada pelo estabelecimento já selecionado no sistema e possui um identificador iFood previamente validado.
- Cada execução poderá cobrir de 1 a 90 dias; períodos maiores serão solicitados pelo administrador em execuções separadas.
- Vendas financeiras ficam disponíveis no mesmo dia, mas eventos, ajustes e liquidações podem ser atualizados posteriormente.
- A fonte financeira não fornece a composição completa dos produtos; pedidos históricos ausentes serão consolidados usando a estratégia de produto fixo já conhecida pelo fluxo de importação.
- Pedidos recebidos pela integração operacional continuam sendo a fonte preferencial para itens, cliente, entrega e observações.
- O identificador único da venda iFood corresponde ao identificador utilizado para relacionar o pedido operacional; diferenças encontradas na prova de conceito serão tratadas como bloqueio de liberação.
- O valor bruto da cesta, o valor pago pelo consumidor e o saldo líquido são conceitos distintos e permanecerão separados.
- Um pagamento pode ser recebido pelo iFood ou diretamente pela loja; somente o primeiro representa entrada a receber do iFood.
- Eventos financeiros sem impacto no repasse serão guardados para transparência, mas excluídos dos totalizadores de recebimento esperado.
- A tolerância de conciliação desta entrega será fixa em R$ 0,01.
- Alterações automáticas destrutivas em pedidos estão fora desta entrega; divergências posteriores serão conciliadas e sinalizadas.
- A liberação produtiva depende de conta profissional, permissões do módulo financeiro, ambiente de teste e homologação formal do iFood.

## Dependencies and Scope Boundaries

- Depende de acesso ao Portal do Desenvolvedor iFood, aplicação habilitada para o módulo financeiro e autorização da loja parceira.
- Depende de dados de teste e do processo formal de homologação do módulo financeiro antes da ativação produtiva.
- Inclui consulta de vendas, prévia, importação histórica, enriquecimento de pedidos existentes, deduplicação, eventos financeiros, liquidações, arquivo de reconciliação sob demanda, download e auditoria.
- Não inclui reconstrução de itens históricos ausentes, pois a fonte financeira não fornece essa composição.
- Não inclui alterações automáticas destrutivas em pedidos após cancelamentos, ajustes ou reembolsos.
- Não inclui contabilidade fiscal, emissão de documentos fiscais ou liquidação bancária efetuada pelo próprio sistema.
- Não substitui a integração operacional iFood usada para receber e acompanhar pedidos em tempo real.
