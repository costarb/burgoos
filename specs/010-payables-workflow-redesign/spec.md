# Feature Specification: Repaginacao do Fluxo de Contas a Pagar

**Feature Branch**: `010-payables-workflow-redesign`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "Quero repaginar a feature de contas a pagar: Formulario de Nova conta, abrir em um modal, ter a opcao de incluir. Deixar visivel os cards: Previsto, Pago, Em aberto, Vencido. Opcao de consulta visivel. Opcao de editar, mostrar em um modal, da mesma forma da inclusao e detalhes. Criar opcao para exportar para: CSV, PDF ou XLSX. Nao deixar o fluxo sincrono, mas assincrono e mostrar notificacao quando concluir ou der erro. Criar uma forma de gerenciar notificacao, pode ser um centro de notificacao. Criar nova feature, especificacao, subir para o git, criar nova branch, antes seguir git flow para deixar develop/main atualizada"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar conta em modal (Priority: P1)

Como usuario financeiro, quero abrir o formulario de nova conta a pagar em um modal para incluir uma conta sem sair da tela de consulta e acompanhamento.

**Why this priority**: A inclusao de contas e uma acao central da rotina financeira e deve ficar rapida, contextual e sem quebrar a visao da lista.

**Independent Test**: Pode ser testado abrindo a acao de nova conta, preenchendo dados obrigatorios, salvando pelo modal e verificando que a conta aparece na lista e os indicadores sao atualizados.

**Acceptance Scenarios**:

1. **Given** que o usuario esta na tela de contas a pagar, **When** aciona nova conta, **Then** o formulario abre em um modal sem navegar para outra pagina.
2. **Given** que o modal de nova conta esta aberto com dados validos, **When** o usuario confirma a inclusao, **Then** a nova conta e registrada, o modal fecha e a tela reflete a nova conta.
3. **Given** que o formulario possui dados invalidos ou obrigatorios ausentes, **When** o usuario tenta incluir, **Then** o modal permanece aberto e apresenta as validacoes necessarias.

---

### User Story 2 - Acompanhar indicadores sempre visiveis (Priority: P1)

Como usuario financeiro, quero ver os cards Previsto, Pago, Em aberto e Vencido durante a consulta para acompanhar rapidamente a situacao das contas.

**Why this priority**: Os indicadores resumem a saude do contas a pagar e orientam a tomada de decisao sem exigir leitura manual da lista.

**Independent Test**: Pode ser testado acessando a tela com contas em situacoes diferentes e verificando que os quatro cards permanecem visiveis e coerentes com os resultados apresentados.

**Acceptance Scenarios**:

1. **Given** que existem contas com diferentes situacoes, **When** o usuario acessa a tela, **Then** os cards Previsto, Pago, Em aberto e Vencido ficam visiveis.
2. **Given** que o usuario altera os filtros de consulta, **When** executa a consulta, **Then** os cards refletem o conjunto de contas considerado pela consulta atual.
3. **Given** que nao existem contas para a consulta atual, **When** os indicadores sao exibidos, **Then** todos os cards apresentam valores zerados ou estado equivalente claro.

---

### User Story 3 - Consultar e editar conta em modal (Priority: P1)

Como usuario financeiro, quero manter a opcao de consulta visivel e editar contas em um modal semelhante ao de inclusao e detalhes para revisar e ajustar registros sem perder o contexto da tela.

**Why this priority**: Consulta e edicao sao a rotina principal depois da inclusao; manter tudo em modal reduz troca de contexto e melhora velocidade operacional.

**Independent Test**: Pode ser testado consultando contas, abrindo uma conta existente para edicao, alterando um campo permitido e verificando a atualizacao na lista apos salvar.

**Acceptance Scenarios**:

1. **Given** que o usuario esta na tela de contas a pagar, **When** visualiza a area de filtros, **Then** a opcao de consulta fica claramente visivel e acionavel.
2. **Given** que ha uma conta listada, **When** o usuario aciona editar, **Then** os dados da conta abrem em um modal sem navegar para outra pagina.
3. **Given** que o usuario salva uma edicao valida no modal, **When** a operacao e concluida, **Then** o modal fecha e a lista exibe os dados atualizados.
4. **Given** que o usuario abre os detalhes de uma conta, **When** compara com os modais de inclusao e edicao, **Then** a experiencia visual e de fluxo permanece consistente.

---

### User Story 4 - Exportar contas em segundo plano (Priority: P2)

Como usuario financeiro, quero solicitar exportacao da consulta para CSV, PDF ou XLSX em segundo plano para continuar usando a tela enquanto o arquivo e preparado.

