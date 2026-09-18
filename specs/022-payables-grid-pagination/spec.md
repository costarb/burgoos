# Feature Specification: Paginação no Grid de Contas a Pagar

**Feature Branch**: `022-payables-grid-pagination`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Ajuste na tela de contas a pagar: o resultado da consulta no grid não retorna todos os dados quando há consulta com muitos registros. Sugestão: criar uma paginação para esta consulta."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar por todos os resultados da consulta (Priority: P1)

Como usuário financeiro, ao consultar contas a pagar com filtros que retornam muitos registros, eu quero navegar entre páginas de resultados para poder ver todas as contas que atendem à consulta, não apenas as primeiras.

**Why this priority**: É o problema relatado — hoje o usuário não consegue enxergar parte dos registros que deveriam aparecer na consulta, o que pode levar a decisões financeiras erradas (ex.: achar que uma conta não existe ou deixar de tratá-la).

**Independent Test**: Cadastrar (ou usar uma base com) mais contas a pagar do que o tamanho de uma página, aplicar um filtro que as retorne todas, e verificar que é possível navegar até visualizar o último registro do conjunto.

**Acceptance Scenarios**:

1. **Given** uma consulta de contas a pagar cujo resultado excede o tamanho de uma página, **When** o usuário abre a tela de contas a pagar, **Then** o grid exibe apenas a primeira página de registros e controles de navegação ficam disponíveis.
2. **Given** o usuário está visualizando a primeira página de resultados, **When** ele aciona "próxima página", **Then** o grid carrega e exibe a página seguinte de registros, mantendo os filtros aplicados.
3. **Given** o usuário está em uma página intermediária, **When** ele aciona "página anterior", **Then** o grid volta para a página anterior, mantendo os filtros aplicados.
4. **Given** o usuário está na última página de resultados, **When** ele verifica os controles de navegação, **Then** a ação de avançar para a próxima página fica desabilitada.

---

### User Story 2 - Saber quantos registros existem e em qual página está (Priority: P2)

Como usuário financeiro, eu quero ver quantos registros no total a consulta encontrou e em qual página estou, para entender o tamanho da lista e se ainda faltam contas para revisar.

**Why this priority**: Sem essa informação, o usuário não sabe se a consulta está completa nem quanto falta navegar, reduzindo a confiança na tela.

**Independent Test**: Aplicar uma consulta com um número conhecido de registros e verificar que a tela informa o total de registros e a posição da página atual (ex.: "Página 2 de 5" ou equivalente).

**Acceptance Scenarios**:

1. **Given** uma consulta com N registros distribuídos em mais de uma página, **When** o grid é exibido, **Then** a tela mostra o total de registros encontrados pela consulta (não apenas os exibidos na página atual).
2. **Given** o usuário navega entre páginas, **When** uma nova página é carregada, **Then** a indicação de página atual é atualizada de acordo.
3. **Given** os totais/resumos financeiros exibidos na tela (previsto, pago, em aberto, vencido), **When** o usuário navega entre páginas, **Then** esses totais continuam refletindo o resultado completo da consulta (todas as páginas), e não somente a página exibida.

---

### User Story 3 - Reiniciar a navegação ao alterar filtros (Priority: P2)

Como usuário financeiro, ao mudar os filtros da consulta (período, status, categoria, fornecedor etc.), eu quero que a listagem volte para a primeira página, para não ficar "perdido" vendo uma página que não existe mais para o novo filtro.

**Why this priority**: Evita uma experiência confusa (tela em branco ou página inconsistente) sempre que o usuário refina a busca, o que aconteceria com frequência no uso normal da tela.

**Independent Test**: Navegar até uma página diferente da primeira, alterar um filtro (ex.: status) e confirmar que o grid volta a exibir a primeira página do novo resultado.

**Acceptance Scenarios**:

1. **Given** o usuário está em uma página diferente da primeira, **When** ele altera qualquer filtro da consulta (período, status, categoria, fornecedor, competência), **Then** o grid é recarregado a partir da primeira página com o novo resultado.

---

### Edge Cases

