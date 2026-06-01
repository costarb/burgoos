# Feature Specification: Cadastro de Lojas e Personalizacao Visual

**Feature Branch**: `003-store-onboarding-branding`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "Quero seguir nessa linha, o proposito é configurar novas lojas. Nessa configuração, quero ter opção de configurar layout das telas, para conter logo, estilo de cor e se possivel layout."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar uma nova loja operacional (Priority: P1)

Como administrador da plataforma, quero cadastrar uma nova loja com seus dados principais e um usuario responsavel, para que uma operacao possa acessar o admin, configurar seu cardapio e receber pedidos sem depender de seed ou ajuste manual.

**Why this priority**: Sem cadastro de loja via tela, cada nova operacao depende de intervencao tecnica e o produto nao consegue evoluir para varias lojas piloto.

**Independent Test**: Cadastrar uma nova loja informando nome, slug publico, telefone, status operacional e dados do responsavel; acessar o admin com o responsavel criado e confirmar que a loja aparece isolada das demais.

**Acceptance Scenarios**:

1. **Given** um administrador da plataforma autenticado, **When** ele cadastra uma loja com dados validos e um responsavel inicial, **Then** a loja fica disponivel para acesso administrativo e consulta publica pelo slug configurado.
2. **Given** uma loja cadastrada, **When** o responsavel inicial acessa o admin, **Then** ele visualiza somente dados da sua propria loja.
3. **Given** um slug ja usado por outra loja, **When** o administrador tenta cadastrar uma nova loja com o mesmo slug, **Then** o sistema bloqueia o cadastro e orienta a escolher outro slug.
4. **Given** uma loja inativa, **When** alguem tenta acessar suas telas publicas ou administrativas, **Then** o sistema impede o uso operacional da loja.

---

### User Story 2 - Configurar identidade visual da loja (Priority: P1)

Como dono ou gestor da loja, quero configurar logo, cores e informacoes visuais da minha marca, para que o menu publico e as telas de atendimento parecam pertencer a minha operacao.

**Why this priority**: A identidade visual aumenta confianca do cliente final e permite que cada loja tenha presenca propria sem alterar o produto para cada caso.

**Independent Test**: Configurar logo e paleta de cores de uma loja, salvar e abrir o menu publico para verificar que a marca aparece nas telas principais.

**Acceptance Scenarios**:

1. **Given** uma loja cadastrada, **When** o gestor envia ou seleciona um logo valido, **Then** o logo fica associado a loja e aparece nas telas configuradas.
2. **Given** uma loja cadastrada, **When** o gestor define cores principais e de destaque, **Then** o sistema aplica essas cores em elementos visuais da experiencia da loja.
3. **Given** cores com contraste insuficiente, **When** o gestor tenta salvar a configuracao, **Then** o sistema alerta o problema e oferece uma alternativa segura ou impede a publicacao.
4. **Given** uma loja sem personalizacao visual, **When** suas telas sao abertas, **Then** o sistema usa uma identidade padrao consistente e funcional.

---

### User Story 3 - Escolher layout das telas da loja (Priority: P2)

Como gestor da loja, quero escolher entre opcoes simples de layout para o menu publico e telas operacionais, para adequar a experiencia ao estilo da marca e ao volume de informacoes da operacao.

**Why this priority**: Layouts predefinidos permitem personalizacao com baixo risco, mantendo usabilidade e evitando que cada loja precise de uma tela sob medida.

**Independent Test**: Alternar entre layouts disponiveis, visualizar uma previa e publicar a opcao escolhida sem quebrar a navegacao do menu publico.

**Acceptance Scenarios**:

1. **Given** layouts disponiveis para menu publico, **When** o gestor escolhe um layout e salva, **Then** o menu publico passa a usar essa composicao.
2. **Given** uma configuracao de layout, **When** o gestor abre a previsualizacao, **Then** ele consegue ver a aparencia antes de publicar.
3. **Given** uma loja com muitos produtos e categorias, **When** um layout compacto e selecionado, **Then** os produtos continuam legiveis e navegaveis em celular e desktop.
4. **Given** um layout removido ou indisponivel, **When** a loja e aberta, **Then** o sistema usa automaticamente um layout padrao.

---

### User Story 4 - Revisar, publicar e restaurar configuracoes visuais (Priority: P3)

Como administrador ou gestor, quero revisar mudancas visuais antes de publica-las e restaurar uma configuracao anterior quando necessario, para reduzir risco de deixar a loja com aparencia quebrada ou fora da marca.

**Why this priority**: Publicacao controlada e restauracao aumentam confianca, mas podem vir depois do cadastro e personalizacao basica.

**Independent Test**: Alterar logo, cores e layout em modo rascunho, publicar a configuracao e depois restaurar a configuracao anterior.

**Acceptance Scenarios**:

