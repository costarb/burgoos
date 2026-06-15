# Feature Specification: Integracao com Plataformas de Delivery

**Feature Branch**: `008-ifood-delivery-integration`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Integrar plataformas de delivery, iniciando com o iFood, com configuracao por loja, tokens por tenant, captura de pedidos externos no fluxo interno de pedidos, aceite/recusa, evolucao de status ate entrega, comunicacao de workflow com cada plataforma e desenho desacoplado para futuras integracoes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar integracao iFood por loja (Priority: P1)

Um usuario autorizado da loja configura a integracao com o iFood informando as credenciais e parametros exigidos pela plataforma, valida a conexao e ativa ou desativa a integracao sem afetar outras lojas.

**Why this priority**: Sem configuracao segura e segregada por loja, nenhuma captura de pedido pode ocorrer com confiabilidade operacional.

**Independent Test**: Pode ser testado configurando credenciais para uma loja piloto, validando a conexao e confirmando que outra loja nao enxerga nem usa essa configuracao.

**Acceptance Scenarios**:

1. **Given** uma loja sem integracao configurada, **When** um usuario autorizado salva credenciais validas do iFood, **Then** o sistema registra a configuracao como ativa para aquela loja e mostra a ultima validacao bem-sucedida.
2. **Given** uma loja com integracao ativa, **When** um usuario autorizado desativa a integracao, **Then** o sistema para de capturar novos pedidos da plataforma para aquela loja e preserva o historico de configuracao.
3. **Given** um usuario de outra loja, **When** ele tenta acessar a configuracao iFood da loja piloto, **Then** o acesso e negado.

---

### User Story 2 - Capturar pedidos realizados no iFood (Priority: P1)

Quando um cliente realiza um pedido no iFood para uma loja integrada, o sistema identifica o novo pedido, registra uma copia operacional em Pedidos e deixa o pedido pronto para aceite ou recusa no fluxo administrativo atual.

**Why this priority**: Esta e a entrega minima de valor da integracao: pedidos externos precisam entrar no mesmo fluxo de preparo ja usado pela operacao.

**Independent Test**: Pode ser testado simulando ou recebendo um pedido iFood e verificando se ele aparece na fila da loja com origem, identificadores externos, itens, valores, cliente, forma de entrega/pagamento e status inicial corretos.

**Acceptance Scenarios**:

1. **Given** uma loja com integracao iFood ativa, **When** um novo pedido chega da plataforma, **Then** o sistema cria um pedido interno vinculado ao identificador externo e marca a origem como iFood.
2. **Given** o mesmo evento externo recebido mais de uma vez, **When** o sistema processa novamente o evento, **Then** o pedido interno nao e duplicado.
3. **Given** um pedido externo com itens, taxas, descontos e entrega, **When** ele e importado, **Then** os valores relevantes ficam disponiveis para operacao e relatorios sem perder o vinculo com a plataforma.

---

### User Story 3 - Aceitar ou recusar pedidos da plataforma (Priority: P1)

Um operador visualiza pedidos recebidos via iFood e decide aceitar ou recusar dentro do prazo operacional, com o sistema comunicando a decisao para a plataforma e registrando o resultado.

**Why this priority**: Plataformas de delivery exigem confirmacao operacional. Sem aceite/recusa, a loja pode perder pedidos ou gerar expectativa incorreta para o cliente.

**Independent Test**: Pode ser testado recebendo um pedido pendente, aceitando ou recusando pela tela administrativa e confirmando que o status interno e o status da plataforma ficam consistentes.

**Acceptance Scenarios**:

1. **Given** um pedido iFood pendente de confirmacao, **When** o operador aceita o pedido, **Then** o pedido entra no fluxo de preparo interno e a plataforma recebe a confirmacao.
2. **Given** um pedido iFood pendente de confirmacao, **When** o operador recusa com motivo, **Then** o pedido fica encerrado internamente com motivo e a plataforma recebe a recusa.
3. **Given** falha temporaria ao comunicar a decisao para a plataforma, **When** o operador tenta aceitar ou recusar, **Then** o sistema informa o problema, mantem a decisao pendente de sincronizacao e permite retentativa controlada.

---

### User Story 4 - Sincronizar evolucao de status ate a entrega (Priority: P2)

Depois de aceito, o pedido iFood segue o workflow operacional existente, e cada marco relevante e comunicado para a plataforma de acordo com o fluxo suportado por ela.

