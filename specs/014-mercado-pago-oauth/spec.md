# Feature Specification: Conexão Mercado Pago Multiempresa

**Feature Branch**: `014-mercado-pago-oauth`

**Created**: 2026-07-18

**Status**: Draft

**Input**: Evoluir a integração de vendas do RRF5 OS para conectar estabelecimentos ao Mercado Pago por OAuth, consultar e importar vendas por período, renovar credenciais, receber webhooks e reconciliar alterações, preservando uma arquitetura extensível para outros providers.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conectar a conta Mercado Pago do estabelecimento (Priority: P1)

Um administrador do estabelecimento escolhe entre o fluxo OAuth recomendado e um Access Token fixo para testes ou operação provisória. No modo OAuth, ele autoriza a aplicação central na página do Mercado Pago. No modo fixo, informa o token uma única vez em um campo protegido. Em ambos os casos, a conta fica vinculada ao estabelecimento correto e o token deixa de ser visível após o envio.

**Why this priority**: A autorização individual e isolada por estabelecimento é a base de todas as consultas e elimina o compartilhamento manual de credenciais produtivas.

**Independent Test**: Pode ser testada conectando uma conta por OAuth e outra por Access Token fixo, confirmando o modo, status e identificador da conta somente para seus administradores e verificando que nenhum token pode ser recuperado pela interface ou API administrativa.

**Acceptance Scenarios**:

1. **Given** um administrador e um estabelecimento sem conexão, **When** ele escolhe a carga inicial de 30, 60 ou 90 dias e conclui a autorização no Mercado Pago, **Then** a conexão fica associada ao estabelecimento, com status `CONNECTED`, conta autorizadora e validade registradas, e a carga escolhida é iniciada após a persistência íntegra da conexão.
2. **Given** um usuário sem permissão administrativa, **When** ele tenta iniciar, reconectar ou desconectar a integração, **Then** o acesso é negado sem criar ou alterar uma conexão.
3. **Given** um retorno com estado ausente, expirado, já utilizado ou diferente do emitido, **When** o callback é recebido, **Then** a autorização é rejeitada e nenhum token é armazenado.
4. **Given** a mesma conta Mercado Pago já conectada a outro estabelecimento no mesmo ambiente, **When** uma nova autorização é concluída, **Then** o sistema impede a associação ambígua e orienta a resolver a conexão existente.
5. **Given** uma autorização cancelada ou que falhou, **When** o usuário retorna ao RRF5 OS, **Then** a conexão anterior permanece íntegra e uma mensagem segura informa que a conexão não foi concluída.
6. **Given** um administrador que selecionou Access Token fixo, **When** ele informa um token válido e confirma a conexão, **Then** o sistema valida a credencial, identifica a conta autorizadora, armazena o token protegido e exibe a conexão como `CONNECTED` no modo `FIXED_TOKEN`.
7. **Given** um token fixo inválido ou sem permissões mínimas, **When** o administrador tenta salvá-lo, **Then** a conexão não é ativada, o token não volta na resposta e uma mensagem segura informa a falha de validação.
8. **Given** uma conexão existente, **When** o administrador troca de OAuth para Access Token fixo ou no sentido inverso, **Then** o modo anterior continua válido até o novo modo ser confirmado e, depois disso, suas credenciais deixam de ser utilizadas.

---

### User Story 2 - Consultar e importar vendas por período (Priority: P1)

Um administrador escolhe um período permitido, consulta as vendas da conta conectada e utiliza o fluxo existente de prévia e importação para criar pedidos, mantendo idempotência mesmo quando a consulta é repetida.

**Why this priority**: É o valor operacional central da integração e reaproveita o comportamento já conhecido da importação PagBank.

**Independent Test**: Pode ser testada sincronizando um período com pagamentos conhecidos, revisando a prévia, importando-os e repetindo a mesma sincronização sem duplicar pedidos ou identidades externas.

**Acceptance Scenarios**:

