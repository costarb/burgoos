# Research: PDV, Comandas e KDS Omnicanal

**Date**: 2026-07-23

## 1. Pedido, comanda, produção e pagamento

**Decision**: manter ciclos independentes e relacioná-los por referências e projeções.

**Rationale**: uma comanda pode conter pedidos em diferentes fases; produção pode começar antes do pagamento; uma cobrança pode falhar sem cancelar comida; um pagamento pode ser estornado após entrega. Um único status não representa essas combinações.

**Alternatives considered**:

- Adicionar `AWAITING_PAYMENT` ao `OrderStatus`: rejeitado porque bloqueia combinações válidas e mistura cozinha com financeiro.
- Tratar comanda como um pedido editável: rejeitado porque itens adicionais já enviados à cozinha precisam de identidade e tempos próprios.
- Criar uma comanda obrigatória para tudo: rejeitado porque aumenta atrito em vendas imediatas.

## 2. Compatibilidade do KDS

**Decision**: preservar o enum atual e adicionar `READY`; apresentar labels contextuais.

**Rationale**: `PENDING` pode ser exibido como Recebido, `PREPARING` como Em preparo e `DELIVERED` como Entregue. `SHIPPED` continua útil para delivery, mas não deve aparecer em retirada. Uma migração destrutiva de todos os valores históricos não agrega valor operacional.

**Alternatives considered**:

- Substituir todo o enum por nomes novos: rejeitado pelo risco de migração e integrações existentes.
- Criar um segundo status de KDS: rejeitado porque duplicaria o ciclo produtivo do pedido.

## 3. Personalização e ficha técnica

**Decision**: ficha técnica define ingredientes removíveis; complementos vendáveis possuem cadastro explícito e relacionamento com produto/categoria. O pedido salva snapshots.

**Rationale**: retirar cebola é diferente de vender bacon extra. Ficha técnica serve para composição/custo, enquanto complemento precisa de preço, disponibilidade, limite e nome comercial. Snapshots protegem pedidos contra alterações posteriores.

**Alternatives considered**:

- Usar qualquer ingrediente como adicional: rejeitado porque quantidade técnica e unidade de estoque não equivalem a uma opção comercial.
- Guardar personalização apenas em observação: rejeitado porque não permite preço, validação, cozinha ou auditoria estruturados.

## 4. Preço manual

**Decision**: servidor calcula o preço; override é um campo separado, requer permissão, justificativa e auditoria.

**Rationale**: preserva a verdade comercial e permite medir descontos/sobretaxas sem alterar catálogo ou ocultar divergências.

**Alternatives considered**:

- Aceitar diretamente o total do frontend: rejeitado por segurança e inconsistência.
- Alterar temporariamente o preço do produto: rejeitado porque afetaria outros canais.

## 5. Instituição e meio de pagamento

**Decision**: modelar `provider/institution` separado de `payment method`.

**Rationale**: Mercado Pago e PagBank podem processar crédito, débito, Pix ou carteira; Caixa local controla dinheiro. A separação melhora operação, conciliação e relatórios.

**Alternatives considered**:

- Criar um meio “PagBank”: rejeitado porque mistura adquirente e instrumento.
- Usar somente a configuração financeira atual: rejeitado porque faltam tentativa, estado externo, alocação e auditoria de cobrança.

## 6. Mercado Pago Point Orders

**Decision**: adotar Orders API, listar terminais da conta conectada, exigir terminal habilitado em modo PDV, criar order com uma transação e chave idempotente, acompanhar webhook e consultar a order.

**Rationale**: a documentação atual posiciona Orders como evolução da Payment Intent API. A criação ocorre em `POST /v1/orders`, o terminal é informado em `config.point.terminal_id`, existe uma transação por order Point e `external_reference` é obrigatório. Terminais são listados em `/terminals/v1/list` e precisam operar em modo PDV. Para terceiros, as chamadas usam OAuth da conta autorizadora.

**Status mapping**:

| Mercado Pago order/transaction | Internal charge |
|--------------------------------|-----------------|
| `created` | `CREATED` |
| `action_required/waiting_payment` | `WAITING_CUSTOMER` |
| `action_required/check_on_terminal` | `UNKNOWN` with operator warning |
| `at_terminal` | `PROCESSING` |
| `processed/accredited` | `APPROVED` |
| `failed/*` | `DECLINED` or `FAILED` by detail |
| `canceled/*` | `CANCELLED` |
| `expired/expired` | `EXPIRED` |
| `processed/partially_refunded` | `PARTIALLY_REFUNDED` |
| `refunded/refunded` | `REFUNDED` |

