# Feature Specification: MCP Server por Loja para Análises com LLM

**Feature Branch**: `025-store-mcp-server`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Gostaria de entender se conseguimos expor um MCP Server da aplicação, com o objetivo que eu possa configurar o MCP acessando dados por loja, ou seja, poderia configurar MCP para cada loja configurada no sistema, tendo uma tela para habilitar ou não o MCP. O objetivo é conseguir interagir com LLM para gerar análises, insights sobre os números das lojas." Escopo desta spec: Fase 1 (MVP) da proposta aprovada, com acesso por token de loja, somente leitura, e testável via MCP Inspector, Claude Code, Claude Desktop e Cursor. OAuth (para conectores do claude.ai web e ChatGPT) fica para uma fase posterior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Habilitar o MCP da loja e gerar um token de acesso (Priority: P1)

Como administrador da loja, eu quero habilitar o acesso via MCP para a minha loja e gerar um token, para conectar um assistente de IA (Claude, Cursor etc.) aos números dessa loja.

**Why this priority**: Sem habilitação e token não existe acesso. Esta história é a porta de entrada de toda a feature e garante que o acesso nasce desligado e sob controle do dono da loja.

**Independent Test**: Entrar no admin com um usuário da loja que tenha a permissão de gerenciar MCP, abrir **Configurações → MCP**, habilitar, gerar um token e confirmar que ele é exibido uma única vez, junto com os trechos de configuração prontos para os clientes suportados.

**Acceptance Scenarios**:

1. **Given** uma loja que nunca configurou MCP, **When** o administrador abre a tela de MCP, **Then** o MCP aparece **desabilitado**, sem tokens, e com explicação curta do que é a funcionalidade.
2. **Given** o MCP desabilitado, **When** o administrador o habilita, **Then** o estado passa a "Habilitado", a mudança é registrada em auditoria (quem, quando) e a opção de gerar token fica disponível.
3. **Given** o MCP habilitado, **When** o administrador gera um token informando um nome (ex.: "Notebook do Robson") e uma validade, **Then** o token completo é exibido **uma única vez**, com botão de copiar e trechos de configuração prontos para MCP Inspector, Claude Code, Claude Desktop e Cursor, já preenchidos com o endereço do servidor e o token.
4. **Given** um token já gerado, **When** o administrador fecha o aviso e volta à lista, **Then** o token aparece apenas pelo nome, prefixo identificador (ex.: `rrf_mcp_ab12…`), data de criação, validade e último uso. O valor completo nunca mais é exibido.
5. **Given** um usuário sem a permissão de gerenciar MCP, **When** ele tenta acessar a tela ou as ações de MCP, **Then** o acesso é negado e o item não aparece no menu.
6. **Given** um usuário master com acesso a várias lojas, **When** ele troca a loja ativa e abre a tela de MCP, **Then** vê e gerencia apenas a configuração e os tokens da loja ativa.

---

### User Story 2 - Consultar os números da loja a partir de um assistente de IA (Priority: P1)

Como dono ou gestor da loja, eu quero perguntar ao meu assistente de IA sobre vendas, DRE, margem do cardápio, caixa, contas a pagar e estoque da loja, e receber análises baseadas nos dados reais do RRFive OS.

**Why this priority**: É o valor central pedido: gerar análises e insights sobre os números da loja usando um LLM.

**Independent Test**: Com um token válido configurado no MCP Inspector, listar as ferramentas disponíveis, executar "resumo de vendas" para setembro e comparar os totais com a tela de Relatório de Vendas do admin. Em seguida, no Claude Code, fazer uma pergunta livre ("Compare setembro com agosto e aponte os produtos com pior margem") e confirmar que a resposta usa dados da loja.

**Acceptance Scenarios**:

