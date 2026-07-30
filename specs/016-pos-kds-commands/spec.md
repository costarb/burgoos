# Feature Specification: PDV, Comandas e KDS Omnicanal

**Feature Branch**: `016-pos-kds-commands`

**Created**: 2026-07-23

**Status**: Draft

**Input**: Criar uma operação de balcão para atendentes registrarem e personalizarem pedidos, cobrarem por Mercado Pago Point, PagBank manual ou caixa local, acompanharem a produção em um KDS omnicanal e disponibilizarem uma fila pública de acompanhamento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar pedido no balcão (Priority: P1)

Um atendente monta rapidamente um pedido presencial usando o cardápio ativo da loja, ajusta quantidades, observações e ingredientes, informa o canal de atendimento e confirma o valor antes de enviá-lo à produção.

Quando o produto possuir ficha técnica, o atendente pode retirar ingredientes existentes e adicionar complementos autorizados. O sistema apresenta o preço calculado e permite um ajuste manual do preço mediante justificativa, mantendo visível a diferença entre o preço calculado e o cobrado.

**Why this priority**: Sem uma captura interna de pedidos, o estabelecimento continua dependente de anotações e lançamentos posteriores, impedindo a operação integrada.

**Independent Test**: Um usuário com perfil Atendente consegue criar um pedido de retirada, personalizar um item, justificar um preço diferente e vê-lo aparecer no KDS com a origem Balcão.

**Acceptance Scenarios**:

1. **Given** um atendente autenticado e um cardápio ativo, **When** ele seleciona produtos e confirma o pedido, **Then** o pedido é criado para a loja ativa com itens, preços, origem, operador e horário registrados.
2. **Given** um produto com ficha técnica, **When** o atendente remove um ingrediente permitido, **Then** a personalização aparece no resumo, no pedido e no KDS.
3. **Given** um complemento vendável, **When** o atendente o adiciona, **Then** o preço calculado é atualizado conforme a regra cadastrada.
4. **Given** um valor manual diferente do preço calculado, **When** o atendente informa a justificativa e confirma, **Then** o valor cobrado é salvo junto do valor original, da diferença, da justificativa e do responsável.
5. **Given** um produto inativo ou indisponível, **When** o atendente tenta confirmar o pedido, **Then** o sistema bloqueia a confirmação, preserva os demais itens e explica o que precisa ser corrigido.
6. **Given** uma falha temporária ao confirmar, **When** o atendente tenta novamente, **Then** a mesma tentativa não cria pedidos duplicados.

---

### User Story 2 - Manter uma comanda aberta (Priority: P1)

O atendente abre uma comanda identificada por número, apelido do cliente ou mesa, inclui um ou mais pedidos ao longo do atendimento e envia cada pedido para produção sem exigir pagamento imediato.

A comanda consolida o total consumido e permite novos pedidos até o início do fechamento. O atendimento também pode criar um pedido avulso sem comanda quando a operação for de pagamento imediato.

**Why this priority**: No food truck, o cliente pode pedir, consumir e voltar para pedir mais antes de pagar. Separar comanda, pedido e pagamento representa a operação real sem bloquear a cozinha.

**Independent Test**: Abrir uma comanda, enviar dois pedidos separados para o KDS, conferir o total consolidado e iniciar o fechamento sem impedir que cada pedido siga seu próprio fluxo de produção.

**Acceptance Scenarios**:

1. **Given** uma comanda aberta, **When** o atendente adiciona um pedido, **Then** o pedido entra no KDS imediatamente e o saldo da comanda é atualizado.
2. **Given** dois pedidos na mesma comanda, **When** um fica pronto antes do outro, **Then** cada pedido mantém seu próprio andamento sem alterar incorretamente o estado da comanda.
3. **Given** uma comanda em fechamento, **When** alguém tenta adicionar um novo pedido, **Then** o sistema solicita reabertura autorizada ou criação de outra comanda.
4. **Given** um cliente que pagará imediatamente, **When** o atendente escolhe pedido avulso, **Then** o fluxo não exige número de comanda ou mesa.
5. **Given** duas pessoas tentando editar a mesma comanda, **When** a segunda confirma dados desatualizados, **Then** o sistema evita sobrescrita e solicita atualização dos valores.