**Why this priority**: A loja precisa operar em um unico sistema, sem atualizar manualmente o iFood em paralelo.

**Independent Test**: Pode ser testado evoluindo um pedido aceito por preparo, despacho/pronto para retirada e entrega/conclusao, verificando a consistencia entre status interno e plataforma.

**Acceptance Scenarios**:

1. **Given** um pedido iFood aceito, **When** o operador marca o pedido como em preparo, pronto, despachado ou entregue, **Then** o sistema registra o marco interno e agenda ou envia a atualizacao correspondente para a plataforma.
2. **Given** a plataforma rejeita uma transicao por ordem invalida ou prazo expirado, **When** o sistema recebe a rejeicao, **Then** o operador visualiza a divergencia e o pedido permanece com indicacao de sincronizacao pendente ou falha.
3. **Given** um pedido de retirada e um pedido de entrega, **When** ambos evoluem, **Then** o sistema respeita as diferencas de status aplicaveis a cada modalidade.

---

### User Story 5 - Preparar base para futuras plataformas (Priority: P2)

O administrador consegue adicionar novas plataformas de delivery no futuro sem redesenhar a operacao de pedidos, mantendo configuracoes, eventos, status e auditoria por provedor.

**Why this priority**: A primeira integracao e iFood, mas o valor estrategico depende de um modelo que suporte outros canais como marketplace, apps proprios ou agregadores.

**Independent Test**: Pode ser testado cadastrando uma segunda plataforma em modo inativo ou simulado e verificando que ela usa os mesmos conceitos operacionais sem interferir na configuracao iFood.

**Acceptance Scenarios**:

1. **Given** a integracao iFood existente, **When** uma nova plataforma for habilitada no futuro, **Then** ela deve conseguir usar o mesmo fluxo interno de configuracao, captura, aceite/recusa, status e auditoria.
2. **Given** duas plataformas ativas para a mesma loja, **When** pedidos chegam de ambas, **Then** cada pedido preserva origem, identificador externo e historico de sincronizacao separados.

---

### User Story 6 - Tratar excecoes do fluxo iFood (Priority: P3)

Um operador ou administrador acompanha alteracoes, cancelamentos, disputas, falhas de sincronizacao e saude da integracao iFood sem perder o controle do pedido interno.

**Why this priority**: O fluxo principal atende a operacao diaria, mas excecoes de plataforma precisam ficar visiveis para evitar pedidos divergentes, multas operacionais ou perda de prazo.

**Independent Test**: Pode ser testado simulando eventos de cancelamento, alteracao de pedido, falha de sincronizacao e disputa, verificando se o sistema registra o evento, alerta a loja e mantem o pedido rastreavel.

**Acceptance Scenarios**:

1. **Given** um pedido iFood ja importado, **When** a plataforma envia alteracao de itens ou valores, **Then** o sistema atualiza o pedido interno conforme regra definida, preserva o historico anterior e alerta o operador quando houver impacto operacional.
2. **Given** um pedido iFood com pedido de cancelamento ou recusa, **When** a plataforma confirma ou rejeita a acao, **Then** o sistema mostra o resultado final e registra a justificativa.
3. **Given** uma disputa ou negociacao pos-entrega com prazo de resposta, **When** ela chega da plataforma, **Then** o sistema mostra a acao pendente, prazo limite e resultado apos resposta ou expiracao.

### Edge Cases