1. **Given** um cliente MCP configurado com token válido de uma loja com MCP habilitado, **When** o cliente se conecta, **Then** recebe a lista de ferramentas de consulta correspondentes às áreas de dados liberadas para aquela loja, cada uma com nome e descrição em português que explicam o que retorna e quais parâmetros aceita.
2. **Given** a ferramenta de resumo de vendas, **When** chamada para um período, **Then** retorna os mesmos totais exibidos na tela de Relatório de Vendas para o mesmo período e filtros (faturamento, quantidade de pedidos, ticket médio, quebras por plataforma, meio de pagamento e dia).
3. **Given** a ferramenta de DRE, **When** chamada para um período, **Then** retorna os mesmos valores da tela de DRE para o mesmo período.
4. **Given** qualquer ferramenta que recebe período, **When** o período excede o limite de consulta interativa já praticado nos relatórios (92 dias) ou é inválido (início depois do fim, data malformada), **Then** a ferramenta retorna erro claro em português explicando o limite, sem executar a consulta.
5. **Given** qualquer ferramenta que recebe período, **When** chamada sem período, **Then** usa o mesmo período padrão das telas de relatório correspondentes, e a resposta informa explicitamente qual período foi usado.
6. **Given** o cliente conectado, **When** solicita os recursos de contexto, **Then** recebe o perfil da loja (nome, plataformas de venda e meios de pagamento configurados, fuso horário) e um glossário das métricas (CMV, ticket médio, margem de contribuição, classificação da engenharia de cardápio).
7. **Given** o cliente conectado, **When** lista os modelos de análise (prompts), **Then** encontra ao menos: "Análise semanal da loja", "Comparar dois períodos", "Diagnóstico de margem do cardápio" e "Saúde do caixa nos próximos 30 dias".
8. **Given** qualquer resposta de ferramenta, **When** inspecionada, **Then** não contém dados pessoais de clientes (nome, telefone, endereço, documento), nem segredos ou credenciais de integrações.
9. **Given** valores monetários em qualquer resposta, **When** inspecionados, **Then** são apresentados de forma inequívoca (valor em reais com duas casas decimais) e datas seguem o fuso de negócio da loja (America/Sao_Paulo).

---

### User Story 3 - Isolamento entre lojas e revogação imediata (Priority: P1)

Como administrador, eu quero ter certeza de que o token de uma loja nunca expõe dados de outra loja, e de que desabilitar o MCP ou revogar um token corta o acesso na hora.

**Why this priority**: Requisito de segurança. Sem esta garantia a feature não pode ir para produção, mesmo que as demais funcionem.

**Independent Test**: Gerar tokens para a Loja A e a Loja B. Com o token da Loja A, executar todas as ferramentas e confirmar que nenhum dado da Loja B aparece. Depois revogar o token da Loja A e confirmar que a chamada seguinte é recusada. Repetir desabilitando o MCP da loja.

**Acceptance Scenarios**:

1. **Given** um token da Loja A, **When** qualquer ferramenta é executada, **Then** somente dados da Loja A são retornados. Nenhuma ferramenta aceita parâmetro que permita escolher outra loja.
2. **Given** um token válido, **When** o administrador o revoga na tela, **Then** a próxima chamada com esse token é recusada com mensagem de acesso não autorizado.
3. **Given** tokens válidos, **When** o administrador desabilita o MCP da loja, **Then** todas as chamadas com tokens dessa loja passam a ser recusadas. Ao reabilitar, tokens não revogados e não expirados voltam a funcionar.
4. **Given** um token expirado, **When** usado, **Then** a chamada é recusada e o token aparece como "Expirado" na tela.
5. **Given** um token inexistente, malformado ou ausente, **When** usado, **Then** a chamada é recusada sem revelar se o token existe ou a qual loja pertenceria.
6. **Given** uma loja desativada na plataforma, **When** um token dessa loja é usado, **Then** a chamada é recusada.
7. **Given** a área de dados "Financeiro/DRE" desmarcada na tela, **When** o cliente lista as ferramentas ou tenta chamar uma ferramenta dessa área, **Then** a ferramenta não aparece na lista e a chamada direta é recusada.

---

### User Story 4 - Escolher quais áreas de dados ficam visíveis ao assistente (Priority: P2)

