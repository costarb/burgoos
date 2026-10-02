# Feature Specification: Conectores de IA com Login (OAuth) no MCP por Loja

**Feature Branch**: `026-mcp-oauth-connectors`

**Created**: 2026-10-02

**Status**: Implemented (validado em produção em 2026-10-02 com Claude Code, ChatGPT e claude.ai)

**Input**: User description: "Fase 2 do MCP por loja: OAuth para usar o MCP pelos conectores do claude.ai web e do ChatGPT, sem precisar do mcp-remote nem de token no arquivo de configuração." Continuação da spec `025-store-mcp-server` (implementada e validada em produção em 2026-10-02).

## Contexto

Na fase 1, o usuário gera um token na tela **MCP / IA** e o cola num arquivo de configuração (Claude Desktop via `mcp-remote`, Claude Code, Cursor). Isso exige conhecimento técnico, não funciona nos conectores web (claude.ai, ChatGPT) e já causou erros na validação: token incompleto, URL de outro ambiente.

Na fase 2, o usuário cola apenas o **endereço do servidor MCP** no conector do assistente. O assistente abre uma tela de login do RRFive OS, o usuário entra com a conta que já usa no admin, escolhe a loja, autoriza o acesso e volta ao assistente já conectado. O MCP continua somente leitura, com as mesmas tools, áreas de dados, proteções e log de uso da fase 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conectar um assistente de IA só com o endereço do servidor (Priority: P1)

Como dono ou gestor da loja, eu quero adicionar o RRFive OS como conector no claude.ai (ou no Claude Desktop, mobile ou Code) informando apenas o endereço do servidor MCP, entrar com meu login do RRFive OS e começar a fazer perguntas, sem copiar token nem editar arquivo de configuração.

**Why this priority**: É o objetivo da fase. Remove a etapa técnica que causou os erros da fase 1 e habilita os clientes web e mobile, onde não existe arquivo de configuração.

**Independent Test**: No claude.ai, em Configurações → Conectores → Adicionar conector personalizado, informar `https://<api>/api/mcp`. Clicar em Conectar, entrar com um usuário administrador de uma loja com MCP habilitado, escolher a loja, autorizar, e confirmar que o conector aparece como conectado e responde "Qual foi o faturamento de setembro?" com os números da loja.

**Acceptance Scenarios**:

1. **Given** uma loja com MCP habilitado, **When** o usuário adiciona o endereço do servidor no conector e clica em conectar, **Then** o assistente abre a tela de autorização do RRFive OS no navegador.
2. **Given** a tela de autorização aberta e o usuário sem sessão no RRFive OS, **When** ele informa e-mail e senha válidos, **Then** segue para a escolha da loja. Credenciais inválidas mostram o mesmo erro da tela de login do admin.
3. **Given** um usuário já logado no admin no mesmo navegador, **When** a tela de autorização abre, **Then** ele vai direto para a escolha da loja, sem novo login.
4. **Given** a tela de escolha da loja, **When** ela é exibida, **Then** lista apenas as lojas que o usuário pode acessar **e** que têm MCP habilitado, mostrando quais áreas de dados cada uma libera. Se houver uma única loja elegível, ela já vem selecionada.
5. **Given** a tela de consentimento, **When** exibida, **Then** mostra claramente qual aplicativo está pedindo acesso (ex.: "Claude", "ChatGPT") e o domínio para onde o usuário será devolvido, a loja escolhida, que o acesso é somente leitura e quais áreas serão visíveis, com os botões **Autorizar** e **Cancelar**.
6. **Given** o usuário clica em **Autorizar**, **When** volta ao assistente, **Then** o conector fica conectado e as tools da loja escolhida ficam disponíveis, com as mesmas regras da fase 1 (áreas, limites, privacidade).
7. **Given** o usuário clica em **Cancelar**, **When** volta ao assistente, **Then** o conector não é conectado e nenhuma credencial é emitida.
8. **Given** nenhuma loja elegível (sem acesso ou MCP desabilitado em todas), **When** a tela de escolha abriria, **Then** o sistema explica o motivo e orienta a habilitar o MCP em **Configurações → MCP / IA**, sem permitir autorizar.
9. **Given** um usuário sem a permissão "Usar assistentes de IA", **When** ele faz login na tela de autorização, **Then** vê uma mensagem explicando que precisa dessa permissão (concedida por um administrador em Perfis), sem permitir autorizar.

