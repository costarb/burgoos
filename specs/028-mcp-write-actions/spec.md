# Feature Specification: Ações pelo MCP — Contas a Pagar e Importação de Vendas

**Feature Branch**: `028-mcp-write-actions`
**Created**: 2026-10-03
**Status**: Draft
**Input**: "Quero evoluir MCP para disponibilizar tool para criar contas a pagar e executar importação via API dos pedidos, para PagBank, Mercado Pago e iFood, seguindo as opções que tem em tela."

## Contexto

O servidor MCP da loja (specs 025 e 026) é **somente leitura por design**: escopo OAuth `mcp:read`, tools anotadas como `readOnlyHint`, e o token fixo da loja (`rrf_mcp_`) não pertence a nenhum usuário. Esta feature adiciona **ações** (escrita) para dois fluxos que já existem na tela:

- **Contas a pagar**: criar (com recorrência e classificação no DRE), registrar pagamento, editar e cancelar.
- **Importação de vendas via API** (PagBank, Mercado Pago, iFood): prévia por período e atribuição de produtos, acompanhamento e confirmação — o mesmo fluxo em duas etapas da tela. A carga inicial de 30/60/90 dias do Mercado Pago também.

Decisões tomadas com o usuário:

- **Escrita só via conexão OAuth** (ligada a um usuário). O token fixo continua somente leitura.
- **Contas a pagar**: criar, registrar pagamento, editar e cancelar.
- **iFood**: só a importação de vendas; a conciliação financeira fica fora.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Habilitar ações com segurança (Priority: P1)

Como dono da loja, eu quero decidir se os assistentes podem executar ações e quais pessoas autorizam isso, para que nenhum dado seja alterado sem consentimento explícito.

**Why this priority**: Pré-requisito de todas as ações. Sem ele, o MCP continua somente leitura.

**Independent Test**: Com "Permitir ações" desligado, uma conexão OAuth não vê nem executa tools de ação. Ligando e reconectando com o consentimento de ações marcado, as tools aparecem; um usuário sem `finance.manage` recebe erro de permissão ao tentar criar uma conta.

**Acceptance Scenarios**:

1. **Given** a tela de configuração do MCP, **When** o dono liga "Permitir ações pelos assistentes" (desligado por padrão), **Then** a mudança é auditada e as ações ficam disponíveis apenas para conexões OAuth que tenham o consentimento de ações.
2. **Given** a tela de consentimento OAuth, **When** a loja permite ações e o usuário tem ao menos uma permissão de ação, **Then** aparece a opção "Permitir que o assistente execute ações (criar e pagar contas, importar vendas)", **desmarcada** por padrão, listando as ações que as permissões do usuário liberam.
3. **Given** uma conexão sem consentimento de ações ou um token fixo, **When** o assistente lista as tools, **Then** as tools de ação não aparecem; se chamadas diretamente, respondem com erro explicando como habilitar.
4. **Given** uma ação, **When** executada, **Then** o sistema confere as **permissões atuais** do usuário da conexão (`finance.manage` para contas, `integrations.sales.manage` para importação) e a área de dados correspondente habilitada (Contas a pagar, Vendas).
5. **Given** a loja desliga "Permitir ações" ou a conexão é revogada, **When** o assistente tenta uma ação, **Then** ela é recusada imediatamente, sem precisar reconectar.
6. **Given** qualquer ação executada, **When** consultada na auditoria e no uso do MCP, **Then** aparece o usuário, o assistente (cliente OAuth) e a origem "MCP".

---

### User Story 2 - Contas a pagar pelo assistente (Priority: P1)

Como gestor, eu quero pedir ao assistente para lançar, pagar, corrigir ou cancelar contas a pagar com as mesmas opções da tela, sem abrir o sistema.

**Why this priority**: Pedido direto do usuário; reaproveita regras e auditoria já existentes.

**Independent Test**: Pedir ao assistente "lança o aluguel de R$ 3.000 vencendo dia 10, competência outubro, recorrente mensal por 12 meses" e verificar as 12 contas na tela, com categoria, fornecedor e classificação; registrar o pagamento de uma delas; editar o valor; cancelar com motivo.

**Acceptance Scenarios**:

1. **Given** `criar_conta_a_pagar`, **When** chamada com descrição, valor, vencimento, categoria (nome ou id), e opcionalmente fornecedor, competência, documento, observações, recorrência (frequência, intervalo, início, fim ou quantidade) e classificação no DRE, **Then** cria as contas com as mesmas validações da tela e devolve as contas criadas.
2. **Given** categoria ou fornecedor por nome, **When** o nome não existe ou é ambíguo, **Then** a tool recusa e lista as opções válidas (como já faz `contas_a_pagar`). A tool não cria categorias nem fornecedores.
3. **Given** já existe conta não cancelada com mesma descrição, valor e vencimento, **When** a criação é pedida, **Then** a tool não cria e devolve a conta existente, pedindo `confirmarDuplicidade: true` para criar mesmo assim.
4. **Given** `registrar_pagamento_conta`, **When** chamada com a conta, valor, data e conta financeira (nome ou id), **Then** registra o pagamento como na tela (parcial ou total) e devolve a situação atualizada.
5. **Given** `editar_conta_a_pagar`, **When** chamada com a conta e os campos a mudar, **Then** altera apenas esses campos, respeitando as regras da tela (por exemplo, contas pagas ou canceladas), e devolve antes e depois.
6. **Given** `cancelar_conta_a_pagar`, **When** chamada com a conta e o motivo (obrigatório), **Then** cancela como na tela.
7. **Given** qualquer ação de conta, **When** a conta é identificada, **Then** isso é feito pelo id devolvido por `contas_a_pagar` ou por uma nova busca; nunca por descrição aproximada.

---

### User Story 3 - Importar vendas via API pelo assistente (Priority: P1)

Como gestor, eu quero pedir ao assistente para importar as vendas de um período do PagBank, Mercado Pago ou iFood, ver a prévia e confirmar, como faço na tela.

**Why this priority**: Pedido direto do usuário; mantém a revisão antes de gravar.

**Independent Test**: Pedir "importa as vendas do Mercado Pago de ontem"; o assistente mostra a prévia (novos, duplicados, dias bloqueados); ao confirmar, as vendas aparecem em Pedidos e o histórico de importações registra a execução feita pelo MCP.

**Acceptance Scenarios**:

1. **Given** `integracoes_de_vendas`, **When** chamada, **Then** lista as integrações da loja (provedor, nome, situação, última importação) e os produtos disponíveis para atribuição fixa.
2. **Given** `importar_vendas_previa`, **When** chamada com a integração (provedor ou nome), período (início e fim, ou `cargaInicialDias` 30/60/90 apenas para o Mercado Pago) e atribuição ("automática por valor" ou "produto fixo" + produto por nome ou id), **Then** inicia a prévia com as mesmas regras da tela (integração ativa, sem execução sobreposta, limites de período) e devolve o identificador da execução.
3. **Given** `importacao_status`, **When** chamada com o identificador, **Then** devolve a situação (buscando, prévia pronta, parcialmente pronta, importando, concluída, com erros, falhou) e, com a prévia pronta, o resumo: período, quantidade e valor de vendas novas, duplicadas, pedidos já existentes e dias bloqueados com o motivo.
4. **Given** `importar_vendas_confirmar`, **When** chamada para uma execução com prévia pronta (ou parcialmente pronta), **Then** confirma de forma idempotente e devolve a situação; para execuções em outro estado, recusa explicando o motivo.
5. **Given** o iFood, **When** importado pelo MCP, **Then** apenas a importação de vendas é oferecida; a conciliação financeira não.

---

### Edge Cases

- **Cliente envia escopo `mcp:write` sem a loja permitir ações**: a conexão é concedida somente leitura e o consentimento informa isso.
- **Permissão removida do usuário depois da conexão**: a próxima ação é recusada com erro de permissão; leituras continuam conforme as áreas.
- **Duas prévias para a mesma integração e período**: a segunda é recusada como na tela ("execução em andamento").
- **Confirmação repetida**: idempotente; não duplica vendas.
- **Recorrência sem fim nem quantidade**: recusada (mesma regra da tela).
- **Pagamento maior que o restante**: segue a regra da tela.
- **Assistente tenta ação com token fixo**: erro "Ações exigem conexão OAuth com consentimento de ações".
- **Limites de uso**: ações contam no limite de chamadas do MCP e têm um limite próprio mais baixo por conexão.

