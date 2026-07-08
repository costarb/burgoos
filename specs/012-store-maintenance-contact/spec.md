# Feature Specification: Manutencao de lojas e dados publicos

**Feature Branch**: `012-store-maintenance-contact`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Ter uma tela de manutencao para criacao, alteracao, desativacao de lojas. Nos dados de cadastro das lojas garantir que tenha dados como endereco, telefone, Midias sociais (Facebook, Instagram,...). Essas informacoes da loja devem aparecer no footer do cardapio, bem como os links para as midias sociais, caso estejam preenchidos."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Manter cadastro de lojas (Priority: P1)

Um administrador de plataforma precisa consultar lojas existentes, criar uma nova loja e alterar dados principais como nome, slug, telefone e status ativo/inativo.

**Why this priority**: Sem essa manutencao, a criacao e correcao de tenants depende de operacao tecnica.

**Independent Test**: Acessar a lista de lojas, criar uma loja, abrir o detalhe, alterar nome/slug/status e confirmar que a lista reflete os novos dados.

**Acceptance Scenarios**:

1. **Given** um administrador autenticado, **When** cria uma loja com nome, slug, telefone e responsavel, **Then** a loja aparece na listagem e fica disponivel para configuracao.
2. **Given** uma loja existente, **When** o administrador altera nome, slug, telefone ou status, **Then** os dados atualizados sao persistidos e exibidos no detalhe.
3. **Given** uma loja que nao deve operar, **When** o administrador desmarca loja ativa, **Then** a loja fica inativa sem ser excluida.

---

### User Story 2 - Registrar contato e presenca digital (Priority: P2)

Um administrador de plataforma precisa manter endereco e links de midias sociais da loja para que o cardapio publico apresente informacoes confiaveis de contato.

**Why this priority**: Endereco e canais sociais fazem parte da identidade publica da loja e reduzem duvidas do cliente final.

**Independent Test**: Preencher endereco, Instagram, Facebook e site no detalhe da loja e verificar que os dados ficam salvos.

**Acceptance Scenarios**:

1. **Given** uma loja existente, **When** o administrador preenche endereco, cidade, UF e CEP, **Then** o detalhe mostra o endereco salvo.
2. **Given** uma loja existente, **When** o administrador preenche links sociais validos, **Then** os links ficam disponiveis para exibicao publica.
3. **Given** campos sociais vazios, **When** a loja e salva, **Then** links vazios nao aparecem no cardapio.

---

### User Story 3 - Exibir dados publicos no cardapio (Priority: P3)

Um consumidor que acessa o cardapio publico precisa visualizar no rodape o telefone, endereco e links sociais preenchidos pela loja.

**Why this priority**: O cardapio vira tambem uma pagina publica da loja, principalmente quando pedidos estao desativados.

**Independent Test**: Publicar dados de contato de uma loja e acessar o cardapio publico para confirmar o footer.

**Acceptance Scenarios**:

1. **Given** uma loja com telefone e endereco preenchidos, **When** o consumidor acessa o cardapio, **Then** o footer mostra telefone e endereco.
2. **Given** uma loja com Instagram/Facebook/site preenchidos, **When** o consumidor acessa o cardapio, **Then** o footer mostra links clicaveis para esses canais.
3. **Given** uma loja sem redes sociais preenchidas, **When** o consumidor acessa o cardapio, **Then** o footer nao mostra links vazios.

### Edge Cases

- Slug duplicado deve ser recusado com mensagem clara.
- Slugs reservados para rotas internas devem continuar bloqueados.
- Links sociais vazios ou compostos apenas por espacos devem ser tratados como ausentes.
- Uma loja inativa nao deve aparecer como cardapio publico ativo.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir listar lojas com identificacao, slug, status ativo/inativo e situacao operacional.
- **FR-002**: O sistema MUST permitir criar uma loja com nome, slug, telefone, modo inicial de operacao e usuario responsavel.
- **FR-003**: O sistema MUST permitir alterar nome, slug, telefone, status ativo/inativo e modo de abertura de uma loja.
- **FR-004**: O sistema MUST permitir cadastrar endereco da loja com logradouro, numero, complemento, bairro, cidade, UF e CEP.
- **FR-005**: O sistema MUST permitir cadastrar links de Instagram, Facebook, WhatsApp e site da loja.
- **FR-006**: O sistema MUST exibir no footer do cardapio publico telefone, endereco e links sociais somente quando preenchidos.
- **FR-007**: O sistema MUST validar unicidade e formato de slug antes de salvar.
- **FR-008**: O sistema MUST preservar historico logico de desativacao por status, sem exclusao fisica da loja.

### Key Entities

- **Loja**: Tenant operacional com nome publico, slug, telefone, status, dados de abertura, endereco e midias sociais.
- **Endereco da loja**: Dados publicos de localizacao usados no detalhe administrativo e no footer do cardapio.
- **Links sociais**: Canais publicos opcionais usados como links no footer do cardapio.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Administradores conseguem criar uma nova loja em menos de 3 minutos.
- **SC-002**: Administradores conseguem alterar dados cadastrais e contato de uma loja em menos de 2 minutos.
- **SC-003**: 100% dos links sociais vazios deixam de aparecer no footer publico.
- **SC-004**: Consumidores visualizam os dados de contato preenchidos no primeiro carregamento do cardapio.

## Assumptions

- A manutencao e restrita a administradores de plataforma ja autenticados.
- Desativar loja significa impedir disponibilidade publica, nao apagar dados historicos.
- Instagram, Facebook, WhatsApp e site cobrem o primeiro conjunto de canais sociais; novos canais poderao ser adicionados depois.
- O cadastro existente de lojas sera evoluido em vez de criar uma area paralela.