---

### User Story 2 - Usar o mesmo endereço no ChatGPT (Priority: P1)

Como gestor, eu quero conectar o ChatGPT ao RRFive OS do mesmo jeito, para usar o assistente que eu preferir.

**Why this priority**: O pedido original cita o ChatGPT explicitamente. Usar o padrão de mercado (OAuth do protocolo MCP) atende os dois com a mesma implementação.

**Independent Test**: Adicionar o endereço do servidor como conector/app MCP no ChatGPT, autorizar com um usuário da loja e fazer uma pergunta sobre vendas.

**Acceptance Scenarios**:

1. **Given** o endereço do servidor MCP, **When** adicionado no ChatGPT, **Then** o ChatGPT descobre sozinho como autenticar, abre a mesma tela de autorização e conecta após o consentimento.
2. **Given** conexões ativas no Claude e no ChatGPT para a mesma loja, **When** o usuário revoga uma delas, **Then** a outra continua funcionando.

---

### User Story 3 - Ver e revogar conexões autorizadas (Priority: P1)

Como administrador da loja, eu quero ver quais assistentes estão conectados à loja, por qual usuário e desde quando, e poder desconectar qualquer um, para manter o controle de quem acessa os números.

**Why this priority**: Requisito de segurança equivalente à revogação de tokens da fase 1. Sem ele, uma conexão esquecida não poderia ser cortada.

**Independent Test**: Conectar o Claude via OAuth, abrir **Configurações → MCP / IA**, ver a conexão listada (aplicativo, usuário, data, último uso), revogar e confirmar que a próxima pergunta no Claude falha pedindo nova autorização.

**Acceptance Scenarios**:

1. **Given** conexões autorizadas para a loja, **When** o administrador abre a tela MCP / IA, **Then** vê uma lista "Conexões autorizadas" com aplicativo, usuário que autorizou, data da autorização, último uso e áreas visíveis.
2. **Given** uma conexão ativa, **When** o administrador a revoga, **Then** a próxima chamada desse assistente é recusada e ele precisa autorizar de novo. O evento é registrado na auditoria.
3. **Given** o MCP da loja desabilitado, **When** qualquer conexão autorizada faz uma chamada, **Then** a chamada é recusada, como acontece com os tokens da fase 1. Ao reabilitar, conexões não revogadas voltam a funcionar.
4. **Given** o usuário que autorizou a conexão é inativado ou perde o acesso à loja, **When** a conexão faz a próxima chamada, **Then** ela é recusada.
5. **Given** chamadas feitas por uma conexão OAuth, **When** o administrador abre a aba **Uso**, **Then** as chamadas aparecem identificadas pelo aplicativo e pelo usuário, junto com as chamadas por token da fase 1.

---

### User Story 4 - Continuar usando tokens da fase 1 (Priority: P2)

Como usuário da fase 1, eu quero que meus tokens e configurações atuais continuem funcionando, para não precisar reconfigurar nada.

**Why this priority**: Evita regressão para quem já usa Claude Desktop, Claude Code ou Cursor com token. Não traz valor novo, mas é obrigatório para a entrega.

**Independent Test**: Com um token da fase 1 configurado no Claude Desktop, após o deploy da fase 2, fazer uma pergunta e confirmar a resposta.

**Acceptance Scenarios**:

1. **Given** um token `rrf_mcp_` válido, **When** usado após a fase 2, **Then** funciona exatamente como antes.
2. **Given** uma requisição sem credencial, **When** recebida pelo servidor MCP, **Then** a resposta indica como obter autorização (para que os conectores iniciem o login), sem revelar dados da loja.
3. **Given** a tela MCP / IA, **When** exibida, **Then** apresenta primeiro a opção "Conectar pelo endereço" (fase 2), com o endereço do servidor e o passo a passo para Claude e ChatGPT, e mantém "Tokens de acesso" como opção avançada.

---

### Edge Cases

