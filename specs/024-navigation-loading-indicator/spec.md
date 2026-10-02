# Feature Specification: Indicador de Carregamento na Navegação

**Feature Branch**: `024-navigation-loading-indicator`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Um dos pontos que preciso melhorar é a questão de o usuário não saber se algo está sendo processado, por exemplo quando clico em um link de menu para abrir uma tela e esta tela é demorada para abrir, visualmente o usuário não sabe se está processando. Poderia ter um indicativo, como uma barra de carregamento ou algo que indique que está sendo processado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber que a navegação está em andamento (Priority: P1)

Como usuário do painel administrativo, ao clicar em um item de menu ou em qualquer link que leve a outra tela, eu quero ver algum sinal visual imediato de que o sistema está processando a troca de tela, para não achar que o clique não funcionou (e evitar clicar de novo ou ficar em dúvida se o sistema travou).

**Why this priority**: É o problema relatado diretamente — hoje a tela fica sem nenhuma resposta visual entre o clique e o conteúdo aparecer, o que é a causa raiz da sensação de "não sei se está processando".

**Independent Test**: Acessar uma tela cujo carregamento leve mais de um segundo (ex.: um relatório com bastante dado) e confirmar que, entre o clique no menu e o conteúdo aparecer, existe uma indicação visual contínua de carregamento.

**Acceptance Scenarios**:

1. **Given** o usuário está em qualquer tela do painel, **When** ele clica em um item do menu lateral que leva a outra tela, **Then** um indicador visual de carregamento aparece imediatamente após o clique, antes mesmo dos dados da nova tela chegarem.
2. **Given** o indicador de carregamento está visível, **When** o conteúdo da nova tela termina de carregar, **Then** o indicador desaparece e o conteúdo da tela é exibido normalmente.
3. **Given** uma navegação demorada (ex.: mais de 3 segundos), **When** o usuário observa a tela durante esse tempo, **Then** o indicador permanece visível de forma contínua (não pisca, não some e reaparece), transmitindo que o sistema continua processando.
4. **Given** uma navegação muito rápida (ex.: menos de algumas centenas de milissegundos), **When** a troca de tela acontece, **Then** o usuário não percebe um "flash" incômodo do indicador aparecendo e sumindo instantaneamente — a experiência continua percebida como fluida.

---

### User Story 2 - Ver uma prévia da estrutura da tela enquanto os dados carregam (Priority: P2)

Como usuário, ao abrir uma tela que demora para carregar, eu quero ver um esboço da estrutura da tela (título, áreas de conteúdo) em vez de uma tela em branco, para sentir que o sistema já está "quase lá" e entender que tipo de conteúdo está a caminho.

**Why this priority**: Complementa a User Story 1 — a barra de progresso avisa que "algo está acontecendo", mas uma prévia da estrutura reduz ainda mais a sensação de espera e evita a tela em branco completa, especialmente em conexões mais lentas.

**Independent Test**: Acessar uma tela de relatório ou listagem com carregamento perceptível e confirmar que, antes dos dados reais aparecerem, uma versão simplificada (esqueleto) da estrutura da tela é exibida no lugar de uma área em branco.

**Acceptance Scenarios**:

1. **Given** o usuário navega para uma tela que busca dados no servidor, **When** os dados ainda não chegaram, **Then** a área de conteúdo exibe uma prévia esquemática da estrutura da tela (títulos, blocos, linhas de tabela) no lugar de ficar em branco.
2. **Given** a prévia esquemática está sendo exibida, **When** os dados reais chegam, **Then** a prévia é substituída pelo conteúdo real sem deixar a tela "pular" de forma brusca.
3. **Given** uma tela cujo carregamento é praticamente instantâneo, **When** o usuário navega até ela, **Then** a prévia esquemática não chega a aparecer de forma perceptível (evita um flash desnecessário para navegações rápidas).

---

### User Story 3 - Indicação de carregamento também em ações dentro da tela (Priority: P3)

Como usuário, ao realizar uma ação que não é uma troca de tela (ex.: aplicar um filtro, confirmar uma operação), eu quero que a indicação de carregamento já existente nessas ações continue clara e consistente com o novo indicador de navegação, para que toda a experiência do painel pareça parte do mesmo sistema.

**Why this priority**: Menor prioridade porque a maior parte das telas já tem algum feedback local (mensagens de operação, botões desabilitados durante o processamento) — o ganho aqui é consistência visual, não a ausência total de feedback como nas User Stories 1 e 2.

**Independent Test**: Comparar visualmente o indicador de navegação (US1) com os indicadores locais já existentes (ex.: mensagem "Aplicando filtros...", botões desabilitados) e confirmar que seguem a mesma linguagem visual (cor, estilo).

**Acceptance Scenarios**:

1. **Given** o novo indicador de navegação foi implementado, **When** o usuário compara com os indicadores de carregamento já existentes em ações locais (filtros, confirmações, formulários), **Then** ambos usam a mesma cor de destaque e linguagem visual, sem parecerem de sistemas diferentes.

---

### Edge Cases