1. **Given** uma configuracao visual publicada, **When** o gestor cria alteracoes, **Then** as mudancas podem permanecer como rascunho ate serem publicadas.
2. **Given** uma configuracao visual publicada por engano, **When** o gestor escolhe restaurar a versao anterior, **Then** o menu volta a exibir a identidade anterior.
3. **Given** uma mudanca publicada, **When** o historico e consultado, **Then** o sistema mostra quem publicou e quando.

### Edge Cases

- Slug da loja com caracteres invalidos, espacos, acentos ou conflito com rotas reservadas.
- Responsavel inicial com e-mail ja usado em outra loja ou em outro papel.
- Loja criada sem logo, sem cores ou sem layout escolhido.
- Logo com formato invalido, arquivo muito grande, imagem ilegivel ou fundo transparente que prejudica contraste.
- Cores escolhidas que tornam textos, botoes ou alertas pouco legiveis.
- Layout selecionado que nao se adapta bem a poucos produtos, muitos produtos ou muitas categorias.
- Alteracao visual salva enquanto existem pedidos em andamento.
- Loja inativada com pedidos historicos e relatorios existentes.
- Tentativa de acessar dados ou personalizacao de outra loja.
- Falha ao carregar logo ou recurso visual publicado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized platform administrators to create, view, edit, activate/deactivate and search stores.
- **FR-002**: System MUST capture store identity data including public name, public slug, contact phone, operational status and active/inactive state.
- **FR-003**: System MUST create or associate an initial responsible admin user when a store is created.
- **FR-004**: System MUST prevent duplicate public slugs and reject slugs that are invalid or reserved.
- **FR-005**: System MUST keep each store's catalog, orders, financial data, stock data and visual settings isolated from every other store.
- **FR-006**: System MUST allow authorized users to configure store branding, including logo, primary color, accent color and neutral/background preference.
- **FR-007**: System MUST validate visual settings for basic usability, including readable contrast for text and key actions.
- **FR-008**: System MUST provide safe default branding for stores that have not configured logo, colors or layout.
- **FR-009**: System MUST allow authorized users to choose from approved layout options for the public menu experience.
- **FR-010**: System MUST provide a preview of branding and layout changes before they affect the public customer experience.
- **FR-011**: System MUST apply published branding and layout settings to public store pages.
- **FR-012**: System SHOULD apply store identity cues to administrative screens where they help operators confirm which store they are managing.
- **FR-013**: System MUST support saving visual changes without immediately publishing them.
- **FR-014**: System MUST allow authorized users to publish a saved visual configuration.
- **FR-015**: System MUST keep a history of published visual configurations, including who changed them and when.
- **FR-016**: System MUST allow restoration of the most recent previously published visual configuration.
- **FR-017**: System MUST block cross-store access to store setup, branding, layout and user association operations.
- **FR-018**: System MUST clearly indicate whether a store is ready for public launch based on required setup, responsible user, active status and public slug availability.
- **FR-019**: System MUST preserve historical orders and reports when a store is deactivated.
- **FR-020**: System MUST provide user-friendly error messages for invalid store data, invalid branding assets and unsafe visual choices.

### Key Entities *(include if feature involves data)*

- **Store/Tenant**: A business operation using the platform, with public identity, slug, contact data, active state and operational open/closed state.
- **Store Responsible User**: Initial owner or admin associated with a store, able to access and configure that store.
- **Store Branding**: Logo and color choices that define the visual identity shown to customers and operators.
- **Layout Preset**: Approved layout option for public-facing store pages, with a stable name and intended use.
- **Visual Configuration Version**: Draft or published set of branding and layout settings, including publication metadata.
- **Launch Readiness State**: Computed status that indicates whether the store has enough setup to be safely used publicly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform administrator can create a new store and responsible admin user in under 5 minutes.
- **SC-002**: A newly created store can be accessed by its responsible admin without technical intervention in at least 95% of setup attempts.
- **SC-003**: A store manager can configure logo, primary color, accent color and layout in under 10 minutes.
- **SC-004**: Public store pages show the published logo, colors and layout within 30 seconds after publication.
- **SC-005**: Invalid slugs, duplicate slugs and unsafe visual contrast are blocked before publication in 100% of tested cases.
- **SC-006**: Users can preview visual changes before publication and correctly identify the selected layout in at least 90% of validation sessions.
- **SC-007**: Deactivating a store prevents new public ordering while keeping historical orders and reports available to authorized users.
- **SC-008**: Cross-store access attempts for setup and branding data are rejected in all tenant isolation tests.

## Assumptions

- Store creation is initially an internal platform-admin workflow, not public self-service signup.
- Billing, subscription plans, document verification and franchise/multi-store hierarchy are out of scope for this first version.
- Each new store starts with one responsible owner/admin user; additional staff management can remain in existing or future user-management flows.
- Layout customization starts with approved presets rather than free-form page building.
- Logo upload or selection uses the platform's existing image handling approach when available.
- Public menu pages are the primary target for full visual branding; administrative screens receive lighter identity cues to avoid harming operational usability.
- Existing catalog, ordering, CMV, stock and reporting features continue to operate per store after onboarding.
