# Feature Specification: Relatorio Gerencial Consolidado

**Feature Branch**: `011-management-report`

**Created**: 2026-06-30

**Status**: Draft

**Input**: User description: "Criar uma tela com filtro de data para reunir indicadores das telas de caixa, vendas e contas a pagar, incluindo cards, graficos, agrupamentos e exportacao PDF gerencial do periodo selecionado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualizar desempenho consolidado do periodo (Priority: P1)

Um administrador financeiro seleciona um periodo e visualiza, em uma unica tela, os principais indicadores de caixa, vendas e contas a pagar para entender a situacao gerencial do negocio sem navegar por varias telas.

**Why this priority**: Esta e a entrega central da feature. Sem a visao consolidada, o usuario continua dependendo de consultas separadas e comparacao manual.

**Independent Test**: Selecionar um periodo com dados conhecidos e verificar que os blocos de caixa, vendas e contas a pagar exibem indicadores coerentes com as telas originais.

**Acceptance Scenarios**:

1. **Given** que o administrador acessa o relatorio gerencial, **When** seleciona data inicial e final, **Then** a tela mostra os indicadores consolidados de caixa, vendas e contas a pagar para o periodo.
2. **Given** que o periodo selecionado nao possui dados em uma das areas, **When** o relatorio e carregado, **Then** a area correspondente exibe valores zerados e uma mensagem discreta de ausencia de movimentacao.
3. **Given** que o periodo selecionado corresponde a um mes, trimestre ou ano, **When** o relatorio e carregado, **Then** os indicadores mantem a mesma definicao usada nas telas originais.

---

### User Story 2 - Analisar vendas e recebimentos por origem (Priority: P1)

Um administrador compara pedidos, receitas, valores disponiveis, valores a receber, taxas, ticket medio e distribuicoes por instituicao, meio e canal para identificar quais origens sustentaram o resultado do periodo.

**Why this priority**: Vendas e recebimentos explicam a entrada de recursos e sao essenciais para interpretar o caixa e as contas a pagar.

**Independent Test**: Selecionar um periodo com pedidos em diferentes instituicoes, meios e canais e verificar cards, grafico evolutivo e quadros agrupados.

**Acceptance Scenarios**:

1. **Given** que existem vendas no periodo, **When** o relatorio e carregado, **Then** sao exibidos cards de pedidos, receita bruta, receita liquida, liberado/disponivel, valores a receber, taxa e ticket medio.
2. **Given** que existem vendas em mais de uma data, **When** o relatorio e carregado, **Then** um grafico evolutivo apresenta a evolucao das vendas no periodo.
3. **Given** que existem vendas em diferentes instituicoes, meios ou canais, **When** o relatorio e carregado, **Then** os quadros agrupados mostram totais e participacao por agrupamento.

---

### User Story 3 - Avaliar saidas e compromissos financeiros (Priority: P1)

Um administrador acompanha creditos, debitos, liquido, saldo final, saldos por conta, contas previstas, pagas, em aberto e vencidas para identificar pressao de caixa e compromissos futuros.

**Why this priority**: O relatorio deve explicar nao apenas vendas, mas tambem o impacto financeiro real e compromissos de pagamento.

**Independent Test**: Selecionar periodo com movimentacoes de caixa e contas a pagar em diferentes categorias e verificar que cards e agrupamentos refletem os totais esperados.

**Acceptance Scenarios**:

1. **Given** que existem movimentacoes de caixa no periodo, **When** o relatorio e carregado, **Then** sao exibidos creditos, debitos, liquido, saldo final e saldos por conta.
2. **Given** que existem contas a pagar no periodo, **When** o relatorio e carregado, **Then** sao exibidos previsto, pago, em aberto e vencido.
3. **Given** que existem despesas em mais de uma categoria, **When** o relatorio e carregado, **Then** um agrupamento por tipo de despesa mostra valores sumarizados em formato visual de facil comparacao.

---

### User Story 4 - Exportar relatorio gerencial em PDF (Priority: P2)

Um administrador exporta o relatorio completo em PDF para compartilhar ou arquivar uma leitura executiva do periodo selecionado.

**Why this priority**: A exportacao transforma a tela em evidencia gerencial reutilizavel em reunioes, auditorias e acompanhamento mensal.

**Independent Test**: Selecionar um periodo, solicitar exportacao PDF e validar que o arquivo apresenta capa, periodo, secoes, indicadores, agrupamentos e texto compreensivel sobre o resultado.

**Acceptance Scenarios**:

1. **Given** que o relatorio esta carregado, **When** o administrador solicita exportacao PDF, **Then** a solicitacao nao bloqueia o uso da tela e o usuario e avisado que sera notificado ao concluir.
2. **Given** que o PDF foi gerado, **When** o administrador baixa o arquivo, **Then** o documento contem periodo, resumo executivo, caixa, vendas, contas a pagar e agrupamentos principais.
3. **Given** que o periodo possui poucos ou muitos dados, **When** o PDF e gerado, **Then** o documento permanece legivel e prioriza indicadores e sumarizacoes gerenciais.

### Edge Cases