- O que acontece quando a consulta retorna zero registros? O grid deve exibir o estado vazio já existente, sem controles de paginação ativos (ou com controles desabilitados).
- O que acontece quando o total de registros é menor ou igual ao tamanho de uma página? Os controles de navegação devem indicar que não há próxima nem página anterior (ou ficar ocultos/desabilitados), sem impedir a visualização dos dados.
- O que acontece se o usuário estiver em uma página que deixa de existir (ex.: registros foram removidos/cancelados entre uma ação e outra, reduzindo o total)? O sistema deve reconduzir o usuário para a última página válida (ou para a primeira) em vez de exibir uma página vazia por erro de intervalo.
- O que acontece durante o carregamento de uma nova página? O usuário deve receber uma indicação de carregamento e não poder disparar múltiplas navegações simultâneas que gerem resultados fora de ordem.
- O que acontece se a navegação de página falhar (erro de rede/servidor)? O usuário deve ver uma mensagem de erro e permanecer na página atual, podendo tentar novamente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir os resultados da consulta de contas a pagar em páginas de tamanho fixo, em vez de tentar carregar todos os registros de uma só vez.
- **FR-002**: O sistema MUST fornecer controles de navegação (avançar/voltar página) no grid de contas a pagar.
- **FR-003**: O sistema MUST exibir o total de registros encontrados pela consulta e a posição da página atual em relação ao total de páginas.
- **FR-004**: O sistema MUST manter os filtros ativos (período, status, categoria, fornecedor, competência) ao navegar entre páginas.
- **FR-005**: O sistema MUST reiniciar a navegação para a primeira página sempre que qualquer filtro da consulta for alterado.
- **FR-006**: O sistema MUST impedir a navegação para páginas fora do intervalo válido (antes da primeira ou depois da última página).
- **FR-007**: Os totais/resumos financeiros exibidos na tela (previsto, pago, em aberto, vencido, contagens) MUST continuar refletindo o resultado completo da consulta (todas as páginas), independentemente da página atualmente exibida.
- **FR-008**: O sistema MUST indicar visualmente quando uma nova página está sendo carregada.
- **FR-009**: O sistema MUST preservar as demais funcionalidades já existentes na tela de contas a pagar (edição, pagamento, cancelamento, exportação) funcionando corretamente independentemente da página em que o registro esteja sendo exibido.

### Key Entities *(include if feature involves data)*

- **Consulta de Contas a Pagar**: representa os filtros aplicados pelo usuário (período, status, categoria, fornecedor, competência) e o conjunto de contas a pagar que atendem a esses filtros.
- **Página de Resultados**: um subconjunto ordenado da Consulta de Contas a Pagar, com tamanho fixo, identificado por um número de página; junto com o total de registros e o total de páginas permite orientar a navegação.
- **Resumo Financeiro da Consulta**: totais agregados (previsto, pago, em aberto, vencido, quantidade de contas abertas/vencidas) calculados sobre todo o conjunto de resultados da consulta, não apenas sobre a página exibida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário consegue visualizar 100% dos registros retornados por uma consulta de contas a pagar, independentemente do volume de resultados, navegando pelas páginas disponíveis.
- **SC-002**: O tempo de carregamento de cada página do grid permanece estável (não degrada) à medida que o número total de registros da consulta cresce.
- **SC-003**: Os totais/resumos financeiros exibidos na tela permanecem corretos (idênticos ao total real da consulta) em qualquer página em que o usuário esteja.
- **SC-004**: Após alterar um filtro, o usuário sempre visualiza a primeira página do novo resultado, sem necessidade de ação manual adicional.

## Assumptions

- O tamanho de página (quantidade de registros por página) usará um valor padrão já adotado hoje pela consulta de contas a pagar, podendo ser ajustado tecnicamente na fase de planejamento sem impacto na experiência descrita aqui.
- A navegação por páginas (avançar/voltar, com indicação de total) é suficiente para resolver o problema relatado; não há exigência explícita de o usuário poder pular diretamente para uma página arbitrária ou alterar o tamanho da página, embora isso possa ser avaliado como melhoria futura.
- O comportamento de paginação deve seguir o mesmo padrão de experiência já usado em outras telas administrativas do sistema que possuem paginação (ex.: relatório de vendas), para manter consistência visual e de interação.
- Esta funcionalidade afeta apenas a tela de consulta/listagem de contas a pagar; telas de detalhe, edição, pagamento e cancelamento de uma conta específica não são impactadas.
- A extração/exportação de dados (quando existente) deve continuar operando sobre o conjunto completo de resultados da consulta, não apenas sobre a página exibida — este comportamento já existente não deve ser alterado por esta feature.
