# Feature Specification: Controle de Memória e Processamento em Segundo Plano

**Feature Branch**: `018-memory-optimization`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Reduzir o consumo de memória da aplicação web e API, revisar relatórios, exportações, imagens, notificações, polling e jobs como iFood e Mercado Pago, mantendo a operação adequada ao limite de 512 MB."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operação estável sob limite de memória (Priority: P1)

Como responsável pela operação, quero que web e API permaneçam disponíveis dentro do limite contratado de memória durante o uso normal e em picos previsíveis, para que vendas, pedidos, KDS e pagamentos não sejam interrompidos por reinícios ou encerramentos por falta de memória.

**Why this priority**: A indisponibilidade afeta diretamente captura de pedidos, produção e recebimento. As demais melhorias só geram valor se o fluxo operacional crítico permanecer disponível.

**Independent Test**: Pode ser validado executando a carga operacional representativa, incluindo navegação administrativa, POS, KDS, fila pública, integrações e relatórios, e confirmando os limites de memória e continuidade definidos nos critérios de sucesso.

**Acceptance Scenarios**:

1. **Given** uma instância web e uma instância de API com limite individual de 512 MB, **When** a carga operacional representativa é executada por 8 horas, **Then** nenhum processo é encerrado por falta de memória e os fluxos críticos continuam disponíveis.
2. **Given** a conclusão de uma operação pesada, **When** o sistema retorna ao tráfego normal, **Then** o consumo de memória se estabiliza sem crescimento contínuo entre ciclos equivalentes.
3. **Given** que o consumo se aproxima do limite operacional seguro, **When** uma nova tarefa pesada é solicitada, **Then** ela é enfileirada, limitada ou recusada de forma controlada sem derrubar a operação.

---

### User Story 2 - Jobs e integrações com carga controlada (Priority: P2)

Como operador, quero que sincronizações e reconciliações de iFood, Mercado Pago, pagamentos, webhooks, importações e exportações ocorram sem competir de forma descontrolada com o atendimento, para receber atualizações externas sem comprometer POS, KDS ou API.

**Why this priority**: Esses trabalhos são recorrentes, podem se acumular e atualmente compartilham recursos com as requisições da operação principal.

**Independent Test**: Pode ser validado acumulando integrações e tarefas pendentes, iniciando os processamentos simultaneamente e verificando limites de concorrência, ausência de duplicidade, retomada após falha e preservação dos fluxos críticos.

**Acceptance Scenarios**:

1. **Given** múltiplas integrações iFood elegíveis, **When** o ciclo de consulta é iniciado, **Then** elas são processadas em lotes limitados, sem sobreposição do mesmo trabalho e sem carregar toda a base elegível de uma vez.
2. **Given** duas ou mais instâncias da API, **When** o mesmo job programado vence, **Then** apenas uma execução efetiva processa cada unidade de trabalho.
3. **Given** importações pendentes durante uma reinicialização, **When** o serviço volta, **Then** os trabalhos são retomados com concorrência limitada, sem disparar todos simultaneamente.
4. **Given** uma exportação ou importação grande, **When** ela está em andamento, **Then** novas tarefas respeitam a capacidade configurada e recebem estado de espera observável.
5. **Given** falha ou reinício durante um processamento, **When** o sistema se recupera, **Then** o trabalho pode ser retomado com segurança sem duplicar efeitos já confirmados.

---

### User Story 3 - Atualizações periódicas eficientes (Priority: P2)

Como usuário administrativo, quero receber notificações, mudanças de pedidos, pagamentos e fila pública em tempo adequado sem que cada tela aberta gere consultas contínuas desnecessárias, para manter informações atuais com baixo consumo de recursos.

**Why this priority**: O polling frequente não demonstra retenção permanente no cliente, mas multiplica requisições, consultas e alocações transitórias por usuário e por aba.

**Independent Test**: Pode ser validado abrindo múltiplas abas, alternando entre visível e oculta e medindo a quantidade de atualizações e o tempo de propagação de uma mudança.

**Acceptance Scenarios**:

1. **Given** uma aba administrativa em segundo plano, **When** ela permanece oculta, **Then** atualizações não críticas reduzem ou suspendem sua frequência e retomam ao voltar ao primeiro plano.
2. **Given** várias telas abertas para o mesmo usuário, **When** não existem mudanças, **Then** o sistema evita transferir repetidamente listas completas e não permite requisições sobrepostas da mesma origem.
3. **Given** uma nova notificação operacional, **When** o usuário está ativo, **Then** o indicador é atualizado em até 30 segundos.
4. **Given** a tela de notificações aberta, **When** ocorre uma atualização periódica, **Then** somente dados novos ou alterados são transferidos, sempre que o mecanismo disponível permitir.
5. **Given** indisponibilidade temporária da API, **When** consultas periódicas falham repetidamente, **Then** a frequência é reduzida progressivamente e volta ao normal após recuperação.