1. **Given** uma conexão válida, **When** o administrador consulta um período de até 90 dias dentro da janela disponível no provider, **Then** todas as páginas são coletadas e uma execução de importação apresenta vendas elegíveis, ignoradas e inconsistentes.
2. **Given** uma venda aprovada ainda não importada, **When** o administrador confirma a importação, **Then** um pedido é criado com origem Mercado Pago e identidade externa durável vinculada ao estabelecimento.
3. **Given** uma venda já importada ou repetida em outra execução, **When** o período é sincronizado novamente, **Then** nenhum pedido duplicado é criado.
4. **Given** pagamentos cancelados, recusados, estornados ou contestados, **When** são coletados, **Then** seus estados são preservados para auditoria e reconciliação, mas não são convertidos automaticamente em novas vendas aprovadas.
5. **Given** indisponibilidade parcial ou limite de requisições do provider, **When** uma página falha, **Then** a execução registra o erro e pode ser retomada com segurança sem duplicar dados já persistidos.

---

### User Story 3 - Manter a autorização ativa com segurança (Priority: P1)

O RRF5 OS renova credenciais próximas do vencimento e permite reconexão quando a autorização deixa de ser válida, sem intervenção rotineira do estabelecimento.

**Why this priority**: Uma integração SaaS precisa continuar funcionando após o vencimento do token e não pode perder um novo `refresh_token` emitido durante a renovação.

**Independent Test**: Pode ser testada com uma conexão artificialmente próxima do vencimento, verificando uma única renovação, troca atômica das credenciais e recuperação controlada de uma resposta não autorizada.

**Acceptance Scenarios**:

1. **Given** uma conexão cujo token vence dentro da janela de renovação, **When** a rotina diária a processa, **Then** somente uma instância realiza a renovação e os novos tokens e validade são substituídos atomicamente.
2. **Given** uma chamada que recebe resposta não autorizada, **When** a renovação é possível, **Then** o sistema renova uma vez e repete a chamada original uma vez.
3. **Given** renovação inválida ou a segunda chamada não autorizada, **When** a recuperação falha, **Then** a conexão fica `REAUTHORIZATION_REQUIRED`, as sincronizações cessam e o estabelecimento visualiza a ação de reconectar.
4. **Given** uma desconexão solicitada, **When** ela é confirmada, **Then** as credenciais deixam de ser utilizáveis, sincronizações são interrompidas e o histórico financeiro permanece auditável.

---

### User Story 4 - Receber atualizações e reconciliar vendas (Priority: P2)

O sistema recebe notificações de múltiplas contas em uma URL comum, identifica a conexão correta e consulta o recurso oficial antes de atualizar o estado local. Rotinas periódicas recuperam notificações perdidas.

**Why this priority**: Webhooks reduzem a defasagem, enquanto a reconciliação evita depender de uma entrega de notificação perfeita.

**Independent Test**: Pode ser testada enviando notificações válidas, inválidas e duplicadas para duas contas e confirmando isolamento, idempotência, nova consulta ao provider e recuperação posterior por reconciliação.

**Acceptance Scenarios**:

1. **Given** uma notificação com assinatura válida e conta reconhecida, **When** ela é recebida, **Then** é aceita rapidamente para processamento assíncrono e o recurso correspondente é consultado com a credencial daquela conexão.
2. **Given** assinatura inválida, conta desconhecida ou formato não suportado, **When** a notificação é recebida, **Then** nenhum dado financeiro é alterado e a ocorrência é registrada sem conteúdo sensível.
3. **Given** notificações duplicadas ou fora de ordem, **When** são processadas, **Then** o estado canônico mais recente é preservado sem duplicação.
4. **Given** uma notificação perdida, **When** a reconciliação de curto ou longo alcance executa, **Then** a alteração aparece no histórico local.
5. **Given** contas de dois estabelecimentos, **When** notificações são recebidas em paralelo, **Then** cada recurso é consultado e persistido exclusivamente no estabelecimento correspondente.

---

### User Story 5 - Acompanhar a saúde da integração (Priority: P2)

Administradores visualizam status, conta conectada, validade, última sincronização e último erro seguro, podendo sincronizar, reconectar ou desconectar conforme o estado.

**Why this priority**: Visibilidade reduz suporte e permite que o lojista recupere falhas sem acesso a segredos ou intervenção técnica.

**Independent Test**: Pode ser testada simulando cada estado da conexão e verificando as informações e ações adequadas, sem qualquer token nas respostas administrativas.

**Acceptance Scenarios**:

1. **Given** uma conexão em qualquer estado suportado, **When** o administrador abre a integração, **Then** vê somente metadados seguros e ações compatíveis com aquele estado.
2. **Given** conexão, renovação, sincronização, falha ou desconexão, **When** o evento ocorre, **Then** uma trilha de auditoria identifica estabelecimento, ação, resultado, origem e horário, sem armazenar tokens em claro.