Como administrador, eu quero escolher quais áreas de dados o assistente pode consultar (Vendas, Financeiro/DRE, Cardápio e Margem, Caixa, Contas a pagar, Estoque), para não expor mais do que o necessário.

**Why this priority**: Aumenta o controle e a confiança, mas um MVP com todas as áreas liberadas por padrão já entrega valor.

**Independent Test**: Desmarcar "Estoque" na tela, reconectar o cliente MCP e confirmar que as ferramentas de estoque não aparecem e não podem ser chamadas.

**Acceptance Scenarios**:

1. **Given** a tela de MCP, **When** o administrador visualiza as áreas de dados, **Then** vê cada área com descrição curta do que ela expõe e um seletor de liga/desliga.
2. **Given** uma área desligada, **When** o cliente MCP reconecta, **Then** as ferramentas, recursos e modelos de análise que dependem exclusivamente daquela área não aparecem.
3. **Given** todas as áreas desligadas, **When** o administrador tenta salvar, **Then** o sistema impede e explica que ao menos uma área precisa estar ativa enquanto o MCP estiver habilitado.
4. **Given** uma mudança nas áreas, **When** salva, **Then** é registrada em auditoria (quem, quando, antes e depois).

---

### User Story 5 - Acompanhar o uso do MCP (Priority: P2)

Como administrador, eu quero ver quais consultas foram feitas pelo assistente, quando e por qual token, para auditar o uso e identificar tokens esquecidos ou abusados.

**Why this priority**: Transparência e auditoria. Importante para operação, mas não bloqueia o uso inicial.

**Independent Test**: Executar algumas ferramentas pelo MCP Inspector e confirmar que cada chamada aparece no log de uso da tela, com data/hora, token (nome e prefixo), ferramenta, parâmetros resumidos, resultado (sucesso/erro) e duração.

**Acceptance Scenarios**:

1. **Given** chamadas realizadas, **When** o administrador abre o log de uso, **Then** vê as chamadas mais recentes primeiro, paginadas, com data/hora, token, ferramenta, parâmetros, resultado e duração.
2. **Given** o log, **When** o administrador filtra por token ou por período, **Then** vê apenas as chamadas correspondentes.
3. **Given** chamadas recusadas por autenticação de um token conhecido (revogado, expirado, MCP desabilitado), **When** o log é consultado, **Then** essas tentativas aparecem marcadas como "recusada".
4. **Given** um token usado, **When** a lista de tokens é exibida, **Then** mostra a data/hora de último uso atualizada.

---

### Edge Cases

- **Excesso de chamadas**: um cliente que dispara muitas chamadas em sequência é limitado por token. Ao atingir o limite, recebe erro em português indicando para aguardar, sem afetar o uso normal do admin.
- **Consulta pesada**: se o sistema estiver sob pressão de memória ou a consulta exceder o tempo limite, a ferramenta retorna erro amigável sugerindo um período menor, sem derrubar a API.
- **Loja sem dados no período**: as ferramentas retornam totais zerados e uma indicação explícita de "sem movimento no período", em vez de erro.
- **Token gerado e não copiado**: se o administrador fechar o aviso sem copiar, o token não pode ser recuperado. A orientação é revogar e gerar outro.
- **Limite de tokens**: cada loja pode ter no máximo 10 tokens ativos. Ao atingir o limite, a geração é bloqueada com orientação para revogar tokens não utilizados.
- **Troca de configuração durante uma sessão aberta**: mudanças (desabilitar, revogar, alterar áreas) valem a partir da próxima chamada, sem precisar reiniciar o servidor.
- **Respostas volumosas**: ferramentas retornam dados agregados e, quando houver listas (ex.: ranking de produtos, contas a pagar), limitam a quantidade de itens e informam que há mais resultados.
- **Usuário que gerou o token perde acesso à loja**: o token continua pertencendo à loja e só deixa de funcionar se for revogado, expirar ou o MCP for desabilitado. A tela mostra quem o gerou.
- **Administrador de plataforma**: não gerencia MCP de lojas pela área da plataforma nesta fase.