- Periodo inicial posterior ao periodo final deve ser rejeitado com mensagem clara.
- Periodos sem dados devem mostrar o relatorio com valores zerados, sem erro.
- Periodos muito longos devem continuar legiveis por meio de agrupamentos e resumo, evitando listas extensas sem contexto.
- Indicadores monetarios devem manter formato consistente em toda a tela e no PDF.
- Quando uma area nao tiver permissao ou dados disponiveis, o relatorio deve preservar as demais areas e sinalizar a indisponibilidade.
- Exportacoes PDF com erro devem gerar notificacao de falha sem expor detalhes tecnicos internos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar uma tela de relatorio gerencial acessivel a usuarios administrativos com permissao financeira e de relatorios.
- **FR-002**: O sistema MUST permitir filtrar o relatorio por data inicial e data final.
- **FR-003**: O sistema MUST oferecer atalhos de periodo para mes atual, mes anterior, trimestre atual e ano atual.
- **FR-004**: O sistema MUST apresentar um resumo executivo com os principais indicadores consolidados do periodo.
- **FR-005**: O sistema MUST apresentar indicadores de caixa: creditos, debitos, liquido, saldo final e saldos por conta.
- **FR-006**: O sistema MUST apresentar indicadores de vendas: pedidos, receita bruta, receita liquida, liberado/disponivel, valores a receber, taxa e ticket medio.
- **FR-007**: O sistema MUST apresentar grafico evolutivo de vendas para o periodo selecionado.
- **FR-008**: O sistema MUST apresentar agrupamentos de vendas por instituicao, por meio e por canal.
- **FR-009**: O sistema MUST apresentar indicadores de contas a pagar: previsto, pago, em aberto e vencido.
- **FR-010**: O sistema MUST apresentar despesas agrupadas por tipo ou categoria com totalizadores.
- **FR-011**: O sistema MUST manter as definicoes dos indicadores consistentes com as telas existentes de caixa, vendas e contas a pagar.
- **FR-012**: O sistema MUST atualizar todos os blocos quando o usuario altera o periodo e aplica o filtro.
- **FR-013**: O sistema MUST exibir estado vazio compreensivel quando nao houver dados no periodo.
- **FR-014**: O sistema MUST permitir exportar o relatorio gerencial em PDF.
- **FR-015**: A exportacao PDF MUST ser solicitada em segundo plano e notificar o usuario quando for concluida ou quando falhar.
- **FR-016**: O PDF exportado MUST conter periodo, resumo executivo, secoes de caixa, vendas, contas a pagar, principais agrupamentos e texto explicativo sobre o resultado do periodo.
- **FR-017**: O sistema MUST aplicar as mesmas regras de acesso administrativo e isolamento de dados ja usadas nas telas financeiras existentes.
- **FR-018**: O sistema MUST apresentar mensagens de erro amigaveis para periodos invalidos, falha de carregamento e falha de exportacao.

### Key Entities *(include if feature involves data)*

- **Periodo Gerencial**: Intervalo de datas usado para calcular todos os indicadores do relatorio.
- **Resumo Executivo**: Conjunto de indicadores de alto nivel que explica resultado, liquidez e compromissos do periodo.
- **Bloco de Caixa**: Indicadores e saldos derivados das movimentacoes financeiras e contas.
- **Bloco de Vendas**: Indicadores, evolucao e agrupamentos derivados dos pedidos e recebimentos.
- **Bloco de Contas a Pagar**: Indicadores de compromissos financeiros e agrupamento de despesas.
- **Exportacao Gerencial**: Solicitacao de arquivo PDF do relatorio para um periodo especifico.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador consegue consultar o relatorio consolidado de um mes em menos de 30 segundos a partir do menu administrativo.
- **SC-002**: 100% dos indicadores principais de caixa, vendas e contas a pagar exibidos no relatorio batem com os totais das telas de origem para o mesmo periodo.
- **SC-003**: O relatorio permite identificar, em uma unica tela, pelo menos os 5 principais sinais gerenciais do periodo: receita, liquidez, saldo, compromissos abertos e despesas por tipo.
- **SC-004**: O PDF exportado e compreensivel sem apoio da tela, contendo periodo, secoes nomeadas e indicadores com rotulos claros.
- **SC-005**: Em periodos sem dados, o usuario recebe uma resposta visual clara em vez de erro em 100% das secoes.
- **SC-006**: A exportacao PDF nao bloqueia a navegacao e informa conclusao ou falha por notificacao operacional.

## Assumptions

- O relatorio usa os mesmos conceitos e regras de calculo ja exibidos nas telas de caixa, vendas e contas a pagar.
- A primeira versao cobre uma visao consolidada por periodo, sem comparativo automatico contra periodos anteriores.
- A primeira versao exporta apenas PDF gerencial; CSV e XLSX podem ser avaliados depois se houver necessidade.
- O periodo padrao ao abrir a tela e o mes atual.
- A visualizacao prioriza resumo, graficos e agrupamentos; listas detalhadas completas permanecem nas telas de origem.
- Usuarios sem permissao financeira ou de relatorios nao devem acessar a tela.