- Credenciais invalidas, expiradas, revogadas ou sem permissao para a loja.
- Plataforma indisponivel, lenta, com limite de requisicoes ou retornando erro temporario.
- Evento de pedido recebido duplicado, fora de ordem ou com dados incompletos.
- Pedido cancelado pelo cliente ou pela plataforma antes do aceite.
- Pedido alterado pela plataforma apos captura inicial.
- Tentativa de aceitar, recusar ou evoluir status fora do prazo permitido pela plataforma.
- Pedido iFood pendente de confirmacao ultrapassando o prazo operacional de 8 minutos exigido pela plataforma.
- Pedido iFood retornando detalhes temporariamente indisponiveis logo apos o evento inicial.
- Pedido iFood consultado fora da janela em que a plataforma mantem detalhes completos.
- Evento iFood nao confirmado internamente sendo reenviado pela plataforma e exigindo reprocessamento idempotente.
- Webhook iFood com assinatura invalida ou payload incompleto, quando esse modo estiver habilitado.
- Telefone, documento ou dados sensiveis do cliente ausentes por regra de privacidade da plataforma.
- Alteracao de pedido ou disputa pos-entrega chegando depois que o pedido interno ja evoluiu.
- Acesso de novo merchant iFood ainda em periodo de propagacao apos autorizacao.
- Pedido criado em uma loja sem integracao ativa ou com configuracao incompleta.
- Divergencia entre status interno e status externo apos falha de comunicacao.
- Troca ou rotacao de credenciais sem interromper pedidos ja em andamento.
- Necessidade de reprocessar eventos historicos sem duplicar pedidos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized users to configure delivery platform integrations separately for each store.
- **FR-002**: System MUST support iFood as the first delivery platform integration.
- **FR-003**: System MUST store platform credentials and operational settings per store without exposing secrets in user interfaces, logs, exports, or reports.
- **FR-004**: System MUST allow authorized users to validate, activate, deactivate, and update a store's delivery platform integration.
- **FR-005**: System MUST record who created, changed, activated, deactivated, or validated each integration configuration.
- **FR-006**: System MUST capture new orders from an active platform integration and create corresponding internal orders for the correct store.
- **FR-007**: System MUST preserve a stable link between each internal order and the platform, external merchant/store identifier, external order identifier, and external event identifiers when available.
- **FR-008**: System MUST prevent duplicate internal orders when the same platform order or event is received more than once.
- **FR-009**: System MUST show platform-origin orders in the existing operational order flow with a visible source label and relevant external metadata.
- **FR-010**: System MUST let authorized operators accept or refuse platform orders when the platform workflow requires a decision.
- **FR-011**: System MUST require a refusal reason when a platform order is rejected.
- **FR-012**: System MUST communicate acceptance, refusal, cancellation acknowledgements, and status changes back to the originating platform when required by that platform's workflow.
- **FR-013**: System MUST map platform-specific statuses into the internal order workflow while preserving the original external status history.
- **FR-014**: System MUST track synchronization state for each outbound communication, including pending, sent, confirmed, failed, and retryable states.
- **FR-015**: System MUST provide a controlled retry path for recoverable platform communication failures.
- **FR-016**: System MUST alert operators when a platform order requires action or when synchronization fails.
- **FR-017**: System MUST isolate integration configuration, orders, events, credentials, and synchronization history by store.
- **FR-018**: System MUST support multiple delivery platforms conceptually without requiring changes to the existing internal order workflow for each new platform.
- **FR-019**: System MUST maintain an audit trail of inbound platform events, operator decisions, outbound status updates, and synchronization errors.
- **FR-020**: System MUST allow integration activity to be paused without deleting credentials, historical orders, or audit records.
- **FR-021**: System MUST provide an operational view of integration health per store, including last successful capture, last error, active/inactive state, and pending actions.
- **FR-022**: System MUST ensure that only users with appropriate store access can view or manage that store's integration settings.
- **FR-023**: System MUST handle credentials that expire or require renewal by marking the integration as requiring attention and preventing silent data loss.
- **FR-024**: System MUST define how imported platform payments, fees, discounts, delivery charges, customer data, and order items are represented in the internal order record.
- **FR-025**: System MUST make platform order ingestion idempotent and traceable from the internal order back to the original external payload or normalized event record.
- **FR-026**: System MUST manage iFood authentication tokens using the provider expiration metadata and recover from expired access tokens without requiring manual reconfiguration when refresh or reauthentication is available.
- **FR-027**: System MUST validate that the configured iFood credentials have access to the intended merchant/store and surface permission propagation delays as a temporary validation state.
- **FR-028**: System MUST support iFood order event ingestion through provider-compliant polling at the required interval for the initial release, while keeping the design open for webhooks with signature validation.
- **FR-029**: System MUST acknowledge iFood events only after the related event processing is durably recorded, so repeated events remain safe to process.
- **FR-030**: System MUST track the iFood order confirmation deadline and alert operators before the platform's automatic cancellation window is reached.
- **FR-031**: System MUST retry temporarily unavailable iFood order details with bounded backoff before marking the event as failed.
- **FR-032**: System MUST distinguish iFood order modalities such as delivery, merchant delivery, pickup/takeout, immediate order, and scheduled order when mapping actions to the internal workflow.
- **FR-033**: System MUST use valid provider cancellation reasons when requesting cancellation or refusal and record the asynchronous platform result.
- **FR-034**: System MUST handle iFood delivery tracking as optional and rate-limited information, without blocking the internal order workflow when tracking is unavailable.
- **FR-035**: System MUST process iFood order modification events by updating the internal order record or creating a visible operator exception when automatic update is unsafe.
- **FR-036**: System MUST process iFood post-delivery dispute or negotiation events as time-bound operator/admin actions with an audit trail.
- **FR-037**: System MUST apply privacy rules for imported customer data, avoiding exposure of sensitive fields in views, prints, or integrations where the platform does not allow them.
- **FR-038**: System MUST expose iFood homologation readiness per store, including credential validity, merchant access, event processing, acknowledgment behavior, status updates, and required operational tests.
- **FR-039**: System MUST monitor iFood merchant operational status and show whether the store is able to receive orders from the platform.

