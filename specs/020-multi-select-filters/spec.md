# Feature Specification: Filtros com seleção múltipla

**Feature Branch**: `020-multi-select-filters`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Permitir selecionar mais de uma conta no filtro do Controle de Caixa por meio de um combobox com checkboxes, criar um componente reutilizável e aplicá-lo às demais telas com filtros da mesma característica."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consultar várias contas no Controle de Caixa (Priority: P1)

Como responsável financeiro, quero selecionar duas ou mais contas em um único filtro para analisar a posição, a projeção e o extrato consolidados apenas para as contas de interesse.

**Why this priority**: É a necessidade operacional que originou a solicitação e reduz consultas repetidas e consolidações manuais.

**Independent Test**: Selecionar duas contas no Controle de Caixa e confirmar que todos os totais, saldos, projeções e lançamentos exibidos pertencem exclusivamente ao conjunto selecionado.

**Acceptance Scenarios**:

1. **Given** que há três contas com movimentos, **When** o usuário seleciona duas contas e aplica o filtro, **Then** a posição e a projeção consolidam somente dados dessas duas contas.
2. **Given** que há lançamentos em contas diferentes, **When** o usuário seleciona mais de uma conta no filtro do extrato, **Then** totais, saldo e lançamentos consideram exclusivamente as contas selecionadas.
3. **Given** que nenhuma conta está selecionada, **When** o usuário aplica o filtro, **Then** o resultado considera todas as contas disponíveis.

---

### User Story 2 - Usar um filtro multisseleção claro e acessível (Priority: P2)

Como usuário administrativo, quero identificar, alterar e limpar minhas seleções sem perder contexto, inclusive usando teclado e tecnologias assistivas.

**Why this priority**: Um componente compartilhado só é útil se comunicar corretamente o estado e funcionar de forma consistente nas diferentes telas.

**Independent Test**: Operar o filtro com mouse e teclado, selecionar e remover opções, usar a ação de limpar e verificar que o resumo representa corretamente zero, uma ou várias seleções.

**Acceptance Scenarios**:

1. **Given** que o filtro está fechado, **When** o usuário o abre, **Then** cada opção apresenta seu estado por checkbox sem aplicar o filtro automaticamente.
2. **Given** que duas opções estão marcadas, **When** o filtro é fechado, **Then** o controle apresenta um resumo inequívoco das seleções.
3. **Given** que existem opções selecionadas, **When** o usuário limpa o controle, **Then** nenhuma opção permanece selecionada e o estado volta a representar todos os valores.
4. **Given** que o usuário navega por teclado, **When** abre e percorre o controle, **Then** consegue marcar, desmarcar, fechar e retornar ao acionador sem depender do mouse.

---

### User Story 3 - Reutilizar multisseleção nos filtros equivalentes (Priority: P3)

Como usuário das telas administrativas, quero o mesmo comportamento de multisseleção nos filtros de listas e relatórios em que vários valores possam ser combinados, evitando consultas repetidas e experiências inconsistentes.

**Why this priority**: A padronização reduz esforço futuro e atende à necessidade declarada de distribuição do componente, depois de validar o fluxo principal no Controle de Caixa.

**Independent Test**: Para cada filtro elegível identificado no inventário da solução, selecionar pelo menos dois valores e verificar que a listagem ou relatório retorna a união dos valores escolhidos e mantém os demais filtros ativos.

**Acceptance Scenarios**:

1. **Given** um filtro de lista ou relatório classificado como elegível, **When** o usuário seleciona múltiplos valores e filtra, **Then** o resultado inclui itens correspondentes a qualquer valor selecionado e respeita os demais critérios.
2. **Given** um campo de formulário ou uma escolha mutuamente exclusiva, **When** a tela é atualizada, **Then** esse campo continua permitindo somente uma opção.
3. **Given** filtros equivalentes em telas diferentes, **When** o usuário interage com eles, **Then** abertura, seleção, resumo, limpeza, estados vazios e acessibilidade seguem o mesmo padrão.

### Edge Cases

