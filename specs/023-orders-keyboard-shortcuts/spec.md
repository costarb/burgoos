# Feature Specification: Navegação e Ações por Teclado na Fila de Pedidos

**Feature Branch**: `023-orders-keyboard-shortcuts`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Quero ter funções via teclado para executar acoes na tela de pedidos (admin/orders), algo para agilizar o operacional, por exemplo, selecionar pedido, avancar de fase, cancelar. Avaliar e sugerir uma dinamica para esta tela, com o objetivo de facilitar o manuseio em uma operação dinamica."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar pela fila de pedidos sem usar o mouse (Priority: P1)

Como operador da fila de pedidos, eu quero mover a seleção entre os pedidos usando o teclado (sem precisar clicar com o mouse), para conseguir trabalhar mais rápido durante o pico de movimento.

**Why this priority**: É a base de tudo — sem uma forma clara de saber e mudar "qual pedido está selecionado", nenhuma ação por teclado (avançar, cancelar, cobrar) pode ser aplicada com segurança ao pedido certo.

**Independent Test**: Com vários pedidos ativos nas 4 colunas (Novo, Preparando, Pronto, Saiu), usar `Tab`/`Shift+Tab` (ou `Espaço`) e confirmar que a seleção se move de forma visível e previsível entre os pedidos, do mais antigo para o mais novo, cruzando as colunas.

**Acceptance Scenarios**:

1. **Given** a tela de pedidos com múltiplos pedidos ativos em colunas diferentes, **When** o operador pressiona `Tab`, **Then** a seleção passa para o próximo pedido mais antigo da fila (podendo estar em outra coluna), com destaque visual claro (contorno de alto contraste + selo de posição, ex. "3/14") aplicado ao card correspondente.
2. **Given** um pedido selecionado, **When** o operador pressiona `Shift+Tab`, **Then** a seleção volta para o pedido anterior da fila.
3. **Given** a tela recém-carregada sem nenhuma seleção, **When** o operador pressiona `Tab` pela primeira vez, **Then** o pedido mais antigo de toda a fila é selecionado.
4. **Given** um pedido selecionado, **When** o operador pressiona uma tecla de `1` a `4`, **Then** a seleção pula para o primeiro (mais antigo) pedido da coluna correspondente (1=Novo, 2=Preparando, 3=Pronto, 4=Saiu), caso essa coluna tenha pedidos.
5. **Given** um pedido selecionado que não está totalmente visível na tela, **When** a seleção muda para ele, **Then** a tela rola automaticamente para mantê-lo visível.
6. **Given** um pedido selecionado, **When** o operador pressiona `Esc`, **Then** a seleção é removida (nenhum card fica destacado).

---

### User Story 2 - Avançar a fase do pedido selecionado sem usar o mouse (Priority: P1)

Como operador, eu quero avançar o pedido selecionado para a próxima fase (ou aceitar um pedido iFood pendente) apertando uma única tecla, para não precisar mirar o cursor no botão certo repetidamente durante o corre.

**Why this priority**: É a ação mais repetida no dia a dia da fila (mover pedidos de Novo → Preparando → Pronto → Saiu/Entregue); ganhar velocidade aqui é o principal valor pedido.

**Independent Test**: Selecionar um pedido normal e pressionar `F2`; confirmar que ele muda de status exatamente como o botão de avanço já fazia, e que a seleção passa automaticamente para o próximo pedido mais antigo da fila.

**Acceptance Scenarios**:

1. **Given** um pedido normal (não iFood pendente) selecionado, **When** o operador pressiona `F2`, **Then** o pedido avança para a mesma próxima fase que o botão de avanço da tela já aplicaria, e a seleção passa automaticamente para o próximo pedido mais antigo da fila (se houver).
2. **Given** um pedido iFood aguardando aceite selecionado, **When** o operador pressiona `F2`, **Then** o pedido é aceito (mesmo efeito do botão "Aceitar iFood" já existente).
3. **Given** um pedido cuja atualização de fase está em andamento (chamada à API em curso), **When** o operador pressiona `F2` novamente antes da resposta, **Then** a segunda pressão é ignorada até a primeira operação terminar (sem disparar duas mudanças de status concorrentes).
4. **Given** um pedido selecionado, **When** a atualização de fase falha (erro de rede/servidor), **Then** a mensagem de erro já usada pela tela é exibida e a seleção permanece no mesmo pedido, permitindo tentar de novo.
5. **Given** nenhum pedido selecionado, **When** o operador pressiona `F2`, **Then** nada acontece (sem erro visível).

---

### User Story 3 - Cancelar/recusar o pedido selecionado com uma trava contra toque acidental (Priority: P2)

Como operador, eu quero cancelar (ou recusar, no caso de um pedido iFood pendente) o pedido selecionado pelo teclado, mas com uma confirmação rápida, para não correr o risco de cancelar um pedido por engano ao apertar a tecla errada.

**Why this priority**: É uma ação necessária no fluxo, mas menos frequente que avançar fase, e por ser destrutiva e irreversível para o cliente precisa vir depois de garantir que a seleção (US1) e a ação positiva (US2) já funcionam bem.