### Edge Cases

- O callback chega após 10 minutos, é repetido ou ocorre simultaneamente em duas abas.
- O estabelecimento inicia nova conexão enquanto já existe uma autorização válida ou pendente.
- Um administrador fecha a tela, atualiza o navegador ou consulta novamente a integração após enviar um Access Token fixo; o valor informado não pode ser recuperado nem reapresentado.
- O token fixo pertence a uma conta diferente da que já está conectada ou perde permissões sem possuir mecanismo de renovação.
- A troca entre OAuth e Access Token fixo falha durante a validação da nova credencial.
- A resposta OAuth não contém `refresh_token`, `offline_access`, identificador da conta ou validade esperada.
- Uma renovação devolve um novo `refresh_token` e a persistência falha entre a troca remota e a confirmação local.
- Duas instâncias tentam renovar ou sincronizar a mesma conexão simultaneamente.
- O provider pagina resultados que mudam durante a consulta, aplica limite de requisições ou retorna páginas parcialmente sobrepostas.
- O período solicitado ultrapassa 90 dias na carga inicial ou a retenção máxima de 12 meses informada pela busca de pagamentos.
- Uma notificação não contém identificador de conta suficiente, referencia um recurso removido ou chega antes de a conexão ser persistida.
- O Mercado Pago invalida credenciais por revogação, alteração de senha, segurança ou remoção da aplicação.
- Uma venda muda de aprovada para cancelada, estornada ou contestada depois de já ter originado um pedido.
- A conta autorizada possui vendas Point, mas elas são expostas por recurso ou tópico diferente da busca comum de pagamentos.
- Um usuário perde acesso ao estabelecimento após iniciar o OAuth e antes do callback.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST tratar o `tenant` existente como o estabelecimento proprietário da conexão e MUST autorizar todas as ações pela associação do usuário com esse tenant.
- **FR-002**: O sistema MUST oferecer dois modos de credencial por conexão: `OAUTH`, recomendado para produção, e `FIXED_TOKEN`, destinado a testes ou operação provisória; o modo escolhido MUST ser explícito na tela e persistido na conexão.
- **FR-003**: O catálogo comum de providers MUST incluir Mercado Pago sem acoplar o domínio de vendas a esse provider e MUST continuar permitindo futuras instituições com mecanismos de comunicação distintos.
- **FR-004**: A abstração de coleta MUST suportar consultas paginadas por intervalo, além do comportamento diário já usado por providers existentes, sem obrigar todos os providers ao mesmo mecanismo de transporte ou paginação.
- **FR-005**: Somente administradores do estabelecimento MUST poder iniciar, escolher ou trocar o modo de credencial, cadastrar ou substituir um Access Token fixo, reconectar, sincronizar manualmente ou desconectar uma conexão.
- **FR-006**: Ao iniciar OAuth, o sistema MUST gerar um `state` criptograficamente aleatório, opaco, de uso único e com expiração máxima de 10 minutos, associado internamente ao estabelecimento, solicitante e ambiente.
- **FR-007**: O sistema MUST usar PKCE com desafio `S256`, preservar o verificador de maneira confidencial até o callback e MUST usar uma URL de redirecionamento fixa e previamente cadastrada para cada ambiente.
- **FR-008**: O callback MUST validar existência, expiração, uso único e contexto do `state`; o ID do estabelecimento não MUST ser usado sozinho como `state` nem aceito como origem de autoridade.
- **FR-009**: Antes de iniciar o OAuth, a tela MUST permitir selecionar carga inicial de 30, 60 ou 90 dias, usando 30 dias como padrão. O callback MUST trocar o código uma única vez, associar a conta autorizadora ao estabelecimento, invalidar o estado e disparar a carga escolhida somente depois da persistência íntegra da conexão.
- **FR-010**: Se o solicitante perder acesso administrativo antes do callback, o sistema MUST rejeitar a conclusão e descartar com segurança o estado pendente.
- **FR-011**: Cada conexão MUST registrar provider, estabelecimento, ambiente, identificador da conta autorizadora, escopos, estado, datas de conexão/validade/sincronização, erro operacional seguro e desconexão.
- **FR-012**: O sistema MUST impedir que a mesma conta autorizadora seja conectada simultaneamente a mais de um estabelecimento no mesmo provider e ambiente, mantendo uma conexão por estabelecimento, provider e ambiente.
- **FR-013**: Tokens de acesso, renovação e verificadores PKCE MUST ser criptografados em repouso, descriptografados somente no backend no momento de uso e inacessíveis ao frontend, logs, auditoria e APIs administrativas.
- **FR-014**: O segredo da aplicação central MUST permanecer em configuração segura por ambiente e separado das credenciais de cada estabelecimento.
- **FR-015**: Respostas administrativas MUST limitar-se a provider, estado, conta autorizadora, validade, última sincronização e erro seguro, sem token, segredo ou material criptográfico.
- **FR-015A**: No modo `FIXED_TOKEN`, a tela MUST apresentar um campo de entrada protegido e de escrita única; após o envio, o valor não MUST ser recuperável, mascarado com fragmentos reais, preenchido automaticamente ou devolvido por qualquer resposta administrativa.
- **FR-015B**: Antes de ativar um Access Token fixo, o sistema MUST validá-lo diretamente com o provider, confirmar permissões mínimas para consulta de vendas e obter a identidade da conta autorizadora sem confiar em um identificador informado pelo usuário.
- **FR-015C**: A tela MUST informar que `FIXED_TOKEN` não possui renovação automática, é menos indicado para operação SaaS e exigirá substituição manual quando expirar, for revogado ou perder permissões.
- **FR-015D**: Uma conexão MUST possuir somente um modo ativo por vez. A troca de modo MUST validar e persistir a nova credencial antes de desativar a anterior, evitando interrupção causada por uma tentativa inválida.
- **FR-016**: O sistema MUST suportar os estados `PENDING_AUTHORIZATION`, `CONNECTED`, `TOKEN_EXPIRING`, `REFRESHING`, `REAUTHORIZATION_REQUIRED`, `DISCONNECTED` e `ERROR`, com transições auditáveis e ações compatíveis.
- **FR-017**: Uma rotina diária MUST selecionar conexões OAuth que vencem dentro de 15 dias e renovar suas credenciais com exclusão mútua por conexão; conexões `FIXED_TOKEN` MUST ser excluídas da renovação automática.
- **FR-018**: A renovação MUST persistir o novo token de acesso, o possível novo token de renovação e a nova validade atomicamente; uma falha não MUST deixar uma combinação parcial como credencial ativa.
- **FR-019**: Diante de uma resposta não autorizada em modo OAuth, o sistema MUST tentar no máximo uma renovação e uma repetição da chamada; nova falha MUST resultar em `REAUTHORIZATION_REQUIRED` sem loop. Em modo `FIXED_TOKEN`, o sistema MUST interromper a chamada e solicitar substituição manual, sem tentativa de renovação.
- **FR-020**: O estabelecimento MUST poder selecionar carga inicial de 30, 60 ou 90 dias, limitada à janela máxima disponibilizada pelo provider, e posteriormente consultar períodos específicos permitidos.
- **FR-021**: A coleta MUST percorrer todas as páginas do período, respeitar limites do provider, aplicar retomada segura e registrar contagens de itens consultados, elegíveis, ignorados, inconsistentes e falhos.
- **FR-022**: Pagamentos MUST ser normalizados para o modelo comum de movimentos externos e alimentar a prévia/importação existente; a solução não MUST criar um segundo fluxo de pedidos exclusivo do Mercado Pago.
- **FR-023**: Cada pagamento MUST preservar conexão, estabelecimento, provider, ID externo, referência externa, estados, método, valores bruto/taxas/líquido, datas do provider, instante de sincronização e payload bruto protegido conforme a política de retenção.
- **FR-024**: A identidade durável MUST combinar ao menos estabelecimento, provider e ID externo, com vínculo à conexão, impedindo duplicação entre execuções sem causar colisão entre contas.
- **FR-025**: Somente pagamentos elegíveis conforme a política de vendas aprovada MUST originar novos pedidos; recusas, cancelamentos, estornos e contestações MUST permanecer disponíveis para auditoria e reconciliação.
- **FR-026**: Alterações posteriores de uma venda já importada MUST atualizar seu estado de reconciliação e gerar alerta auditável; esta entrega não MUST cancelar, estornar ou alterar automaticamente o pedido sem uma política financeira específica aprovada.
- **FR-027**: O sistema MUST expor uma URL comum de webhook por ambiente e MUST validar autenticidade, integridade e atualidade da assinatura conforme as regras vigentes do Mercado Pago antes de enfileirar processamento.
- **FR-028**: A notificação MUST ser tratada apenas como aviso; o sistema MUST localizar a conexão pela conta autorizadora e consultar o recurso canônico com a credencial daquela conexão antes de alterar dados financeiros.
- **FR-029**: Eventos de webhook MUST ser idempotentes, isolados por conexão, processados assincronamente e tolerantes a duplicação e entrega fora de ordem.
- **FR-030**: Reconciliações configuráveis MUST executar, por padrão, a cada 15 minutos para as últimas 24 horas e diariamente para os últimos 7 dias, sem impedir sincronização manual autorizada.
- **FR-031**: Conexão, callback, renovação, reconexão, desconexão, sincronização e erros MUST produzir auditoria sem segredos, incluindo estabelecimento, ator ou rotina, ação, resultado e horário.
- **FR-032**: Logs e mensagens de erro MUST aplicar redação de cabeçalhos, tokens, códigos OAuth, verificadores, assinaturas e payloads sensíveis.
- **FR-033**: Desconectar MUST impedir novas chamadas e rotinas da conexão, invalidar ou tornar inutilizáveis suas credenciais locais e preservar histórico, pedidos e auditoria.
- **FR-034**: O lançamento comercial de vendas presenciais MUST permanecer bloqueado até a conclusão bem-sucedida da prova de conceito com uma segunda conta Mercado Pago real, incluindo autorização `offline_access`, busca, venda Point, webhook, estorno e renovação controlada.
- **FR-035**: A prova de conceito MUST identificar se vendas Point são representadas como pagamentos, pedidos ou ambos e a implementação MUST habilitar apenas os recursos e tópicos oficialmente confirmados no teste.
- **FR-036**: A primeira versão MUST oferecer produção com isolamento por ambiente; credenciais, callbacks, webhooks, conexões e identidades externas de ambientes distintos não MUST se misturar.