---

### User Story 3 - Cobrar automaticamente no Mercado Pago Point (Priority: P1)

O atendente seleciona Mercado Pago, escolhe uma maquininha habilitada e envia a cobrança. A maquininha apresenta o valor ao cliente e o sistema acompanha o resultado sem exigir que o atendente digite dados sensíveis.

O pagamento possui ciclo próprio e não é confundido com o andamento da cozinha. Uma cobrança aprovada quita o pedido ou a comanda; recusas, expiração, cancelamento e falhas de comunicação mantêm o saldo em aberto e oferecem uma próxima ação segura.

**Why this priority**: É a automação principal de PDV desejada e reduz divergências entre pedido, maquininha e conciliação financeira.

**Independent Test**: Enviar uma cobrança a uma maquininha de teste, receber confirmação assíncrona, quitar a comanda uma única vez e refletir o pagamento na operação e no financeiro.

**Acceptance Scenarios**:

1. **Given** uma conexão Mercado Pago válida e uma maquininha disponível, **When** o atendente envia a cobrança, **Then** o sistema registra a tentativa e exibe que aguarda interação do cliente.
2. **Given** uma cobrança aprovada, **When** a confirmação é recebida, **Then** o pagamento é marcado como aprovado, o saldo correspondente é quitado e o pedido não é quitado novamente por eventos repetidos.
3. **Given** uma cobrança recusada, **When** o resultado é recebido, **Then** o saldo permanece aberto e o atendente pode tentar novamente ou escolher outro meio.
4. **Given** uma cobrança expirada ou cancelada na maquininha, **When** o resultado é confirmado, **Then** a tentativa é encerrada sem cancelar automaticamente o pedido em produção.
5. **Given** ausência ou atraso da confirmação, **When** o limite de espera é atingido, **Then** o sistema consulta o resultado, mantém estado inconclusivo quando necessário e impede cobranças concorrentes acidentais.
6. **Given** uma tentativa inconclusiva, **When** o atendente solicita nova cobrança, **Then** o sistema alerta sobre risco de duplicidade e exige confirmação após verificar a tentativa anterior.
7. **Given** um pagamento aprovado e posteriormente cancelado ou estornado, **When** a atualização é recebida, **Then** o pagamento e o saldo são ajustados, sem apagar o histórico da venda.

---

### User Story 4 - Registrar pagamento manual PagBank ou caixa local (Priority: P1)

O atendente seleciona a instituição e o meio de pagamento. Para PagBank, realiza a cobrança fisicamente na maquininha e retorna ao sistema para confirmar o resultado. Para Caixa local, registra dinheiro recebido, valor entregue, troco e responsável.

Confirmações manuais são claramente identificadas e auditadas. A instituição financeira e o meio de pagamento são dimensões distintas: por exemplo, PagBank + débito, Mercado Pago + crédito ou Caixa local + dinheiro.

**Why this priority**: Mantém a operação funcional enquanto PagBank não oferece o mesmo fluxo automatizado adotado para Mercado Pago e organiza corretamente o domínio financeiro.

**Independent Test**: Concluir uma venda PagBank manual com débito e outra em dinheiro com troco, verificando quitação, identificação do operador e trilha de auditoria.

**Acceptance Scenarios**:

1. **Given** uma comanda com saldo aberto, **When** o atendente seleciona PagBank e débito, confirma a aprovação manual e informa a referência disponível, **Then** o saldo é quitado e o registro fica marcado como confirmação manual.
2. **Given** pagamento em dinheiro, **When** o atendente informa valor recebido maior que o total, **Then** o sistema calcula e exibe o troco antes da confirmação.
3. **Given** valor recebido insuficiente, **When** pagamentos parciais não estiverem habilitados, **Then** o sistema bloqueia a quitação total.
4. **Given** uma confirmação manual incorreta, **When** um usuário autorizado a corrige ou cancela, **Then** o sistema preserva o registro original, o motivo e o responsável.
5. **Given** uma instituição inativa para a loja, **When** o atendente abre a cobrança, **Then** ela não aparece como opção disponível.