**Why this priority**: Exportar dados e importante para conferencia e compartilhamento, mas nao deve bloquear a rotina quando houver muitos registros.

**Independent Test**: Pode ser testado executando uma consulta, solicitando cada formato de exportacao e verificando que a tela continua utilizavel enquanto a solicitacao fica pendente.

**Acceptance Scenarios**:

1. **Given** que o usuario possui uma consulta de contas a pagar, **When** solicita exportacao em CSV, PDF ou XLSX, **Then** a solicitacao e registrada e a tela continua disponivel para uso.
2. **Given** que uma exportacao foi solicitada, **When** o arquivo fica pronto, **Then** o usuario recebe uma notificacao de conclusao com acesso ao resultado.
3. **Given** que uma exportacao falha, **When** o erro e identificado, **Then** o usuario recebe uma notificacao de erro com mensagem compreensivel.
4. **Given** que o usuario solicita uma exportacao com filtros aplicados, **When** o arquivo e gerado, **Then** o conteudo exportado respeita a consulta atual.

---

### User Story 5 - Gerenciar notificacoes operacionais (Priority: P2)

Como usuario financeiro, quero acessar um centro de notificacoes para acompanhar exportacoes concluidas, falhas e outras mensagens operacionais relevantes.

**Why this priority**: Exportacoes assincronas precisam de retorno confiavel; um centro de notificacoes evita que o usuario perca conclusoes ou erros se continuar navegando.

**Independent Test**: Pode ser testado gerando uma exportacao, acessando o centro de notificacoes e verificando status, mensagem e acao disponivel para a notificacao.

**Acceptance Scenarios**:

1. **Given** que existem notificacoes recentes, **When** o usuario abre o centro de notificacoes, **Then** consegue visualizar notificacoes com status, data e mensagem.
2. **Given** que uma notificacao ainda nao foi lida, **When** o usuario a visualiza ou marca como lida, **Then** ela deixa de contar como pendente.
3. **Given** que uma exportacao foi concluida, **When** o usuario acessa sua notificacao, **Then** encontra uma acao clara para obter o arquivo gerado.
4. **Given** que uma exportacao falhou, **When** o usuario acessa sua notificacao, **Then** encontra a mensagem de falha e pode decidir repetir a operacao.

### Edge Cases

- Quando o usuario fecha o modal de inclusao ou edicao com alteracoes nao salvas, o sistema deve evitar perda acidental de dados.
- Quando a conta editada muda de status, os cards devem refletir a nova situacao apos a conclusao da edicao.
- Quando a consulta retorna muitos registros, a solicitacao de exportacao deve permanecer em segundo plano e nao bloquear a navegacao.
- Quando o usuario solicita exportacoes repetidas com filtros diferentes, cada notificacao deve permitir distinguir formato, periodo da solicitacao e resultado.
- Quando uma notificacao de conclusao e recebida enquanto o usuario esta fora da tela de contas a pagar, ela deve continuar acessivel no centro de notificacoes.
- Quando o usuario nao tem permissao para editar ou exportar, as acoes correspondentes nao devem ficar disponiveis para uso.
- Quando nao houver contas para exportar, o usuario deve receber retorno claro sem gerar arquivo vazio de forma confusa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar a acao de nova conta a pagar diretamente na tela de contas a pagar.
- **FR-002**: O sistema MUST abrir o formulario de nova conta a pagar em um modal.
- **FR-003**: O usuario MUST conseguir incluir uma nova conta a pagar pelo modal quando os dados obrigatorios estiverem validos.
- **FR-004**: O sistema MUST manter os cards Previsto, Pago, Em aberto e Vencido visiveis na tela de contas a pagar.
- **FR-005**: Os cards MUST apresentar valores coerentes com o conjunto de contas considerado pela consulta atual.
- **FR-006**: O sistema MUST manter a opcao de consulta visivel e claramente acionavel na tela de contas a pagar.
- **FR-007**: O sistema MUST permitir editar uma conta a pagar existente a partir da lista ou detalhe.
- **FR-008**: O sistema MUST abrir a edicao de conta a pagar em um modal consistente com os fluxos de inclusao e detalhes.
- **FR-009**: O sistema MUST preservar a consistencia visual e funcional entre os modais de inclusao, edicao e detalhes.
- **FR-010**: O sistema MUST validar dados obrigatorios e regras de negocio antes de concluir inclusoes ou edicoes.
- **FR-011**: O sistema MUST atualizar lista, detalhes e indicadores apos inclusoes ou edicoes concluidas com sucesso.
- **FR-012**: O sistema MUST oferecer exportacao da consulta de contas a pagar nos formatos CSV, PDF e XLSX.
- **FR-013**: O sistema MUST processar exportacoes em segundo plano, sem bloquear a navegacao ou novas interacoes do usuario.
- **FR-014**: O sistema MUST notificar o usuario quando uma exportacao for concluida com sucesso.
- **FR-015**: O sistema MUST notificar o usuario quando uma exportacao falhar.
- **FR-016**: O sistema MUST permitir que o usuario acesse o arquivo ou resultado de uma exportacao concluida a partir da notificacao.
- **FR-016a**: O sistema MUST estruturar controles, contratos e processamento de exportacao de forma reutilizavel por outras telas administrativas, mantendo contas a pagar como primeiro contexto consumidor.
- **FR-017**: O sistema MUST disponibilizar um centro de notificacoes para consultar notificacoes operacionais.
- **FR-018**: O centro de notificacoes MUST permitir diferenciar notificacoes lidas e nao lidas.
- **FR-019**: O centro de notificacoes MUST exibir pelo menos status, mensagem, data da ocorrencia e acao disponivel quando aplicavel.
- **FR-020**: O sistema MUST respeitar permissoes existentes para visualizar, incluir, editar e exportar contas a pagar.
- **FR-021**: O conteudo exportado MUST respeitar os filtros e criterios da consulta usada no momento da solicitacao.
- **FR-022**: O sistema MUST apresentar retorno claro quando nao houver contas na consulta ou quando nao houver dados para exportar.