### Key Entities _(include if feature involves data)_

- **Sales Integration**: Conexão comum de vendas pertencente a um estabelecimento; identifica provider, canal, ambiente, conta externa, estado e saúde operacional. Evolui a entidade existente em vez de criar um domínio paralelo.
- **OAuth Authorization Attempt**: Estado temporário e descartável de uma tentativa de autorização; associa valor opaco, estabelecimento, solicitante, ambiente, verificador protegido, expiração e consumo.
- **Integration Credential**: Conjunto versionado e criptografado de credenciais da conexão, com modo OAuth ou token fixo, acesso, eventual renovação e validade; nunca é exposto por interfaces administrativas.
- **Sales Import Run**: Execução existente de consulta, prévia, importação ou reconciliação, acrescida da origem do disparo e do intervalo/paginação utilizados.
- **External Sales Movement**: Representação normalizada existente de um pagamento ou alteração financeira coletada, vinculada à conexão e ao estabelecimento.
- **External Sale Identity**: Chave durável que impede que o mesmo pagamento do mesmo estabelecimento e provider origine mais de um pedido.
- **Provider Notification**: Registro idempotente e protegido de uma notificação recebida, sua validação, conexão resolvida, recurso referenciado e resultado de processamento.
- **Integration Audit Event**: Evento sem segredos para conexão, renovação, sincronização, reconciliação, falha e desconexão.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em teste de aceite, 100% das autorizações válidas são associadas ao estabelecimento correto e 100% dos estados expirados, reutilizados ou adulterados são rejeitados sem armazenar credenciais.
- **SC-002**: Nenhum token, segredo, código OAuth ou verificador aparece em respostas de frontend, logs ou eventos de auditoria durante testes automatizados e inspeção operacional.
- **SC-002A**: Em testes de aceite, 100% dos Access Tokens fixos válidos ativam somente a conta identificada pelo provider, enquanto tokens inválidos ou insuficientes ativam zero conexões e nunca são reapresentados ao usuário.
- **SC-003**: Uma carga de 90 dias importa 100% dos pagamentos elegíveis retornados pelo provider e uma repetição completa cria zero pedidos duplicados.
- **SC-004**: Renovações concorrentes resultam em no máximo uma solicitação efetiva por conexão, e 100% das renovações bem-sucedidas preservam o par mais recente de credenciais.
- **SC-005**: Pelo menos 99% das notificações válidas são aceitas para processamento em até 2 segundos, sem aguardar a consulta completa do recurso.
- **SC-006**: Alterações notificadas aparecem no histórico local em até 5 minutos em operação normal; notificações perdidas são recuperadas em até 15 minutos para a janela recente ou em até 24 horas para a janela de sete dias.
- **SC-007**: Testes com dois estabelecimentos conectados demonstram zero leitura, escrita, webhook ou uso de credencial cruzado entre tenants.
- **SC-008**: O administrador identifica estado, conta, validade e última sincronização em uma única tela e consegue iniciar a ação de recuperação sem suporte técnico.
- **SC-009**: A prova de conceito real confirma consulta de uma venda Point, recebimento e validação de sua notificação, atualização após estorno e renovação controlada antes da liberação comercial.
- **SC-010**: A inclusão de um provider futuro que use paginação ou transporte diferente não exige alterar regras de criação de pedidos, identidade externa ou isolamento por estabelecimento.