---

### User Story 5 - Operar a cozinha em um KDS omnicanal (Priority: P1)

A cozinha visualiza em tempo real todos os pedidos que precisam de produção, independentemente de terem vindo do Balcão, Cardápio público, iFood ou outra origem. Cada cartão evidencia origem, horário, tempo em fila, comanda, itens, quantidades, personalizações, observações e situação de pagamento sem expor dados desnecessários.

Os termos e próximos passos se adaptam ao tipo de atendimento. Para consumo local ou retirada, o fluxo operacional é Recebido, Em preparo, Pronto e Entregue. Para delivery, existe também a etapa Saiu para entrega.

**Why this priority**: O KDS é o centro da execução e deve refletir a operação omnicanal atual, não apenas um fluxo de delivery.

**Independent Test**: Criar pedidos pelos canais Balcão, Cardápio e iFood, ordená-los pelo horário de entrada e conduzi-los pelos estados adequados até entrega.

**Acceptance Scenarios**:

1. **Given** pedidos de canais diferentes, **When** entram na produção, **Then** todos aparecem no KDS com identificação clara da origem e sem duplicação.
2. **Given** um pedido local, **When** a cozinha o marca como Pronto, **Then** ele permanece aguardando entrega ao cliente e não recebe o rótulo Saiu para entrega.
3. **Given** um pedido delivery, **When** sai com o entregador, **Then** o KDS permite a etapa Saiu para entrega antes de Entregue.
4. **Given** um pedido ainda não pago mas liberado para produção, **When** a cozinha o visualiza, **Then** o cartão indica Aguardando pagamento sem bloquear seu preparo.
5. **Given** vários pedidos ativos, **When** o painel é aberto, **Then** os mais antigos e os que ultrapassaram o tempo esperado recebem prioridade visual.
6. **Given** perda e retorno da conexão, **When** o KDS reconecta, **Then** ele recupera o estado atual sem repetir transições já confirmadas.
7. **Given** cancelamento após o início do preparo, **When** um usuário autorizado cancela, **Then** o KDS destaca a ocorrência e exige ciência da cozinha.

---

### User Story 6 - Assumir e concluir o atendimento (Priority: P2)

Um atendente pode assumir um pedido ou uma comanda, identificar que está responsável pelo atendimento e conduzir as ações de cobrança, entrega e fechamento. Outros usuários continuam vendo o responsável e podem assumir mediante confirmação quando necessário.

**Why this priority**: Evita que dois atendentes cobrem a mesma comanda ou que pedidos prontos fiquem sem responsável em momentos de pico.

**Independent Test**: Um atendente assume uma comanda, outro tenta cobrar, recebe um alerta e transfere a responsabilidade com histórico preservado.

**Acceptance Scenarios**:

1. **Given** um pedido sem responsável, **When** o atendente o assume, **Then** seu nome e horário ficam visíveis para a equipe.
2. **Given** uma comanda assumida por outro atendente, **When** alguém inicia a cobrança, **Then** o sistema alerta e exige confirmação de transferência ou atuação autorizada.
3. **Given** troca de turno, **When** a responsabilidade é transferida, **Then** pedidos e comandas permanecem ativos e a troca é auditada.

---

### User Story 7 - Acompanhar a fila como cliente (Priority: P2)

O cliente visualiza uma tela pública simples, própria para televisão e celular, com pedidos em Recebido, Em preparo e Pronto. Pedidos concluídos exibem sempre os mais recentes, enquanto os ativos priorizam os mais antigos.

A tela usa um código público curto ou apelido autorizado e nunca expõe telefone, endereço, valor, forma de pagamento ou nome completo sem consentimento.