**Independent Test**: Selecionar um pedido e pressionar `F3` uma vez; confirmar que o pedido NÃO é cancelado ainda e que a tela mostra um aviso pedindo confirmação; pressionar `F3` de novo dentro do tempo limite e confirmar que o pedido é cancelado.

**Acceptance Scenarios**:

1. **Given** um pedido normal selecionado, **When** o operador pressiona `F3` pela primeira vez, **Then** o pedido NÃO é cancelado ainda, e a tela exibe um aviso visível pedindo para apertar `F3` novamente para confirmar.
2. **Given** o aviso de confirmação de cancelamento visível, **When** o operador pressiona `F3` novamente dentro de 2 segundos, **Then** o pedido é cancelado (mesmo efeito do botão "Cancelado" já existente) e o aviso desaparece.
3. **Given** o aviso de confirmação de cancelamento visível, **When** se passam mais de 2 segundos sem uma segunda pressão de `F3`, **Then** a confirmação pendente expira automaticamente e uma nova pressão de `F3` volta a exigir duas confirmações.
4. **Given** o aviso de confirmação de cancelamento visível para um pedido, **When** o operador pressiona `Esc`, muda a seleção para outro pedido, ou pressiona qualquer tecla de ação diferente de `F3`, **Then** a confirmação pendente é cancelada sem cancelar o pedido.
5. **Given** um pedido iFood aguardando aceite selecionado, **When** o operador confirma `F3` duas vezes, **Then** o fluxo de recusa é aplicado (mesmo efeito do botão "Recusar" já existente) — se esse fluxo hoje exige informar um motivo, o comportamento de exigir o motivo é preservado.

---

### User Story 4 - Cobrar o pedido selecionado com uma tecla (Priority: P3)

Como operador, eu quero acionar a cobrança do pedido selecionado com uma tecla, para os casos em que o próximo passo operacional é receber o pagamento, sem precisar localizar o botão com o mouse.

**Why this priority**: É um atalho de conveniência para um fluxo que já existe e já funciona por clique; tem menor prioridade que navegar/avançar/cancelar porque nem todo pedido está pronto pra cobrança no momento em que está sendo trabalhado.

**Independent Test**: Selecionar um pedido elegível para cobrança (sem comanda vinculada) e pressionar `F4`; confirmar que o mesmo diálogo de cobrança que o botão "Cobrar" abre é exibido.

**Acceptance Scenarios**:

1. **Given** um pedido selecionado que hoje mostra o botão "Cobrar" (sem comanda vinculada), **When** o operador pressiona `F4`, **Then** o diálogo de cobrança é aberto para esse pedido, com o mesmo comportamento do clique no botão.
2. **Given** um pedido selecionado que hoje mostra "Cobrar na comanda" (vinculado a uma comanda, é um link de navegação), **When** o operador pressiona `F4`, **Then** nada acontece (o atalho não navega para fora da tela sem ação explícita do operador).

---

### Edge Cases