## Assumptions

- O `tenant` do modelo atual representa o estabelecimento citado nos requisitos; a nomenclatura pública pode usar “estabelecimento” sem renomear imediatamente todas as entidades internas.
- O fluxo existente de integração PagBank, prévia, importação, movimentos e identidade externa será evoluído e reutilizado.
- OAuth continuará sendo o modo recomendado e padrão visual; Access Token fixo será uma alternativa explícita para facilitar testes e cenários provisórios, sem promessa de renovação automática.
- O período padrão da primeira carga será escolhido entre 30, 60 e 90 dias; consultas históricas respeitarão o limite de 12 meses atualmente informado pela busca do Mercado Pago.
- A URL pública fixa de callback e a URL de webhook serão configuradas por ambiente quando os domínios definitivos do RRF5 OS estiverem disponíveis.
- Os caminhos públicos canônicos serão `/api/integrations/mercadopago/callback` e `/api/webhooks/mercadopago`; a URL absoluta dependerá do domínio de cada ambiente e deverá coincidir exatamente com a configuração do Mercado Pago.
- A duração real do token será calculada pela resposta `expires_in`; 180 dias e a janela de renovação de 15 dias são referências operacionais, não datas fixas codificadas.
- O payload bruto será protegido por controle de acesso e seguirá a política de retenção do produto; dados de cartão completos, tokens e segredos não serão armazenados nele.
- Atualizar automaticamente pedidos após cancelamento, estorno ou contestação está fora desta primeira entrega até existir política financeira e operacional explícita; o evento será conciliado e sinalizado.
- A documentação pública confirma a busca geral de pagamentos, mas a cobertura integral de vendas presenciais Point será tratada como risco de integração e validada pela prova de conceito obrigatória.
- Filas, agendadores e mecanismos de exclusão mútua serão definidos no plano técnico sem alterar os comportamentos desta especificação.