**Why this priority**: Reduz perguntas no balcão, organiza a retirada e melhora a percepção de andamento em uma operação de food truck.

**Independent Test**: Abrir a fila pública sem autenticação, acompanhar um pedido mudar de Recebido para Pronto e confirmar que apenas o identificador público é exibido.

**Acceptance Scenarios**:

1. **Given** pedidos ativos, **When** a fila pública é exibida, **Then** Recebidos e Em preparo aparecem do mais antigo para o mais recente.
2. **Given** pedidos prontos ou concluídos, **When** a fila é atualizada, **Then** os mais recentes aparecem primeiro e somente uma quantidade limitada permanece visível.
3. **Given** um pedido cancelado, **When** a fila é atualizada, **Then** ele deixa de aparecer sem revelar o motivo ao público.
4. **Given** uma queda temporária de conexão, **When** a tela não consegue atualizar, **Then** mantém o último estado com aviso de atualização pendente, sem trocar pedidos de loja.
5. **Given** duas lojas diferentes, **When** cada uma abre sua fila pública, **Then** nenhuma visualiza pedidos da outra.

---

### User Story 8 - Trabalhar com perfil Atendente (Priority: P2)

O administrador atribui o perfil padrão Atendente a um usuário da loja. Esse usuário acessa somente a captura de pedidos e o KDS/pedidos, com ações operacionais compatíveis com sua função.

Configurações, relatórios sensíveis, credenciais, manutenção financeira e administração de acessos permanecem indisponíveis. Ajustes de preço, cancelamentos e estornos podem exigir permissões adicionais definidas pela loja.

**Why this priority**: A operação precisa de acesso simples e seguro, sem expor funções administrativas a quem atende o balcão.

**Independent Test**: Entrar com um usuário Atendente, criar e acompanhar pedidos e verificar que rotas e ações administrativas estão bloqueadas.

**Acceptance Scenarios**:

1. **Given** um usuário com perfil Atendente, **When** entra no sistema, **Then** visualiza apenas Capturar pedido e Pedidos/KDS na navegação.
2. **Given** o mesmo usuário, **When** tenta acessar uma área administrativa diretamente, **Then** o acesso é negado e auditado.
3. **Given** uma ação sensível sem permissão, **When** o atendente tenta executá-la, **Then** o sistema solicita um responsável autorizado ou impede a ação.
4. **Given** um usuário com acesso a duas lojas, **When** troca de loja, **Then** pedidos, comandas, maquininhas e permissões passam a refletir apenas a loja ativa.

---

### User Story 9 - Supervisionar exceções e reconciliação (Priority: P3)

Um gestor acompanha cobranças pendentes, recusadas, duplicadas, canceladas, estornadas ou confirmadas manualmente. Ele pode reconciliar uma exceção sem alterar silenciosamente o histórico operacional.

**Why this priority**: Pagamentos presenciais estão sujeitos a falha de internet, duplicidade, desistência e divergência manual; a operação precisa ser recuperável e auditável.

**Independent Test**: Simular uma confirmação atrasada após nova tentativa e conduzir a ocorrência à resolução sem quitar a comanda duas vezes.

**Acceptance Scenarios**:

1. **Given** duas cobranças potencialmente aprovadas para o mesmo saldo, **When** a segunda confirmação chega, **Then** o sistema bloqueia quitação duplicada e abre uma exceção.
2. **Given** um evento repetido, **When** ele é processado novamente, **Then** não gera novo pagamento, nova transição ou novo lançamento financeiro.
3. **Given** divergência entre confirmação manual e conciliação posterior, **When** o gestor revisa a ocorrência, **Then** consegue associar, corrigir ou estornar com motivo e auditoria.
4. **Given** indisponibilidade prolongada do provedor, **When** o atendente escolhe continuar manualmente, **Then** o sistema registra a contingência e mantém o pedido operacional.

### Edge Cases