### Key Entities

- **Delivery Platform**: Represents an external channel such as iFood. Includes provider identity, supported workflows, activation availability, and operational capabilities.
- **Store Integration Configuration**: Store-scoped configuration for a delivery platform, including credential state, external merchant/store identifiers, active flag, validation status, and operational settings.
- **Integration Credential**: Secret or token material used to authenticate with a platform. Must be protected, rotatable, and never displayed after saving.
- **Provider Authorization Grant**: Store-scoped authorization state for a platform, including granted merchants, token expiration metadata, renewal state, and validation result.
- **Platform Order Link**: Relationship between an internal order and its external platform order, including provider, external order id, external merchant id, and source metadata.
- **Platform Event**: Inbound notification or retrieved event from the platform, with event id, event type, received time, processing state, and normalized payload summary.
- **Event Acknowledgment**: Confirmation that an inbound platform event was processed safely and can be removed from the provider delivery queue.
- **Platform Status Mapping**: Mapping between platform-specific order states and internal order states.
- **Synchronization Attempt**: Outbound communication attempt from the system to a platform, with action type, target order, result, retry state, timestamps, and error details.
- **Order Action Deadline**: Provider-specific deadline that requires operator action, such as iFood order confirmation before automatic cancellation.
- **Cancellation Reason**: Provider-approved reason used when refusing or cancelling a platform order.
- **Platform Dispute**: Post-order negotiation or dispute initiated by the platform/customer, with proposal, deadline, response, and final outcome.
- **Integration Audit Record**: Immutable record of configuration changes, inbound processing, operator actions, and outbound synchronization results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A store administrator can configure and validate an iFood integration for one store in under 10 minutes once valid credentials are available.
- **SC-002**: 95% of new platform orders appear in the internal order queue within 60 seconds of becoming available to the integration under normal platform conditions.
- **SC-003**: Duplicate platform events do not create duplicate internal orders in 100% of repeated-event test cases.
- **SC-004**: Operators can accept or refuse an incoming platform order from the internal order queue in under 30 seconds.
- **SC-005**: 95% of accepted platform order status updates are communicated back to the platform within 30 seconds under normal platform conditions.
- **SC-006**: All platform-origin orders can be traced from internal order to external platform id and integration audit history.
- **SC-007**: A failed platform communication produces a visible operator/admin warning and a retryable record within 10 seconds.
- **SC-008**: Store isolation tests prove that users from one store cannot view, configure, or process another store's platform integration.
- **SC-009**: 100% of successfully processed iFood events are acknowledged only after the corresponding internal event or order record is persisted.
- **SC-010**: Operators receive a visible warning before an iFood order confirmation deadline is missed in 100% of deadline test cases.
- **SC-011**: Expired iFood access tokens are renewed or marked for reauthorization before order ingestion is silently interrupted.
- **SC-012**: The iFood homologation checklist can be executed end to end for the pilot store without using manual database changes.

## Assumptions

- The initial production rollout targets iFood for the existing pilot store, but the model must support additional platforms later.
- The existing administrative authentication and store permission model will be reused for integration configuration and order operations.
- The existing internal order workflow remains the operational source of truth for preparation and delivery actions after a platform order is accepted.
- Official iFood Developer documentation supplied as PDF was analyzed on 2026-06-15 and is summarized in `research.md`; direct portal access may still require browser authentication or Cloudflare validation.
- The initial iFood release will use event polling because it is the documented baseline and is simpler to homologate; webhook support remains a planned extension for higher volume or certification needs.
- Secrets are expected to be stored securely and rotated without deleting historical integration records.
- Customer and order data imported from platforms must follow the same privacy and audit expectations as manually entered orders.
- If the platform has a certification or homologation flow, production activation depends on completing that external approval.
