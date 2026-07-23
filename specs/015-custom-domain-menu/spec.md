# Feature Specification: Cardapio por dominio da loja

**Feature Branch**: `015-custom-domain-menu`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Configurar o dominio de cada loja e disponibilizar seu cardapio publico na rota fixa /cardapio, resolvendo a loja pelo dominio acessado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acessar cardapio pelo dominio (Priority: P1)

Como cliente de uma loja, quero abrir `/cardapio` no dominio comercial da loja para visualizar o cardapio correto sem conhecer um identificador interno no endereco.

**Why this priority**: Esta e a experiencia publica principal e elimina a dependencia do slug na URL divulgada aos clientes.

**Independent Test**: Cadastrar um dominio para uma loja ativa, acessar esse dominio com o caminho `/cardapio` e confirmar que nome, identidade visual, produtos e disponibilidade pertencem exclusivamente a essa loja.

**Acceptance Scenarios**:

1. **Given** uma loja ativa com o dominio `dogaodomounjaro.com.br`, **When** um cliente acessa `https://dogaodomounjaro.com.br/cardapio`, **Then** o sistema exibe o cardapio publico dessa loja.
2. **Given** duas lojas ativas com dominios diferentes, **When** `/cardapio` e acessado em cada dominio, **Then** cada acesso exibe somente os dados da loja associada ao respectivo dominio.
3. **Given** um dominio sem loja ativa associada, **When** `/cardapio` e acessado, **Then** o sistema informa que o cardapio nao foi encontrado e nao exibe dados de outra loja.

---

### User Story 2 - Configurar dominio da loja (Priority: P2)

Como administrador da plataforma, quero cadastrar e alterar o dominio publico de uma loja para ativar o endereco de cardapio correto sem alterar o slug operacional existente.

**Why this priority**: A associacao confiavel entre dominio e loja e necessaria para suportar multiplos estabelecimentos com isolamento.

**Independent Test**: Abrir a manutencao de uma loja, informar um dominio valido, salvar e confirmar que ele aparece no detalhe e passa a resolver o cardapio dessa loja.

**Acceptance Scenarios**:

1. **Given** uma loja sem dominio, **When** um administrador cadastra um dominio valido e exclusivo, **Then** o dominio fica associado a essa loja.
2. **Given** um dominio ja associado a outra loja, **When** um administrador tenta reutiliza-lo, **Then** o sistema rejeita a operacao e informa o conflito.
3. **Given** um valor contendo protocolo, caminho ou caracteres invalidos, **When** o administrador tenta salvar, **Then** o sistema rejeita a configuracao e orienta informar apenas o dominio.
4. **Given** uma loja com dominio configurado, **When** o dominio e removido, **Then** novos acessos por esse dominio deixam de resolver a loja sem afetar seu slug.

---

### User Story 3 - Concluir pedido no endereco amigavel (Priority: P3)

Como cliente que entrou pelo dominio da loja, quero montar o carrinho e concluir o pedido permanecendo no endereco publico da mesma loja.

**Why this priority**: O cardapio somente gera valor completo se o fluxo de compra preservar a loja correta ate a confirmacao.

**Independent Test**: Acessar `/cardapio`, adicionar itens, enviar o pedido e abrir sua confirmacao sem navegar para o slug de outra rota publica.

**Acceptance Scenarios**:

1. **Given** um cliente no cardapio resolvido por dominio, **When** ele conclui um pedido, **Then** o pedido e criado para a mesma loja associada ao dominio.
2. **Given** um pedido concluido pelo cardapio por dominio, **When** a confirmacao e exibida, **Then** o cliente permanece no dominio da loja e nao precisa conhecer o slug.

### Edge Cases