- O cliente desiste antes do preparo, durante o preparo ou depois de consumir.
- A comanda possui pedidos entregues, pedido em preparo e saldo parcialmente pago ao mesmo tempo.
- A cobrança é aprovada na maquininha, mas a confirmação chega atrasada ou fora de ordem.
- O atendente fecha ou atualiza a página durante uma cobrança em andamento.
- A maquininha selecionada está desligada, ocupada, desvinculada ou vinculada a outra loja.
- O token do estabelecimento expira durante a criação ou consulta da cobrança.
- O mesmo evento de pagamento chega várias vezes ou dois eventos chegam simultaneamente.
- Um pagamento aprovado é cancelado, total ou parcialmente estornado depois do fechamento.
- O valor manual do pedido fica abaixo do custo estimado ou fora do limite autorizado.
- Um ingrediente removido não altera preço, enquanto um complemento pode alterar; ambas as regras devem ser explícitas.
- Um produto muda de preço ou ficha técnica enquanto está no carrinho.
- Um pedido público chega sem pagamento, com pagamento externo ou com dados incompletos.
- Uma comanda é esquecida aberta ao fim do turno.
- Um pedido pronto não é retirado e ultrapassa o tempo operacional esperado.
- A fila pública recebe apelidos ofensivos ou dados pessoais como identificador.
- O estabelecimento opera temporariamente sem internet.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar uma tela de captura de pedidos otimizada para toque, pesquisa rápida, categorias, itens favoritos e resumo persistente durante a sessão.
- **FR-002**: O sistema MUST criar pedidos apenas com produtos ativos e disponíveis na loja selecionada.
- **FR-003**: O sistema MUST registrar a origem de cada pedido, distinguindo ao menos Balcão, Cardápio público, iFood, Importação e outras integrações futuras.
- **FR-004**: O sistema MUST registrar o operador responsável pela criação e pelas ações manuais realizadas em pedidos internos.
- **FR-005**: O sistema MUST permitir pedido avulso ou pedido associado a uma comanda aberta.
- **FR-006**: O sistema MUST permitir que uma comanda reúna múltiplos pedidos criados em momentos diferentes.
- **FR-007**: O sistema MUST manter separadamente o estado da comanda, o estado de produção/entrega do pedido e o estado de cada pagamento.
- **FR-008**: O sistema MUST impedir a inclusão comum de novos pedidos em comandas em fechamento, pagas ou canceladas.
- **FR-009**: Usuários autorizados MUST poder reabrir ou transferir uma comanda mediante motivo e auditoria.
- **FR-010**: O sistema MUST permitir retirar ingredientes previstos na ficha técnica e registrar a personalização como parte imutável do item confirmado.
- **FR-011**: O sistema MUST permitir adicionar somente complementos autorizados para o produto ou categoria, com preço e disponibilidade próprios.
- **FR-012**: O sistema MUST preservar no item o nome, preço-base, composição selecionada e preço calculado vigentes no momento da confirmação.
- **FR-013**: O sistema MUST recalcular o total a cada alteração de item, quantidade, remoção, complemento ou desconto permitido.
- **FR-014**: O sistema MUST permitir ajuste manual de preço somente com justificativa e dentro da permissão e dos limites configurados para o usuário.
- **FR-015**: Ajustes de preço MUST preservar valor calculado, valor cobrado, diferença, justificativa, autor e horário.
- **FR-016**: O sistema MUST representar instituição de pagamento e meio de pagamento como informações distintas.
- **FR-017**: A loja MUST poder ativar ou desativar as instituições e meios disponíveis em sua captura de pedidos.
- **FR-018**: O sistema MUST suportar inicialmente Mercado Pago, PagBank e Caixa local, sem impedir novas instituições.
- **FR-019**: Caixa local MUST representar recebimentos controlados pela própria loja, incluindo dinheiro.
- **FR-020**: Para dinheiro, o sistema MUST informar valor recebido e calcular troco antes da confirmação.
- **FR-021**: O sistema MUST registrar confirmações PagBank manuais com instituição, meio, valor, operador, horário e referência opcional.
- **FR-022**: Confirmações e cancelamentos manuais de pagamento MUST possuir trilha de auditoria e permissão própria.
- **FR-023**: O sistema MUST listar somente maquininhas Mercado Pago associadas à conexão e à loja ativas.
- **FR-024**: O atendente MUST poder escolher a maquininha Mercado Pago antes de enviar uma cobrança.
- **FR-025**: O sistema MUST associar cada cobrança automática ao pedido ou comanda, ao estabelecimento, à maquininha, ao operador e a uma referência única.
- **FR-026**: O sistema MUST evitar a criação duplicada de pedidos e cobranças quando uma ação é repetida por falha ou impaciência do usuário.
- **FR-027**: O sistema MUST tratar cobrança criada, aguardando cliente, processando, aprovada, recusada, cancelada, expirada, falha, estornada e inconclusiva.
- **FR-028**: O sistema MUST validar a autenticidade das notificações do provedor antes de alterar pagamentos.
- **FR-029**: Uma notificação MUST ser tratada como aviso; o resultado financeiro final MUST ser confirmado com a fonte oficial antes da quitação.
- **FR-030**: Eventos repetidos ou fora de ordem MUST produzir o mesmo resultado final sem duplicar quitação ou lançamentos.
- **FR-031**: O sistema MUST reconciliar cobranças sem confirmação e permitir recuperação após perda de notificações.
- **FR-032**: Uma falha de pagamento MUST NOT cancelar automaticamente o pedido ou retirá-lo da produção.
- **FR-033**: Um pagamento aprovado MUST quitar apenas o saldo correspondente e MUST NOT marcar automaticamente um pedido como produzido ou entregue.
- **FR-034**: Cancelamentos e estornos MUST reabrir ou ajustar o saldo e gerar uma exceção quando a mercadoria já tiver sido entregue.
- **FR-035**: O sistema MUST permitir que pedidos aguardando pagamento sejam liberados para o KDS.
- **FR-036**: O KDS MUST consolidar pedidos de todas as origens da loja sem misturar estabelecimentos.
- **FR-037**: O KDS MUST evidenciar origem, código, comanda, idade do pedido, itens, personalizações, observações, atendimento e situação resumida de pagamento.
- **FR-038**: Para retirada ou consumo local, o fluxo MUST contemplar Recebido, Em preparo, Pronto, Entregue e Cancelado.
- **FR-039**: Para delivery, o fluxo MUST permitir Saiu para entrega entre Pronto e Entregue.
- **FR-040**: O sistema MUST validar transições de estado e impedir regressões ou saltos não autorizados.
- **FR-041**: Cancelamentos após início do preparo MUST exigir motivo e ciência operacional.
- **FR-042**: O KDS MUST ordenar filas ativas pela entrada mais antiga e destacar pedidos acima do tempo esperado.
- **FR-043**: O sistema MUST atualizar captura, KDS, atendimento e fila pública quando pedidos ou pagamentos mudarem.
- **FR-044**: Após reconexão, cada tela MUST recuperar o estado atual e não depender apenas de eventos ocorridos enquanto estava aberta.
- **FR-045**: O sistema MUST permitir assumir e transferir responsabilidade por pedido ou comanda, preservando histórico.
- **FR-046**: O sistema MUST fornecer uma fila pública isolada por loja, sem exigir autenticação.
- **FR-047**: A fila pública MUST usar código curto ou apelido moderado e MUST NOT expor telefone, endereço, valor ou forma de pagamento.
- **FR-048**: A fila pública MUST mostrar ativos do mais antigo para o mais novo e concluídos/prontos mais recentes primeiro.
- **FR-049**: A loja MUST poder configurar quais estados aparecem, quantidade máxima de concluídos e identificação exibida na fila pública.
- **FR-050**: O sistema MUST criar um perfil padrão Atendente restrito à captura de pedidos e ao KDS/pedidos.
- **FR-051**: O perfil Atendente MUST NOT acessar credenciais, configurações globais, relatórios sensíveis, finanças administrativas ou gestão de usuários.
- **FR-052**: Criação, ajuste de preço, cancelamento, estorno, confirmação manual e transferência MUST possuir permissões independentes.
- **FR-053**: A navegação MUST exibir apenas telas permitidas e o servidor MUST bloquear acesso direto não autorizado.
- **FR-054**: O sistema MUST manter histórico cronológico de criação, personalização, produção, responsabilidade, cobrança, cancelamento e estorno.
- **FR-055**: O sistema MUST oferecer uma visão de exceções financeiras para cobranças inconclusivas, possivelmente duplicadas, divergentes ou estornadas.
- **FR-056**: O sistema MUST permitir encerrar o turno identificando comandas abertas, pedidos não concluídos e pagamentos inconclusivos.
- **FR-057**: O cardápio público e integrações existentes MUST continuar criando pedidos sem depender da nova tela interna.
- **FR-058**: Pedidos existentes MUST continuar legíveis após a introdução de novos estados, origens e informações de pagamento.
- **FR-059**: O sistema MUST registrar horários usando o instante real do evento e apresentar datas no fuso da loja.
- **FR-060**: Dados, maquininhas, comandas, pedidos, cobranças e eventos MUST permanecer isolados por estabelecimento.