## Requirements *(mandatory)*

### Functional Requirements

**Segurança e consentimento**

- **FR-001**: A loja MUST ter a opção "Permitir ações pelos assistentes", desligada por padrão, alterável por quem gerencia o MCP, com auditoria.
- **FR-002**: Ações MUST exigir conexão OAuth com o escopo `mcp:write` concedido no consentimento, por opção explícita e desmarcada por padrão. Tokens fixos (`rrf_mcp_`) MUST permanecer somente leitura.
- **FR-003**: Cada ação MUST verificar, no momento da chamada: loja com ações permitidas, conexão ativa com `mcp:write`, permissão atual do usuário (`finance.manage` ou `integrations.sales.manage`) e área de dados habilitada (Contas a pagar ou Vendas).
- **FR-004**: Tools de ação MUST ser anotadas como não somente leitura e MUST aparecer na listagem apenas quando todas as condições da FR-003 forem atendidas.
- **FR-005**: Toda ação MUST ser auditada nos registros já existentes (contas a pagar, importações) com o usuário da conexão, e registrada no uso do MCP com o cliente, a tool e o resultado, sem gravar valores sensíveis dos argumentos além do necessário.

**Contas a pagar**

- **FR-006**: O MCP MUST oferecer `criar_conta_a_pagar`, `registrar_pagamento_conta`, `editar_conta_a_pagar` e `cancelar_conta_a_pagar`, com os mesmos campos, validações e regras de negócio da tela.
- **FR-007**: Categoria, fornecedor e conta financeira MUST aceitar nome (sem diferenciar maiúsculas e acentos) ou id; nomes desconhecidos ou ambíguos MUST ser recusados com a lista de opções.
- **FR-008**: A criação MUST detectar provável duplicidade (descrição, valor e vencimento iguais, não cancelada) e exigir confirmação explícita.
- **FR-009**: A tool `contas_a_pagar` MUST passar a devolver o id de cada conta, para uso nas ações.

**Importação de vendas**

- **FR-010**: O MCP MUST oferecer `integracoes_de_vendas`, `importar_vendas_previa`, `importacao_status` e `importar_vendas_confirmar` para PagBank, Mercado Pago e iFood, com as opções da tela: período, atribuição (automática por valor ou produto fixo) e, no Mercado Pago, carga inicial de 30, 60 ou 90 dias.
- **FR-011**: A importação MUST manter as duas etapas (prévia e confirmação) e as mesmas regras (integração ativa, sem sobreposição, confirmação idempotente).
- **FR-012**: Execuções iniciadas pelo MCP MUST aparecer no histórico de importações identificadas como feitas pelo MCP e pelo usuário.

### Key Entities

- **Configuração MCP da loja**: ganha "ações permitidas" (sim/não).
- **Conexão OAuth**: escopo concedido passa a poder incluir `mcp:write`.
- **Chamada de tool**: registra se foi uma ação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nenhuma ação é executável com token fixo, sem consentimento de ações, com a loja sem ações permitidas ou sem a permissão do usuário — verificado em testes automatizados para cada combinação.
- **SC-002**: Uma conta criada pelo assistente é idêntica (campos, ocorrências, auditoria) à criada pela tela com os mesmos dados.
- **SC-003**: Uma importação feita pelo assistente gera as mesmas vendas que a tela para o mesmo período e atribuição, e confirmar duas vezes não duplica nada.
- **SC-004**: O usuário consegue lançar uma conta recorrente ou importar as vendas de um dia em uma conversa, sem abrir o sistema.
- **SC-005**: As ações são validadas em produção com pelo menos um cliente (Claude.ai ou ChatGPT).

## Assumptions

- Os clientes MCP (Claude, ChatGPT) pedem confirmação ao usuário antes de executar tools não somente leitura; o sistema não depende disso para a segurança.
- Conexões existentes continuam somente leitura até o usuário reconectar e marcar o consentimento de ações.
- Estorno de pagamento, criação de categorias e fornecedores, conexão e credenciais de integrações e a conciliação financeira do iFood ficam fora desta fase.
- Limite de ações: 30 por conexão por hora (além do limite geral do MCP).