- O dominio deve ser comparado sem diferenca entre letras maiusculas e minusculas, sem porta e sem ponto final.
- O prefixo `www.` deve resolver a mesma loja do dominio principal e nao pode ser cadastrado separadamente para outra loja.
- Cabecalhos de encaminhamento com multiplos valores ou valores malformados nao podem permitir escolher arbitrariamente outra loja.
- Loja inativa ou dominio removido nao pode continuar publicando o cardapio por cache.
- A rota legada por slug deve permanecer funcional durante a transicao para nao quebrar links ja divulgados.
- Dominios internos da plataforma e enderecos locais de desenvolvimento nao devem ser associados acidentalmente a uma loja em producao.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um administrador da plataforma cadastre, altere e remova o dominio publico de uma loja.
- **FR-002**: O sistema MUST armazenar o dominio de forma normalizada, sem protocolo, porta, caminho, parametros ou fragmentos.
- **FR-003**: O sistema MUST impedir que o mesmo dominio normalizado, incluindo sua variacao com ou sem `www.`, seja associado a mais de uma loja.
- **FR-004**: O sistema MUST resolver a loja ativa a partir do dominio recebido quando a rota publica `/cardapio` for acessada.
- **FR-005**: O sistema MUST exibir somente dados pertencentes a loja resolvida pelo dominio.
- **FR-006**: O sistema MUST retornar uma resposta de cardapio nao encontrado quando o dominio nao estiver associado a uma loja ativa.
- **FR-007**: O sistema MUST preservar a loja resolvida por dominio durante criacao e confirmacao de pedidos publicos.
- **FR-008**: O sistema MUST aceitar o dominio principal e sua variacao com `www.` como enderecos da mesma loja.
- **FR-009**: O sistema MUST manter a rota publica legada baseada em slug durante a transicao.
- **FR-010**: O sistema MUST aplicar alteracoes de dominio sem exigir uma nova versao da aplicacao.
- **FR-011**: O sistema MUST invalidar ou atualizar respostas publicas armazenadas quando uma loja for desativada ou seu dominio for alterado.
- **FR-012**: O sistema MUST registrar alteracoes de dominio com o administrador responsavel e o momento da operacao na trilha de auditoria existente da loja.
- **FR-013**: O sistema MUST apresentar o endereco final do cardapio na manutencao da loja para facilitar sua validacao.

### Key Entities

- **Loja**: Estabelecimento isolado que possui slug operacional, status e, opcionalmente, um dominio publico exclusivo.
- **Dominio publico**: Nome de host normalizado que identifica uma unica loja e define qual cardapio sera exibido em `/cardapio`.
- **Pedido publico**: Pedido criado a partir do cardapio, sempre associado a mesma loja resolvida no inicio do fluxo.
- **Evento de auditoria**: Registro da inclusao, alteracao ou remocao do dominio da loja.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos testes com dominios cadastrados, acessar `/cardapio` exibe a loja correta sem informar slug no caminho.
- **SC-002**: Em 100% das tentativas de duplicar um dominio entre lojas, a configuracao e bloqueada antes da publicacao.
- **SC-003**: Um administrador consegue cadastrar ou trocar o dominio de uma loja em menos de 2 minutos pela manutencao existente.
- **SC-004**: Alteracoes de dominio ou status da loja deixam de servir o cardapio anterior em ate 60 segundos.
- **SC-005**: Links legados por slug continuam funcionando durante a transicao, sem regressao no fluxo de pedidos.
- **SC-006**: Em testes com ao menos tres lojas e dominios distintos, nenhum cardapio, carrinho ou pedido apresenta dados cruzados entre estabelecimentos.

## Assumptions

- Cada loja possui no maximo um dominio principal nesta primeira entrega.
- A configuracao inicial do dominio e responsabilidade de administradores da plataforma, seguindo a manutencao de lojas ja existente.
- O slug continua sendo o identificador interno e o mecanismo de compatibilidade para URLs antigas.
- A loja ou seu responsavel configura DNS e aponta o dominio para a infraestrutura da aplicacao; provisionamento de DNS nao faz parte desta entrega.
- Certificados HTTPS e encaminhamento do dominio ate a aplicacao sao responsabilidades da infraestrutura de hospedagem.
- O dominio principal e sua variacao com `www.` representam a mesma loja.
- A rota `/cardapio` e reservada para a experiencia publica e nao pode ser utilizada como slug de loja.