- O que acontece se o foco do navegador estiver dentro de um campo de texto/seleção já existente na tela (ex.: motivo de recusa do iFood, formulário de transferência de responsável)? As teclas de atalho (`Tab` continua com seu comportamento padrão de navegação de formulário nesse caso; `F2`/`F3`/`F4`) não devem disparar ações da fila enquanto o operador está digitando ali.
- O que acontece se um modal estiver aberto (Manutenção do pedido, Cobrança, formulário de recusa)? Os atalhos da fila ficam inativos até o modal ser fechado, para não disparar ações "por trás" do modal.
- O que acontece se o pedido selecionado sair da fila enquanto está selecionado (porque outra pessoa/dispositivo avançou ou cancelou esse mesmo pedido, atualização chega via tempo real)? A seleção deve se mover automaticamente para um pedido válido (o próximo mais próximo na fila) em vez de ficar "presa" em um pedido que não existe mais na tela.
- O que acontece se a fila estiver vazia (nenhum pedido ativo)? Nenhuma tecla de ação tem efeito, e nenhum destaque de seleção é mostrado.
- O que acontece se o operador pressionar `1`-`4` para uma coluna que não tem nenhum pedido no momento? A seleção não muda (permanece onde estava), sem erro visível.
- O que acontece durante a atualização em tempo real (novo pedido chega, outro pedido muda de status) enquanto o operador está navegando? A posição relativa do pedido selecionado (por identidade do pedido, não por posição numérica) deve ser preservada sempre que esse pedido continuar na fila.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir selecionar um pedido da fila usando o teclado (`Tab` avança, `Shift+Tab` volta), percorrendo todos os pedidos ativos das 4 colunas em uma única ordem, do mais antigo para o mais novo.
- **FR-002**: O sistema MUST destacar visualmente o pedido selecionado de forma clara e distinta de outros estados visuais já existentes no card (ex.: pedido atrasado), incluindo um indicador de posição na fila (ex.: "3/14").
- **FR-003**: O sistema MUST permitir pular a seleção diretamente para o primeiro pedido de uma das 4 colunas usando as teclas `1` a `4`.
- **FR-004**: O sistema MUST rolar a tela automaticamente para manter o pedido selecionado visível sempre que a seleção mudar.
- **FR-005**: O sistema MUST permitir limpar a seleção atual com a tecla `Esc`.
- **FR-006**: O sistema MUST permitir executar a ação primária do pedido selecionado (avançar fase, ou aceitar quando for um pedido iFood pendente) com a tecla `F2`, produzindo o mesmo resultado que o botão equivalente já existente na tela.
- **FR-007**: Após executar a ação primária com sucesso, o sistema MUST mover a seleção automaticamente para o próximo pedido mais antigo da fila, quando existir algum.
- **FR-008**: O sistema MUST permitir executar a ação destrutiva do pedido selecionado (cancelar, ou recusar quando for um pedido iFood pendente) com a tecla `F3`, exigindo duas pressões de `F3` dentro de uma janela de 2 segundos antes de aplicar a ação, com um aviso visível na primeira pressão.
- **FR-009**: O sistema MUST cancelar a confirmação pendente de `F3` (sem aplicar a ação) quando o operador pressionar `Esc`, mudar a seleção, ou deixar passar mais de 2 segundos sem confirmar.
- **FR-010**: O sistema MUST permitir abrir a cobrança do pedido selecionado com a tecla `F4`, apenas quando esse pedido hoje oferece o botão "Cobrar" (não vinculado a comanda), produzindo o mesmo resultado que o clique nesse botão.
- **FR-011**: O sistema MUST ignorar todas as teclas de atalho da fila (`F2`, `F3`, `F4`, `1`-`4`) enquanto o foco do navegador estiver em um campo de texto, seleção ou área de texto já existente na tela, ou enquanto um modal (Manutenção, Cobrança, formulário de recusa) estiver aberto.
- **FR-012**: O sistema MUST reidentificar o pedido selecionado por sua identidade (não por posição no array), preservando a seleção corretamente quando a lista de pedidos é atualizada em tempo real; se o pedido selecionado deixar de existir na fila (foi concluído/cancelado em outro dispositivo, por exemplo), o sistema MUST mover a seleção automaticamente para um pedido válido.
- **FR-013**: O sistema MUST manter uma área fixa e sempre visível na tela mostrando qual pedido está selecionado (identificação básica: código/cliente/status/posição) e o significado atual de cada tecla de atalho (`F2`, `F3`, `F4`) para aquele pedido específico.
- **FR-014**: O sistema MUST exibir a mesma mensagem de sucesso/erro já usada pela tela ao executar qualquer ação disparada por atalho de teclado (avançar, cancelar, aceitar, recusar, cobrar).

### Key Entities *(include if feature involves data)*

- **Seleção de Pedido**: representa qual pedido da fila está atualmente em foco para receber ações de teclado; identificada pelo ID do pedido (não pela posição), com uma posição derivada (índice/total) usada apenas para exibição.
- **Confirmação Pendente de Cancelamento**: estado temporário (até 2 segundos) que indica que a primeira pressão de `F3` foi recebida para um pedido específico e aguarda uma segunda pressão para efetivar o cancelamento/recusa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um operador consegue mover um pedido da fase "Novo" até "Saiu/Entregue" usando somente o teclado (sem tocar no mouse), em uma sequência de `Tab`/`F2` por pedido.
- **SC-002**: O pedido selecionado é identificável visualmente em menos de 1 segundo de observação da tela, mesmo em uma fila com muitos pedidos simultâneos.
- **SC-003**: Nenhum cancelamento/recusa acontece com uma única pressão acidental de `F3` — é sempre necessária uma confirmação explícita em até 2 segundos.
- **SC-004**: O uso dos atalhos de teclado não interfere em nenhum campo de texto, formulário ou modal já existente na tela (nenhuma ação da fila é disparada enquanto o operador está digitando ou com um modal aberto).
- **SC-005**: A seleção nunca aponta para um pedido que não existe mais na fila, mesmo com atualizações em tempo real ocorrendo durante o uso.

## Assumptions

- A tela roda em um navegador padrão (não necessariamente em modo kiosk/fullscreen dedicado); por isso os atalhos usam `Tab`, `Espaço`, `Esc`, `1`-`4` e `F2`/`F3`/`F4` — evitando `F1`, que é frequentemente interceptado pelo navegador antes de chegar à aplicação.
- As ações disparadas por atalho (avançar, cancelar, aceitar, recusar, cobrar) reaproveitam exatamente as mesmas regras de negócio, permissões e validações que os botões equivalentes já aplicam hoje — esta feature não cria nenhuma nova regra de negócio, apenas uma nova forma de disparar as regras existentes.
- O formulário de recusa de pedido iFood (motivo) continua exigido normalmente quando acionado via `F3`; a confirmação dupla do `F3` decide se o formulário abre ou não, não substitui o preenchimento do motivo.
- Esta funcionalidade afeta apenas a tela de fila de pedidos (`admin/orders`); outras telas operacionais (PDV, comandas) não são alteradas por esta especificação.
- Usuários que preferem usar o mouse continuam podendo usar todos os botões existentes normalmente — os atalhos são um caminho adicional, não uma substituição obrigatória.