---

### User Story 4 - Relatórios, exportações e imagens com volume limitado (Priority: P2)

Como administrador, quero consultar relatórios, exportar dados e atualizar imagens sem causar picos que interrompam a aplicação, recebendo orientação clara quando o volume solicitado exceder a capacidade segura.

**Why this priority**: Relatórios carregados integralmente, documentos montados em memória e imagens em base64 são os maiores picos identificados na auditoria.

**Independent Test**: Pode ser validado solicitando períodos grandes, exportações concorrentes e imagens acima do limite, confirmando processamento incremental, validação antecipada e continuidade da aplicação.

**Acceptance Scenarios**:

1. **Given** um relatório com milhares de pedidos e itens, **When** uma página é consultada, **Then** somente a página e os agregados necessários são carregados, sem materializar todo o histórico na aplicação.
2. **Given** uma exportação válida, **When** o arquivo é produzido, **Then** os registros são processados incrementalmente e o progresso pode ser acompanhado.
3. **Given** uma imagem acima do tamanho ou resolução permitidos, **When** o usuário tenta enviá-la, **Then** o envio é rejeitado antes do armazenamento com orientação para adequação.
4. **Given** um período de relatório acima do limite interativo, **When** o usuário solicita a consulta, **Then** o sistema orienta a usar processamento em segundo plano ou reduzir o período.

---

### User Story 5 - Diagnóstico operacional de memória e jobs (Priority: P2)

Como responsável técnico, quero identificar qual fluxo, job ou volume elevou o consumo, para agir antes de uma indisponibilidade e comprovar se uma melhoria resolveu o problema.

**Why this priority**: Sem séries temporais e correlação com trabalhos ativos, não é possível distinguir retenção, pico transitório e consumo nativo.

**Independent Test**: Pode ser validado provocando uma carga conhecida e confirmando que memória, concorrência, duração, volume e resultado podem ser correlacionados sem expor dados sensíveis.

**Acceptance Scenarios**:

1. **Given** um aumento relevante de memória, **When** o responsável consulta a observabilidade, **Then** consegue correlacioná-lo com requisições pesadas, jobs ativos, integrações, exportações ou uploads.
2. **Given** um job lento, falho, atrasado ou sobreposto, **When** ele ultrapassa os limites definidos, **Then** um sinal operacional identifica tipo, duração, volume e resultado.
3. **Given** dados de múltiplas lojas, **When** métricas e registros são consultados, **Then** nenhum segredo, conteúdo financeiro sensível ou payload bruto desnecessário é exposto.

### Edge Cases

- Muitas abas do mesmo usuário abertas, incluindo abas suspensas e posteriormente restauradas pelo navegador.
- Resposta periódica demora mais que o intervalo configurado e o próximo ciclo vence antes da conclusão.
- Uma instância é encerrada depois de reservar um job e antes de concluí-lo.
- Jobs curto e diário do mesmo provedor vencem ao mesmo tempo.
- O serviço inicia com centenas de importações ou eventos pendentes.
- Um tenant concentra volume muito maior que os demais e poderia monopolizar a capacidade.
- Provedor externo fica lento, limita requisições ou devolve payload excepcionalmente grande.
- Exportações do mesmo usuário são solicitadas repetidamente ou em formatos diferentes.
- Relatório atravessa período sem limite ou contém pedidos com grande quantidade de itens.
- Imagem pequena em disco expande excessivamente após decodificação, ou informa tipo diferente do conteúdo real.
- O armazenamento do arquivo fica indisponível após o job ter sido aceito.
- A aplicação opera com uma e com múltiplas instâncias, sem alterar a garantia de execução única.

## Scope Boundaries

### MVP de estabilização

- Medir separadamente web e API durante carga representativa e estabelecer baseline reproduzível.
- Aplicar orçamento, histerese e admissão de memória sem bloquear POS, pedidos, KDS e pagamentos.
- Reduzir limites globais perigosos e oferecer configuração segura de runtime/deploy.
- Entregar evidência de cinco ciclos sem crescimento contínuo antes de migrar jobs.

### Incrementos pós-MVP desta feature

- Fila durável e migração gradual dos jobs existentes.
- Polling adaptativo em notificações e telas operacionais.
- Agregação/paginação de relatórios, exportação por streaming e object storage.
- Diagnóstico consolidado, inventário operacional e soak de oito horas.

### Fora de escopo