## Requirements *(mandatory)*

### Functional Requirements

**Configuração e tokens**

- **FR-001**: O sistema MUST manter, por loja, uma configuração de MCP com estado (habilitado/desabilitado) e áreas de dados liberadas. Toda loja nasce com o MCP **desabilitado**.
- **FR-002**: O sistema MUST oferecer uma tela no admin da loja para habilitar/desabilitar o MCP, selecionar áreas de dados, gerar, listar e revogar tokens, e consultar o log de uso.
- **FR-003**: O sistema MUST restringir a tela e as ações de MCP a usuários com uma nova permissão dedicada de gerenciamento de MCP, incluída por padrão no perfil de administrador da loja e concedida ao usuário master.
- **FR-004**: Ao gerar um token, o sistema MUST exigir um nome descritivo e uma validade (30, 90 ou 365 dias, ou sem expiração), exibir o valor completo uma única vez e armazenar apenas uma forma não reversível do token.
- **FR-005**: O token MUST ter um prefixo identificável (ex.: `rrf_mcp_`) e entropia suficiente para não ser adivinhado. A tela MUST exibir apenas o prefixo e os primeiros caracteres após a criação.
- **FR-006**: O sistema MUST permitir revogar tokens individualmente, com efeito imediato.
- **FR-007**: O sistema MUST limitar a 10 o número de tokens ativos por loja.
- **FR-008**: Ao gerar o token, o sistema MUST exibir trechos de configuração prontos para MCP Inspector, Claude Code, Claude Desktop e Cursor, preenchidos com o endereço público do servidor e o token.
- **FR-009**: O sistema MUST registrar em auditoria a habilitação, desabilitação, alteração de áreas, geração e revogação de tokens, com usuário e data/hora.

**Acesso e isolamento**

- **FR-010**: O sistema MUST expor um servidor MCP acessível por HTTP, autenticado exclusivamente por token de loja enviado no cabeçalho de autorização.
- **FR-011**: A loja de cada chamada MUST ser determinada exclusivamente pelo token. Nenhuma ferramenta pode aceitar identificador de loja como parâmetro.
- **FR-012**: O sistema MUST recusar chamadas quando o token estiver ausente, inválido, revogado ou expirado, quando o MCP da loja estiver desabilitado ou quando a loja estiver desativada, sem revelar a existência do token ou da loja.
- **FR-013**: O sistema MUST recusar chamadas a ferramentas de áreas de dados não liberadas e omiti-las da listagem.
- **FR-014**: Todas as ferramentas MUST ser somente leitura. Nenhuma pode criar, alterar ou excluir dados.
- **FR-015**: O sistema MUST limitar a taxa de chamadas por token e retornar erro claro ao exceder o limite.

**Conteúdo exposto**

- **FR-016**: O sistema MUST oferecer ferramentas de consulta, agrupadas por área de dados:
  - **Vendas**: resumo de vendas por período com filtros (plataforma, meio de pagamento, instituição, status) e quebras por dia, plataforma e meio de pagamento; resumo diário de uma data; relatório gerencial do período.
  - **Financeiro/DRE**: DRE do período; indicadores do dashboard financeiro.
  - **Cardápio e Margem**: engenharia de cardápio do período (classificação dos produtos por popularidade e margem).
  - **Caixa**: posição de caixa por conta e extrato consolidado do período.
  - **Contas a pagar**: contas vencidas, a vencer (próximos N dias) e pagas no período, com totais.
  - **Estoque**: posição atual e itens abaixo do mínimo.