- **Sessão expirada no meio da autorização**: o usuário faz login de novo e continua do ponto em que estava, sem precisar reiniciar no assistente.
- **Pedido de autorização adulterado ou de origem desconhecida**: endereço de retorno não declarado pelo aplicativo, parâmetros obrigatórios ausentes ou aplicativo não identificável. O sistema mostra erro e não redireciona para o endereço informado.
- **Usuário com várias lojas**: escolhe uma loja por conexão. Para analisar outra loja, adiciona outro conector (mesmo endereço) e escolhe a outra loja no consentimento.
- **Credencial de acesso expirada**: o assistente renova automaticamente, sem novo login, enquanto a conexão não for revogada.
- **Credencial de renovação reutilizada** (sinal de vazamento): a conexão inteira é revogada por segurança e registrada na auditoria.
- **Muitas conexões**: limite de 20 conexões ativas por loja. Ao atingir o limite, a autorização é bloqueada com orientação para revogar conexões sem uso.
- **Administrador de plataforma**: não pode autorizar conectores para lojas, como já ocorre nas telas de loja.
- **Lentidão**: as etapas automáticas usadas pelo assistente precisam responder rápido. Os clientes desistem depois de cerca de 10 segundos.
- **Endereço do servidor com ou sem barra final**: o mesmo conector funciona com `…/api/mcp` e `…/api/mcp/`.

## Requirements *(mandatory)*

### Functional Requirements

**Descoberta e autorização**

- **FR-001**: O servidor MCP MUST responder requisições sem credencial com recusa padronizada que indique onde obter as informações de autorização, permitindo que os conectores iniciem o login sozinhos.
- **FR-002**: O sistema MUST publicar os metadados de autorização exigidos pelo protocolo MCP vigente (recurso protegido e servidor de autorização), de forma que Claude e ChatGPT descubram como se autenticar apenas a partir do endereço do servidor.
- **FR-003**: O sistema MUST atuar como servidor de autorização próprio, usando as contas de usuário do RRFive OS. Nenhum provedor externo de identidade é exigido.
- **FR-004**: O sistema MUST identificar o aplicativo solicitante pelos mecanismos aceitos por Claude e ChatGPT: documento público de identificação do aplicativo (preferencial) e, para compatibilidade, registro automático do aplicativo. O nome exibido no consentimento vem dessa identificação.
- **FR-005**: O sistema MUST aceitar apenas endereços de retorno declarados pelo aplicativo, incluindo os de aplicativos instalados no computador do usuário (porta local variável), e MUST exibir no consentimento o domínio de retorno.
- **FR-006**: O fluxo de autorização MUST seguir o padrão do protocolo MCP, com proteção contra interceptação do código de autorização e identificação do emissor na resposta, e as credenciais emitidas MUST valer apenas para o servidor MCP do RRFive OS.
- **FR-007**: A tela de autorização MUST exigir login com as credenciais do RRFive OS (reaproveitando a sessão do admin, se houver), listar só as lojas acessíveis com MCP habilitado, exibir aplicativo, domínio de retorno, loja, natureza somente leitura e áreas, e oferecer Autorizar e Cancelar.
- **FR-008**: Cada autorização MUST vincular a conexão a exatamente **uma loja**, escolhida pelo usuário no consentimento. A loja das chamadas vem só da conexão. Nenhuma tool aceita loja como parâmetro (mesma regra da fase 1).
- **FR-009**: A autorização MUST ser restrita a usuários com a nova permissão **"Usar assistentes de IA"** (`mcp.connect`), concedida automaticamente a proprietários, administradores e ao usuário master e atribuível a outros perfis. As áreas visíveis à conexão são as liberadas na configuração MCP da loja, independentemente das demais permissões do usuário no admin. Usuários sem a permissão veem, na tela de autorização, uma mensagem explicando que precisam dela.

**Credenciais e sessão**

- **FR-010**: O sistema MUST emitir credenciais de acesso de curta duração (1 hora) e credenciais de renovação (30 dias, renovadas a cada uso, com rotação). A reutilização de uma credencial de renovação já trocada MUST revogar a conexão.
- **FR-011**: O sistema MUST armazenar credenciais apenas de forma não reversível e nunca exibi-las na interface.
- **FR-012**: Cada chamada com credencial OAuth MUST ser recusada quando: a conexão foi revogada; a credencial expirou; o MCP da loja está desabilitado; a loja está inativa; ou o usuário que autorizou está inativo ou perdeu acesso à loja. A recusa MUST ser idêntica à da fase 1 e não revelar o motivo ao cliente.
- **FR-013**: O sistema MUST limitar a 20 as conexões OAuth ativas por loja.