- Separar domínios de negócio em microserviços.
- Introduzir Redis ou broker externo obrigatório.
- Criar uma plataforma genérica de workflows para trabalhos não inventariados.
- Substituir Socket.io como mecanismo primário do KDS.
- Alterar regras financeiras, de pedidos ou integrações além do necessário para limitar e retomar o processamento existente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter os fluxos críticos de login, POS, pedidos, KDS, fila pública e pagamentos disponíveis enquanto trabalhos não críticos aguardam capacidade.
- **FR-002**: O sistema MUST definir e aplicar um orçamento operacional de memória separado para web, API e processamento em segundo plano, mantendo margem abaixo do limite de 512 MB de cada instância.
- **FR-003**: O sistema MUST coletar memória residente, memória de objetos ativos, memória externa e buffers em intervalos regulares e nos limites de início e fim de trabalhos pesados.
- **FR-004**: O sistema MUST registrar para cada trabalho seu tipo, identificador, tenant quando aplicável, instante de espera, início, término, duração, volume processado, tentativas e resultado.
- **FR-005**: O sistema MUST entrar em atenção após duas amostras consecutivas acima de 400 MB, em alta pressão após duas amostras consecutivas acima de 440 MB, emitir alerta estruturado ao coletor operacional e MUST reduzir a admissão de trabalhos não críticos até duas amostras consecutivas abaixo do limite de recuperação.
- **FR-006**: Consultas interativas paginadas MUST carregar apenas a página solicitada; agregados MUST ser calculados sem materializar toda a coleção na memória da aplicação.
- **FR-007**: Relatórios interativos MUST possuir limites explícitos de período e volume, com encaminhamento para processamento em segundo plano quando excedidos.
- **FR-008**: Exportações MUST ler e produzir dados incrementalmente, MUST ter concorrência global limitada e MUST impedir duplicação acidental de solicitações equivalentes ainda ativas.
- **FR-009**: Arquivos de exportação MUST permanecer recuperáveis após reinício do processo que aceitou o trabalho por sete dias por padrão, com retenção configurável por ambiente.
- **FR-010**: Uploads de imagem MUST validar tamanho, tipo real, dimensões e resolução antes de persistir ou encaminhar o conteúdo completo entre serviços.
- **FR-011**: Ativos de imagem e arquivos exportados MUST ser entregues sem exigir sua materialização completa simultânea nos processos de navegação e API.
- **FR-012**: Atualizações periódicas no cliente MUST impedir requisições sobrepostas, reduzir frequência quando a aba estiver oculta e aplicar espera progressiva com variação após falhas.
- **FR-013**: O indicador de notificações MUST consultar somente o mínimo necessário para apresentar a contagem e MUST evitar buscar a lista de notificações a cada atualização.
- **FR-014**: A tela de notificações MUST atualizar incrementalmente ou em frequência adaptativa e MUST conservar no máximo o limite documentado de itens ativos no cliente.
- **FR-015**: O sistema MUST aplicar política equivalente de atualização adaptativa ao KDS, acompanhamento de pagamento, fila pública e demais telas com polling, respeitando a urgência distinta de cada fluxo.
- **FR-016**: Todo job programado MUST impedir sobreposição local e distribuída da mesma unidade de trabalho.
- **FR-017**: Jobs que percorrem tenants, integrações, cobranças, eventos ou importações MUST buscar unidades em lotes limitados e aplicar concorrência máxima configurável.
- **FR-018**: O polling iFood MUST preservar a ordem e a confirmação segura dos eventos, sem carregar todas as integrações elegíveis de uma vez e sem permitir que uma loja monopolize ciclos sucessivos.
- **FR-019**: A reconciliação Mercado Pago de vendas e a renovação de credenciais MUST limitar a quantidade de conexões simultâneas e impedir coincidência descontrolada entre ciclos curto e diário.
- **FR-020**: A reconciliação de cobranças Point MUST continuar limitada por lote e MUST possuir exclusão distribuída quando houver mais de uma instância.
- **FR-021**: Importações de vendas pendentes ou recuperadas no startup MUST entrar em uma fila limitada, em vez de iniciar todas simultaneamente no processo HTTP.
- **FR-022**: Processamento de webhooks MUST confirmar recebimento rapidamente, persistir o trabalho e retomá-lo após falha ou reinício, sem depender de tarefas voláteis no processo HTTP.
- **FR-023**: Rotinas de retenção MUST remover dados em lotes quando o volume puder causar transação longa ou pico de recursos.
- **FR-024**: O sistema MUST fornecer estados de espera, execução, conclusão, falha e cancelamento para trabalhos duráveis e MUST recuperar trabalhos abandonados com segurança.
- **FR-025**: Os limites de lote, concorrência, frequência e períodos interativos MUST ser configuráveis por ambiente, com valores padrão seguros.
- **FR-026**: A implantação MUST permitir desabilitar categorias de jobs em processos de atendimento e executá-las em uma função de processamento separada, sem exigir divisão dos domínios de negócio em serviços independentes.
- **FR-027**: A documentação operacional MUST inventariar todos os jobs e pollings, indicando frequência, dono, exclusão, lote, concorrência, política de falha, retomada e impacto esperado de memória.
- **FR-028**: O sistema MUST testar crescimento de memória em ciclos repetidos, diferenciando consumo estável, pico recuperável e retenção contínua.
- **FR-029**: Logs e métricas MUST excluir credenciais, tokens, dados de cartão e payloads brutos desnecessários.
- **FR-030**: A liberação desta feature MUST incluir comparação antes/depois para os cenários representativos e uma estratégia de reversão dos controles de execução.