### Key Entities

- **Comanda**: Agrupador opcional de consumo de um cliente ou mesa; possui identificador público, apelido opcional, responsável, saldo, versão e estados Aberta, Em fechamento, Paga e Cancelada.
- **Pedido**: Solicitação de produção originada por um canal; pertence a uma loja e opcionalmente a uma comanda, possui código de fila, responsável e ciclo operacional próprio.
- **Item do pedido**: Retrato do produto comprado, incluindo quantidade, preço-base, personalizações, preço calculado, preço cobrado e observações.
- **Personalização de item**: Ingrediente removido ou complemento adicionado, com regra de preço, quantidade e descrição preservadas no pedido.
- **Complemento**: Adicional vendável e configurado para produtos ou categorias, com preço, disponibilidade e limites.
- **Cobrança**: Tentativa de receber um valor de pedido ou comanda por uma instituição e meio de pagamento; possui ciclo e referência próprios.
- **Pagamento**: Resultado financeiro confirmado de uma cobrança, que reduz o saldo e pode posteriormente ser cancelado ou estornado.
- **Instituição de pagamento**: Entidade que processa ou controla o recebimento, inicialmente Mercado Pago, PagBank ou Caixa local.
- **Meio de pagamento**: Forma usada pelo cliente, como dinheiro, débito, crédito, Pix, voucher ou carteira digital.
- **Terminal de pagamento**: Maquininha vinculada a uma instituição, conta e loja, com identificação, apelido e disponibilidade operacional.
- **Evento de pagamento**: Notificação externa ou registro manual usado para atualizar uma cobrança, com identidade única e resultado de processamento.
- **Atribuição operacional**: Registro de quem assumiu, transferiu ou concluiu um pedido ou comanda.
- **Entrada de KDS**: Projeção operacional do pedido com prioridade, tempos, origem e próximos estados possíveis.
- **Identidade pública do pedido**: Código curto ou apelido moderado usado na fila do cliente sem revelar dados pessoais.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um atendente treinado consegue registrar um pedido simples de três itens em até 60 segundos.
- **SC-002**: Um atendente consegue personalizar um lanche e revisar o impacto no preço em até 30 segundos.
- **SC-003**: 100% dos pedidos confirmados por qualquer canal aparecem no KDS correto em até 3 segundos em condições normais.
- **SC-004**: 100% dos cartões do KDS identificam claramente a origem e o tipo de atendimento.
- **SC-005**: Uma cobrança enviada ao Mercado Pago apresenta estado inicial ao atendente em até 3 segundos e reflete o resultado confirmado em até 10 segundos após sua disponibilização pelo provedor.
- **SC-006**: Repetir a confirmação de pedido, cobrança ou evento 100 vezes resulta em um único efeito financeiro e operacional.
- **SC-007**: Nenhuma recusa, expiração ou falha de cobrança remove automaticamente um pedido em produção.
- **SC-008**: O total da comanda corresponde à soma dos pedidos menos pagamentos válidos em 100% dos cenários de teste, incluindo cancelamento e estorno.
- **SC-009**: A fila pública atualiza o andamento em até 5 segundos e nunca exibe telefone, endereço, valor ou meio de pagamento.
- **SC-010**: O KDS recupera o estado correto em até 10 segundos após uma reconexão de rede.
- **SC-011**: 100% das ações de ajuste manual de preço, confirmação manual, cancelamento, estorno e transferência possuem autor, horário e motivo rastreáveis.
- **SC-012**: Usuários com perfil Atendente não conseguem acessar nenhuma função fora de captura e operação de pedidos em testes de navegação e acesso direto.
- **SC-013**: Uma operação piloto consegue concluir um turno com todas as comandas, pedidos e cobranças classificados, sem registros inconclusivos silenciosos.
- **SC-014**: Durante o piloto, ao menos 95% dos pedidos de balcão são registrados sem ajuda de administrador ou suporte técnico.
- **SC-015**: Nenhum teste com duas lojas permite visualizar ou operar pedido, comanda, terminal ou cobrança de outro estabelecimento.