- Uma opção selecionada deixa de estar disponível após a atualização dos dados: ela deve ser removida da seleção e o resultado deve ser atualizado sem quebrar a tela.
- Nenhuma conta está cadastrada ou ativa: o controle fica desabilitado e comunica que não há opções disponíveis.
- Todas as opções são selecionadas: o resumo pode representar “Todas” sem listar cada item, mantendo o mesmo resultado de seleção vazia.
- A combinação selecionada não possui resultados: métricas e listas exibem seus estados vazios normais, sem reutilizar dados da consulta anterior.
- O menu é fechado sem acionar o botão de filtro: a seleção visual é preservada, mas os dados continuam correspondendo ao último filtro aplicado.
- Parâmetros repetidos, vazios, inexistentes ou pertencentes a outra loja não podem ampliar o acesso nem causar resultados de outro estabelecimento.
- Transferências entre duas contas selecionadas não podem ser contabilizadas em duplicidade no consolidado.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir selecionar zero, uma ou várias contas nos dois filtros por conta do Controle de Caixa.
- **FR-002**: Seleção vazia MUST representar todas as contas às quais o usuário tem acesso.
- **FR-003**: Ao aplicar uma seleção, posição, saldos por conta, projeção, ledger, totais e extrato MUST ser calculados somente para o conjunto de contas selecionado.
- **FR-004**: O resultado consolidado MUST preservar as regras financeiras existentes, inclusive o tratamento de transferências entre contas selecionadas.
- **FR-005**: O controle compartilhado MUST exibir as opções com checkbox e comunicar visualmente os estados sem seleção, seleção única, múltipla seleção, todas selecionadas, sem opções e desabilitado.
- **FR-006**: O controle compartilhado MUST permitir marcar, desmarcar e limpar opções sem aplicar a consulta até que a ação de filtrar/atualizar da tela seja acionada.
- **FR-007**: O controle compartilhado MUST ser operável por teclado, ter foco visível, nomes acessíveis e comunicar seu estado expandido e as opções selecionadas.
- **FR-008**: O sistema MUST manter a seleção durante atualizações automáticas da tela e remover de forma segura opções que deixarem de estar disponíveis.
- **FR-009**: As consultas MUST aceitar múltiplos identificadores para filtros elegíveis, eliminar duplicidades e validar todos dentro do estabelecimento ativo.
- **FR-010**: O sistema MUST preservar compatibilidade com consultas que enviem um único valor ou nenhum valor.
- **FR-011**: A implementação MUST inventariar os comboboxes existentes e aplicar o componente aos filtros de listas e relatórios em que os valores possam ser combinados por união.
- **FR-012**: Campos de cadastro, edição, execução de ações, troca de contexto e escolhas mutuamente exclusivas MUST permanecer fora da migração para multisseleção.
- **FR-013**: Cada tela migrada MUST manter seus demais filtros, ações de limpar, paginação, exportação e estados vazios funcionando em conjunto com a seleção múltipla.
- **FR-014**: O sistema MUST impedir que identificadores inválidos ou de outro estabelecimento retornem dados não autorizados.
- **FR-015**: As seleções ainda não aplicadas MUST ser distinguíveis do conjunto usado na última consulta, evitando que os dados aparentem corresponder a critérios que ainda não foram executados.

### Key Entities

- **Opção de filtro**: Valor disponível para seleção, composto por identificador estável, rótulo apresentado e estado de disponibilidade.
- **Seleção de filtro**: Conjunto sem duplicidades de identificadores escolhidos pelo usuário; o conjunto vazio representa todos os valores.
- **Filtro aplicado**: Fotografia da seleção e dos demais critérios efetivamente usados na consulta exibida.
- **Conta financeira**: Conta pertencente ao estabelecimento ativo cujos saldos e eventos podem participar do Controle de Caixa.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um usuário consegue consultar duas ou mais contas no Controle de Caixa em uma única aplicação de filtro e em menos de 30 segundos.
- **SC-002**: Em 100% dos cenários de teste com uma, várias, todas ou nenhuma conta selecionada, totais e itens exibidos correspondem exatamente ao conjunto aplicado.
- **SC-003**: Em 100% dos filtros elegíveis migrados, o usuário consegue selecionar e remover opções tanto com mouse quanto apenas com teclado.
- **SC-004**: Nenhum campo de escolha mutuamente exclusiva passa a aceitar múltiplos valores após a migração.
- **SC-005**: Todas as telas migradas preservam paginação, limpeza, exportação e combinação com outros critérios nos testes de regressão aplicáveis.
- **SC-006**: Consultas com valores inválidos ou de outro estabelecimento retornam zero dados não autorizados em todos os testes de isolamento.
- **SC-007**: Uma nova tela elegível consegue adotar o padrão compartilhado sem criar uma nova implementação visual do combobox multisseleção.

## Assumptions

- “Demais telas com a mesma característica” significa filtros de consulta em que múltiplos valores representam uma união válida; não inclui todos os campos de seleção do sistema.
- A seleção é aplicada somente pela ação explícita já existente em cada tela, evitando consultas a cada clique no menu.
- Seleção vazia e seleção de todas as opções têm o mesmo significado funcional: não restringir por esse critério.
- As permissões e o estabelecimento ativo continuam definindo quais opções podem ser listadas e consultadas.
- Preferências de filtro não precisam persistir entre sessões ou navegações, salvo quando a tela já possuir essa capacidade.
- A primeira entrega funcional e de validação é o Controle de Caixa; o inventário determina as demais migrações elegíveis dentro da mesma feature.

## Scope Boundaries

### In Scope

- Componente compartilhado de filtro multisseleção.
- Dois filtros de conta do Controle de Caixa e suporte completo à consulta de múltiplas contas.
- Inventário e migração dos filtros combináveis em listas e relatórios administrativos.
- Testes de interação, regras financeiras, compatibilidade e isolamento por estabelecimento.

### Out of Scope

- Transformar campos de formulário e comandos operacionais em multisseleção.
- Persistir filtros como preferência permanente do usuário.
- Alterar regras financeiras, permissões ou cadastros de contas.
- Introduzir multisseleção quando o serviço de negócio não admitir combinação sem redefinição do produto.