- O que acontece se a navegação falhar (erro de rede, sessão expirada, erro do servidor)? O indicador de carregamento deve desaparecer e o erro deve ser comunicado ao usuário através do tratamento de erro já existente no sistema, sem deixar a barra de progresso "travada" indefinidamente.
- O que acontece se o usuário clicar em outro link enquanto uma navegação anterior ainda está em andamento? O indicador deve continuar refletindo a navegação mais recente, sem comportamento inconsistente (ex.: duas barras simultâneas, ou indicador que não reinicia).
- O que acontece em conexões muito lentas, onde o carregamento demora vários segundos? O indicador não deve dar a entender que travou — deve continuar visivelmente ativo (ex.: animação contínua) durante toda a espera.
- O que acontece ao navegar para uma tela que já teve seus dados carregados anteriormente (ex.: voltar para uma tela já visitada)? Se a navegação for praticamente instantânea nesse caso, o indicador não precisa aparecer de forma perceptível.
- O que acontece em ações que já mostram seu próprio indicador local (ex.: um formulário sendo salvo)? O indicador de navegação não deve duplicar ou conflitar com indicadores locais já existentes quando não há troca de tela envolvida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir um indicador visual de carregamento assim que o usuário inicia uma navegação entre telas do painel (clique em menu ou em qualquer link interno), antes mesmo de os dados da nova tela estarem disponíveis.
- **FR-002**: O sistema MUST remover o indicador de carregamento assim que a nova tela estiver pronta para exibição.
- **FR-003**: O indicador de carregamento MUST permanecer visível de forma contínua durante toda a duração da navegação, sem piscar ou desaparecer prematuramente enquanto os dados ainda estão sendo carregados.
- **FR-004**: O sistema MUST evitar exibir o indicador de forma perceptível para navegações extremamente rápidas, para não introduzir um "flash" visual desnecessário.
- **FR-005**: O sistema MUST exibir uma prévia esquemática da estrutura da tela (esqueleto de carregamento) nas telas cujo conteúdo demora a chegar, em vez de deixar a área de conteúdo em branco.
- **FR-006**: O sistema MUST substituir a prévia esquemática pelo conteúdo real assim que os dados chegarem, sem um salto visual brusco de layout.
- **FR-007**: O indicador de carregamento de navegação MUST usar a mesma linguagem visual (cor de destaque, estilo) já usada pelos indicadores de carregamento locais existentes no painel.
- **FR-008**: O sistema MUST garantir que uma navegação com falha (erro de rede, sessão expirada, erro do servidor) remova o indicador de carregamento e acione o tratamento de erro já existente, em vez de deixar o indicador visível indefinidamente.
- **FR-009**: O sistema MUST lidar corretamente com o caso de o usuário iniciar uma nova navegação antes da anterior terminar, refletindo sempre o estado da navegação mais recente.
- **FR-010**: Esta melhoria MUST cobrir todas as telas do painel administrativo acessíveis pelo menu principal, não apenas uma tela específica.

### Key Entities *(include if feature involves data)*

- **Estado de Navegação**: representa se uma troca de tela está em andamento (carregando) ou concluída, usado para decidir quando mostrar/esconder o indicador visual.
- **Prévia Esquemática (Esqueleto)**: representação simplificada e genérica da estrutura de uma tela (títulos, blocos, linhas), exibida no lugar do conteúdo real enquanto ele ainda não chegou.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em qualquer navegação entre telas do painel que leve mais de 300ms, o usuário vê uma indicação visual contínua de carregamento em até 100ms após o clique.
- **SC-002**: Nenhuma navegação entre telas do painel deixa a área de conteúdo completamente em branco por mais de um instante perceptível — sempre há indicador de progresso e/ou prévia esquemática.
- **SC-003**: Navegações rápidas (abaixo do limiar definido na fase de planejamento) não exibem indicador de forma perceptível, preservando a sensação de fluidez já existente.
- **SC-004**: 100% das telas acessíveis pelo menu principal do painel administrativo estão cobertas pelo indicador de navegação.
- **SC-005**: Nenhuma navegação com erro deixa o indicador de carregamento visível por mais tempo do que o necessário para o erro ser tratado e comunicado ao usuário.

## Assumptions

- O indicador de navegação (barra de progresso) é global — um único componente cobrindo toda troca de tela do painel administrativo, não implementado tela por tela.
- A prévia esquemática (esqueleto) pode ser genérica na primeira versão (ex.: blocos e linhas simplificados) — não precisa replicar fielmente o layout final de cada tela específica; refinamentos por tela podem ser feitos depois.
- O limiar de tempo abaixo do qual o indicador não aparece (para evitar "flash" em navegações rápidas) será definido tecnicamente na fase de planejamento, com base em práticas comuns de UX para indicadores de carregamento.
- Esta melhoria cobre a navegação entre telas (troca de página) do painel administrativo; não inclui redesenhar os indicadores de carregamento locais já existentes dentro de cada tela (filtros, formulários, diálogos), além de alinhar sua cor/estilo com o novo indicador (User Story 3).
- A área pública (cardápio digital) e a tela de login não fazem parte do escopo desta feature, que é focada na experiência operacional do painel administrativo.