**Gestão e auditoria**

- **FR-014**: A tela MCP / IA MUST listar as conexões autorizadas da loja (aplicativo, usuário, data, último uso, áreas) e permitir revogá-las individualmente, com efeito imediato.
- **FR-015**: O sistema MUST registrar na auditoria de acessos: autorização concedida, autorização negada pelo usuário, conexão revogada (manual ou por reutilização de credencial) e falha de identificação do aplicativo.
- **FR-016**: As chamadas feitas por conexões OAuth MUST aparecer no log de uso da fase 1, identificadas por aplicativo e usuário, com os mesmos filtros e a mesma retenção de 90 dias.
- **FR-017**: As tools, recursos, prompts, áreas de dados, limites de chamadas, timeout, proteção de memória e regras de privacidade da fase 1 MUST valer igualmente para conexões OAuth. O limite de chamadas MUST ser aplicado por conexão.

**Compatibilidade**

- **FR-018**: Tokens `rrf_mcp_` da fase 1 MUST continuar funcionando sem alteração.
- **FR-019**: A tela MCP / IA MUST apresentar o endereço do servidor e o passo a passo de conexão para claude.ai/Claude Desktop/mobile, Claude Code e ChatGPT como opção principal, mantendo os tokens como opção avançada.

### Key Entities

- **Aplicativo cliente**: assistente que pede acesso (ex.: Claude, ChatGPT). Identificador, nome exibido, endereços de retorno permitidos e origem da identificação (documento público ou registro automático).
- **Conexão autorizada**: vínculo entre um aplicativo, um usuário e uma loja, criado no consentimento. Áreas visíveis, data de autorização, último uso, situação (ativa, revogada) e motivo da revogação.
- **Código de autorização**: comprovante de uso único e curta duração, entregue ao aplicativo após o consentimento e trocado por credenciais.
- **Credenciais da conexão**: credencial de acesso (curta) e de renovação (longa, rotativa), guardadas de forma não reversível e vinculadas à conexão.
- **Registro de uso** (fase 1): passa a identificar também a conexão OAuth que fez a chamada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um gestor conecta o claude.ai ao RRFive OS em menos de 2 minutos, informando apenas o endereço do servidor e o próprio login, sem editar arquivos nem copiar tokens.
- **SC-002**: O mesmo endereço conecta com sucesso claude.ai, Claude Desktop, Claude Code e ChatGPT no roteiro de aceite.
- **SC-003**: 100% das chamadas após revogação da conexão, desabilitação do MCP, inativação do usuário ou perda de acesso à loja são recusadas.
- **SC-004**: Zero vazamento entre lojas: testes automatizados confirmam que uma conexão autorizada para a loja A nunca acessa dados da loja B, mesmo quando o usuário tem acesso a ambas.
- **SC-005**: Zero regressão para tokens da fase 1: a suíte de testes da fase 1 continua passando e um token existente segue funcionando em produção após o deploy.
- **SC-006**: As etapas automáticas de descoberta e de emissão/renovação de credenciais respondem em menos de 2 segundos em 95% dos casos.
- **SC-007**: Pedidos de autorização com endereço de retorno não declarado são recusados em 100% dos testes, sem redirecionamento.

## Assumptions

- O servidor de autorização é a própria API do RRFive OS, e a tela de autorização faz parte da aplicação web existente. As contas de usuário, perfis, lojas e regras de acesso atuais são reaproveitadas.
- Escopo de clientes: claude.ai (web, Desktop, mobile e Cowork compartilham o mesmo fluxo), Claude Code e ChatGPT. Cursor e outros clientes que seguem o padrão MCP devem funcionar, mas não fazem parte do roteiro de aceite.
- Publicação nos diretórios oficiais de conectores do Claude e do ChatGPT está fora de escopo. A conexão é feita como "conector personalizado" informando o endereço.
- Login por SSO corporativo, credenciais entre servidores (máquina a máquina) e acesso a várias lojas numa mesma conexão estão fora de escopo.
- A API em produção já está publicada com HTTPS em endereço acessível pela internet, condição exigida pelos conectores web.
- Durações padrão: acesso 1 hora, renovação 30 dias (rotativa), código de autorização 60 segundos, sessão de autorização 10 minutos.