**Operational constraints**:

- Apenas modelos suportados pelo endpoint de terminais podem ser habilitados.
- Existe apenas um terminal em modo PDV por caixa Mercado Pago.
- Order Point expira se não for paga; nova tentativa cria nova order, nunca reutiliza expirada.
- Cancelamento e reembolso são ações diferentes.
- O provedor restringe consulta normal de orders antigas; dados necessários à auditoria devem ser preservados internamente.

**Alternatives considered**:

- Payment Intent API legada: rejeitada porque novas capacidades evoluem em Orders.
- Usar `/v1/payments/search` para comandar a maquininha: rejeitado porque serve consulta/conciliação, não envio de cobrança Point.
- Confiar somente no webhook: rejeitado por repetição, atraso e perda de evento.

**Official references**:

- https://www.mercadopago.com.br/developers/pt/reference/in-person-payments/point/orders/create-order/post
- https://www.mercadopago.com.br/developers/pt/docs/mp-point/payment-processing
- https://www.mercadopago.com.br/developers/pt/docs/mp-point/notifications
- https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/status-order-transaction
- https://www.mercadopago.com.br/developers/pt/docs/mp-point/configure-terminal
- https://www.mercadopago.com.br/developers/pt/reference/in-person-payments/point/terminals/get-terminals/get

## 7. Webhook, idempotência e reconciliação

**Decision**: inbox durável para eventos, resposta rápida, processamento assíncrono idempotente e consulta do recurso oficial.

**Rationale**: o Mercado Pago repete notificações até receber sucesso. Assinatura valida origem, mas o payload é um aviso. Persistir o envelope antes de responder permite reprocessar; chave externa única e transação local evitam efeitos repetidos.

**Alternatives considered**:

- Processar tudo antes da resposta: rejeitado por timeout e novas tentativas.
- Atualizar pagamento apenas pelo payload: rejeitado porque pode ser parcial ou chegar fora de ordem.
- Polling contínuo para todas as cobranças: rejeitado por carga; reconciliação deve focar estados pendentes.

## 8. PagBank manual e Caixa local

**Decision**: usar o mesmo agregado de cobrança, com `mode=MANUAL`, confirmação explícita e evento auditável.

**Rationale**: mantém operação uniforme e permite reconciliar automaticamente no futuro. Dinheiro registra recebido e troco; PagBank registra meio, referência opcional e declaração do operador.

**Alternatives considered**:

- Apenas marcar `Order.paymentInstitution`: rejeitado porque perde tentativas, operador, horário, cancelamento e vínculo com comanda.

## 9. Comanda e pagamentos futuros

**Decision**: permitir alocação pagamento-saldo no modelo, mas entregar inicialmente fechamento integral.

**Rationale**: uma tabela de alocação evita redesenho quando divisão ou pagamento parcial for promovido, sem aumentar a primeira interface operacional.

**Alternatives considered**:

- Um único `paymentId` na comanda: rejeitado porque impede troca de meio, tentativa nova, estorno e evolução para divisão.

## 10. Realtime

**Decision**: continuar com Socket.io para invalidação rápida, adicionar autenticação às salas administrativas e sempre refazer snapshot após reconexão.

**Rationale**: o projeto já usa Socket.io. Eventos não substituem consultas; a tela deve ser recuperável após ficar offline.

**Alternatives considered**:

- Novo broker/microserviço: rejeitado por complexidade prematura.
- Somente polling: possível fallback, mas pior para KDS e fila em tempo real.

## 11. Fila pública e privacidade

**Decision**: projeção pública mínima por tenant, com código curto/apelido moderado e estados permitidos.

**Rationale**: televisão pública não deve expor PII ou pagamento. A ordem de ativos e concluídos é diferente e deve ser produzida no servidor.

**Alternatives considered**:

- Expor o pedido administrativo filtrado no frontend: rejeitado pelo risco de vazamento.
- Mostrar nome completo: rejeitado por privacidade.

## 12. Perfil Atendente

**Decision**: perfil seedado com permissões operacionais mínimas e ações sensíveis separadas.

**Rationale**: esconder menu não é autorização. Permissões específicas permitem que cada loja delegue override, cancelamento ou estorno sem conceder administração ampla.

**Alternatives considered**:

- Reutilizar `STORE_ADMIN`: rejeitado por privilégio excessivo.
- Uma única permissão `orders.manage`: rejeitada porque não separa cobrança e preço sensíveis.