### Key Entities

- **Background Work Item**: Unidade durável de processamento, contendo tipo, escopo, prioridade, estado, tentativas, reserva, progresso e resultado.
- **Work Execution Lease**: Reserva temporária que garante execução única e permite retomada após abandono.
- **Resource Policy**: Limites operacionais por categoria de trabalho, incluindo lote, concorrência, frequência, período e orçamento de memória.
- **Resource Measurement**: Amostra temporal de consumo e carga, correlacionada com processo, rota ou trabalho ativo.
- **Polling Subscription**: Atualização periódica de uma tela, com finalidade, urgência, visibilidade, última alteração, falhas e próximo instante permitido.
- **Generated Asset**: Arquivo produzido por exportação, com localização durável, tamanho, retenção e vínculo com o trabalho que o gerou.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em teste contínuo de 8 horas com a carga representativa do piloto, web e API apresentam individualmente memória residente no percentil 95 de até 400 MB e pico de até 460 MB, sem ultrapassar 512 MB.
- **SC-002**: Após cinco ciclos equivalentes de carga e um período de estabilização de 15 minutos, a memória de objetos ativos não cresce mais de 10% entre o primeiro e o quinto ciclo.
- **SC-003**: Nenhum cenário representativo causa encerramento por falta de memória, reinício involuntário ou indisponibilidade dos fluxos de POS, pedidos, KDS e pagamentos.
- **SC-004**: Consultar qualquer página de relatório transfere para a aplicação no máximo a página solicitada e dados agregados, independentemente do total histórico do período.
- **SC-005**: Duas exportações máximas configuradas podem ser solicitadas concorrentemente sem que mais de uma por processo seja executada ao mesmo tempo e sem ultrapassar o orçamento seguro de memória.
- **SC-006**: Com 20 usuários mantendo duas abas administrativas por 8 horas, as atualizações periódicas não produzem requisições sobrepostas e reduzem em pelo menos 70% as consultas quando as abas ficam ocultas.
- **SC-007**: Novas notificações ficam visíveis para usuários ativos em até 30 segundos em 95% dos casos, sem consulta completa da lista pelo indicador global.
- **SC-008**: Todos os jobs inventariados possuem limite de lote, limite de concorrência, proteção de execução única e comportamento de retomada comprovados por teste.
- **SC-009**: Ao iniciar com 100 trabalhos recuperáveis, o sistema respeita a concorrência configurada e mantém os fluxos críticos respondendo durante toda a recuperação.
- **SC-010**: Uma falha durante qualquer job durável não perde o trabalho nem duplica efeitos já confirmados, e a retomada ocorre em até 5 minutos após a recuperação do serviço.
- **SC-011**: O responsável técnico consegue identificar em até 10 minutos o tipo de carga associado a qualquer alerta de memória usando as medições e registros disponíveis.
- **SC-012**: Uploads acima do limite são rejeitados antes do armazenamento e nenhum arquivo aceito provoca pico acima do orçamento de memória.

## Assumptions

- O limite de 512 MB é aplicado individualmente ao serviço web e ao serviço de API; processos separados de background terão limite próprio definido na implantação.
- A carga representativa inicial considera dezenas de lojas, até 20 operadores simultâneos por loja, até 10 terminais por loja e 500 pedidos por dia por loja, conforme o planejamento vigente.
- POS, pedidos, KDS, pagamentos e recebimento de eventos externos têm prioridade sobre relatórios, exportações, retenção e reconciliações históricas.
- Atualização de até 30 segundos é aceitável para notificações administrativas; KDS, pagamentos e eventos de pedido mantêm metas mais restritas já definidas por seus fluxos.
- A solução preservará o monólito modular e poderá separar somente o processo de trabalhos em segundo plano.
- O inventário inicial inclui polling de notificações, sessão administrativa, fila pública, KDS, acompanhamento de cobrança, iFood, reconciliações e renovação Mercado Pago, reconciliação Point, importações de vendas, retenção, webhooks e exportações.
- Os limites iniciais serão conservadores e poderão ser ajustados por ambiente após medição, sem remover as proteções de concorrência e execução única.
- Arquivos e imagens existentes continuarão acessíveis durante uma migração gradual para armazenamento apropriado.