### Key Entities

- **Conta a pagar**: Compromisso financeiro registrado, com dados de fornecedor, categoria, competencia, vencimento, valor, pagamento e situacao.
- **Indicador financeiro**: Resumo numerico ou monetario de contas em uma situacao relevante, incluindo Previsto, Pago, Em aberto e Vencido.
- **Consulta de contas a pagar**: Conjunto de filtros e criterios usados para listar, analisar e exportar contas.
- **Solicitacao de exportacao**: Pedido feito pelo usuario para gerar um arquivo da consulta em um formato escolhido, com status de acompanhamento e contexto de origem reutilizavel por outras telas.
- **Notificacao operacional**: Mensagem direcionada ao usuario sobre eventos relevantes, como exportacao concluida ou falha.
- **Centro de notificacoes**: Area onde o usuario acompanha notificacoes, status, leitura e acoes relacionadas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuarios conseguem iniciar a inclusao de uma nova conta em ate 2 cliques a partir da tela de contas a pagar.
- **SC-002**: Pelo menos 90% dos usuarios observados conseguem incluir ou editar uma conta sem sair da tela principal.
- **SC-003**: Os cards Previsto, Pago, Em aberto e Vencido permanecem visiveis em 100% dos cenarios principais de consulta.
- **SC-004**: A tela permanece utilizavel em 100% das solicitacoes de exportacao durante a preparacao do arquivo.
- **SC-005**: 100% das exportacoes concluidas ou com erro geram uma notificacao compreensivel para o usuario.
- **SC-006**: Usuarios conseguem localizar no centro de notificacoes o resultado de uma exportacao recente em ate 30 segundos.
- **SC-007**: Arquivos exportados refletem os filtros da consulta original em 100% dos cenarios de validacao.
- **SC-008**: O tempo medio para incluir, consultar e editar uma conta durante a rotina financeira e reduzido em pelo menos 30% em comparacao com o fluxo anterior.

## Assumptions

- A tela de contas a pagar ja possui lista, filtros, detalhe e informacoes suficientes para inclusao e edicao de contas.
- Os cards Previsto, Pago, Em aberto e Vencido representam agregacoes da consulta atual, nao necessariamente de toda a base historica.
- O centro de notificacoes pode ser reutilizado futuramente por outras rotinas, mas esta feature exige pelo menos suporte as notificacoes de exportacao.
- A base de exportacao deve nascer reutilizavel para outros contextos administrativos, ainda que esta entrega implemente apenas o contexto de contas a pagar.
- O usuario autenticado ja possui regras de permissao que definem se pode visualizar, incluir, editar ou exportar contas a pagar.
- Exportacoes devem considerar os filtros aplicados no momento da solicitacao, mesmo que o usuario altere a consulta depois.
- A feature nao altera regras financeiras de pagamento, baixa, cancelamento, auditoria ou conciliacao; ela repagina o fluxo de uso da tela.