## Dependencies and Rollout Gates

- Aplicação central Mercado Pago do RRF5 OS criada e aprovada, com OAuth, `offline_access`, redirect URI e webhooks configurados para cada ambiente.
- Segredos da aplicação e chave de criptografia disponíveis no backend por ambiente.
- Conta Mercado Pago real secundária e autorização para executar venda e estorno de pequeno valor no teste Point.
- Confirmação, durante a prova de conceito, dos tópicos de webhook e recursos canônicos aplicáveis às vendas Point antes de habilitá-los em produção.
- Observabilidade e execução assíncrona disponíveis para renovação, webhooks e reconciliação.

## Delivery Slices

1. Evoluir a conexão comum por estabelecimento e estados operacionais.
2. Implementar seleção entre OAuth e Access Token fixo, com validação, armazenamento protegido, troca segura de modo e reconexão.
3. Implementar renovação atômica, bloqueio concorrente e recuperação controlada de autorização.
4. Implementar consulta paginada por período no pipeline existente de prévia e importação.
5. Implementar webhook, reconciliação, painel operacional e gate da prova de conceito Point.

## Platform-managed OAuth configuration

- A aplicação Mercado Pago continua única e pertencente ao RRF5 OS; credenciais OAuth não pertencem aos estabelecimentos.
- Um `SUPER_ADMIN` pode cadastrar e substituir Client ID, Client Secret, Webhook Secret, callback e URL pós-callback sem deploy ou reinício.
- Client Secret e Webhook Secret são write-only, cifrados no banco e nunca retornados pela API ou interface.
- A configuração persistida tem precedência sobre variáveis de ambiente; variáveis permanecem como fallback de bootstrap.
- Administradores de loja apenas autorizam a conta, sincronizam e desconectam; não recebem acesso aos segredos da aplicação central.