## Assumptions

- Comanda é um agrupador opcional; pedidos avulsos permanecem disponíveis.
- Mesa é uma etiqueta opcional da comanda, não um módulo completo de salão nesta entrega.
- Pagamentos parciais e divisão da conta são desejáveis no modelo, mas podem ser entregues após a quitação integral inicial; o modelo não deve impedir sua evolução.
- Gorjeta, taxa de serviço, impressão fiscal, emissão de nota, TEF PagBank automático e operação offline completa ficam fora do primeiro incremento.
- A produção pode começar antes do pagamento quando o atendente libera o pedido para o KDS.
- O preço manual não altera o cadastro do produto; vale somente para o item do pedido e exige permissão.
- Remover ingrediente não reduz preço por padrão; complementos podem acrescentar preço conforme cadastro.
- Pedidos do cardápio público e iFood continuarão usando seus fluxos de entrada, sendo normalizados para o mesmo KDS.
- A integração Mercado Pago existente por estabelecimento será reutilizada; a loja deverá selecionar e habilitar terminais associados à própria conta.
- Mercado Pago Point usará a experiência atual de Orders do provedor, com referência única, tentativa idempotente, consulta de estado e notificações assinadas.
- PagBank será manual no primeiro incremento; integração automática futura deverá reutilizar o mesmo domínio de cobrança e pagamento.
- A confirmação manual declara o resultado operacional informado pelo atendente e pode ser conciliada posteriormente.
- O código público do pedido é único dentro da janela operacional da loja e não permite acesso a dados privados.
- Tempos esperados do KDS e quantidade de itens concluídos na fila pública serão configuráveis por loja.

## Dependencies

- Cardápio, produtos ativos, fichas técnicas, ingredientes e preços da loja.
- Cadastro de instituições financeiras e conexão Mercado Pago por estabelecimento.
- Cadastro de usuários, perfis, permissões e seleção da loja ativa.
- Recebimento confiável de notificações e consulta posterior ao provedor para reconciliação.
- Definição operacional da loja para tempos esperados, meios aceitos, terminais habilitados e política de ajustes.

## Out of Scope

- Automação da maquininha PagBank no primeiro incremento.
- Gestão completa de mesas, reservas, garçons, setores e taxa de serviço.
- Emissão fiscal, SAT/NFC-e, integração com impressora e gaveta de dinheiro.
- Controle físico de abertura, sangria e fechamento de caixa.
- Pagamento on-line pelo navegador do cardápio público.
- Programa de fidelidade, cupons avançados e campanhas.
- Aplicativo móvel nativo.
- Garantia de funcionamento integral sem conexão; contingência manual será registrada, mas sincronização offline é uma evolução separada.