- **FR-017**: Os números retornados por cada ferramenta MUST ser idênticos aos exibidos na tela correspondente do admin para os mesmos parâmetros, reutilizando as mesmas regras de cálculo.
- **FR-018**: As ferramentas MUST retornar dados agregados e prontos para interpretação (totais, médias e variações já calculados), limitando listas a no máximo 50 itens e indicando quando houver mais.
- **FR-019**: As respostas MUST NOT conter dados pessoais de clientes nem segredos/credenciais de integrações.
- **FR-020**: O sistema MUST respeitar o limite de 92 dias por consulta e o fuso de negócio da loja, e informar em cada resposta o período efetivamente considerado.
- **FR-021**: O sistema MUST expor recursos de contexto: perfil da loja e glossário de métricas.
- **FR-022**: O sistema MUST expor ao menos quatro modelos de análise: análise semanal, comparação de dois períodos, diagnóstico de margem do cardápio e saúde do caixa nos próximos 30 dias.
- **FR-023**: Nomes, descrições de ferramentas, parâmetros e mensagens de erro MUST estar em português.

**Uso e auditoria**

- **FR-024**: O sistema MUST registrar cada chamada de ferramenta (loja, token, ferramenta, parâmetros, resultado, duração, data/hora) e cada recusa de token conhecido, e exibi-las na tela com filtro por token e período.
- **FR-025**: O sistema MUST atualizar a data/hora de último uso do token a cada chamada aceita.
- **FR-026**: O sistema MUST manter o log de uso por 90 dias.

### Key Entities

- **Configuração MCP da Loja**: uma por loja. Estado (habilitado/desabilitado), áreas de dados liberadas, quem alterou por último e quando.
- **Token MCP**: pertence a uma loja. Nome, prefixo visível, forma não reversível do valor, validade, data de revogação, último uso, usuário que gerou.
- **Registro de Uso MCP**: pertence a uma loja e opcionalmente a um token. Data/hora, ferramenta, parâmetros resumidos, resultado (sucesso, erro, recusada), duração.
- **Área de Dados**: catálogo fixo (Vendas, Financeiro/DRE, Cardápio e Margem, Caixa, Contas a pagar, Estoque) que agrupa ferramentas, recursos e modelos de análise.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um administrador consegue habilitar o MCP, gerar um token e conectar um assistente de IA (Claude Code ou Claude Desktop) em menos de 5 minutos, usando apenas os trechos de configuração exibidos na tela.
- **SC-002**: 100% das ferramentas retornam valores idênticos às telas correspondentes do admin no roteiro de aceite (vendas, DRE, engenharia de cardápio, caixa, contas a pagar, estoque).
- **SC-003**: Zero vazamento entre lojas: em testes automatizados cobrindo todas as ferramentas, nenhuma resposta obtida com token da Loja A contém dados da Loja B.
- **SC-004**: Revogação de token e desabilitação do MCP bloqueiam 100% das chamadas seguintes, sem atraso perceptível.
- **SC-005**: 95% das chamadas de ferramenta com período de até 31 dias respondem em menos de 3 segundos.
- **SC-006**: Zero ocorrências de dados pessoais de clientes ou segredos em respostas, verificado por testes automatizados.
- **SC-007**: O assistente consegue produzir uma análise comparativa de dois meses (vendas, margem e caixa) a partir de uma única pergunta, sem que o usuário precise fornecer números manualmente.

## Assumptions

- O escopo é a Fase 1 da proposta: acesso por token de loja. OAuth para conectores do claude.ai web e ChatGPT, ferramentas de escrita, chat embutido no RRFive OS e comparação entre lojas ficam fora desta spec.
- Um token dá acesso a exatamente uma loja. Para analisar várias lojas, o usuário cadastra um servidor MCP por loja no seu cliente.
- Testes locais usam `http://localhost`. Uso a partir de outros computadores requer a API publicada com HTTPS, já disponível nos ambientes publicados.
- O servidor MCP roda no mesmo processo da API (não no worker) e reutiliza os cálculos dos relatórios existentes.
- Todas as áreas de dados vêm liberadas por padrão quando o MCP é habilitado pela primeira vez.
- O custo de uso do LLM é do usuário, no seu próprio cliente (Claude, Cursor etc.). O RRFive OS não chama nenhum LLM nesta fase.
- Limite de taxa padrão: 60 chamadas por minuto por token (ajustável por configuração do ambiente).
