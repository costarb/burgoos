# Quickstart: PDV, Comandas e KDS Omnicanal

## Prerequisites

- PostgreSQL local ativo e migrations aplicadas.
- Seed com loja piloto, perfil Atendente, categorias, produtos, ficha técnica e complementos.
- Usuários separados para Atendente, Cozinha e Gestor.
- Conexão Mercado Pago OAuth da loja ativa.
- Para teste Point real: terminal suportado, associado à conta/loja/caixa Mercado Pago e configurado em modo PDV.
- Webhook Orders configurado com assinatura secreta.

## Increment 1 - Counter capture and KDS

1. Entrar como Atendente.
2. Abrir Capturar pedido.
3. Criar pedido avulso com retirada.
4. Remover um ingrediente e adicionar um complemento.
5. Confirmar o preço calculado.
6. Verificar origem Balcão e personalizações no KDS.
7. Mover Recebido -> Em preparo -> Pronto -> Entregue.
8. Repetir a confirmação original e verificar que não foi criado outro pedido.

Expected:

- Total recalculado no servidor.
- Snapshot do item preservado.
- Eventos aparecem em até 3 segundos.
- `SHIPPED` não é oferecido para retirada.

## Increment 2 - Price override and authorization

1. Tentar alterar preço como Atendente base.
2. Confirmar que a ação é bloqueada.
3. Conceder `pos.override-price` a um supervisor.
4. Alterar o preço, informando motivo.
5. Verificar valor calculado, cobrado, diferença e auditoria.

## Increment 3 - Manual payments

### PagBank

1. Criar pedido avulso ou comanda.
2. Selecionar PagBank + débito.
3. Registrar aprovação manual e referência.
4. Verificar saldo quitado e indicador Manual.
5. Cancelar como gestor e confirmar reabertura do saldo.

### Cash

1. Selecionar Caixa local + dinheiro.
2. Informar R$ 100,00 para saldo de R$ 73,00.
3. Confirmar troco de R$ 27,00 antes de finalizar.

## Increment 4 - Service tab

1. Abrir comanda “João”/número 12.
2. Adicionar um pedido e enviar ao KDS.
3. Entregar o pedido sem pagar.
4. Adicionar um segundo pedido.
5. Iniciar fechamento e verificar bloqueio de novas inclusões.
6. Pagar o saldo integral e fechar.
7. Tentar processar o mesmo pagamento novamente.

Expected:

- Pedidos têm estados independentes.
- Comanda fecha somente com saldo zero.
- Repetição não duplica efeito.

## Increment 5 - Mercado Pago Point sandbox/controlled POC

1. Sincronizar terminais da conta conectada.
2. Habilitar somente terminal em modo PDV.
3. Criar cobrança para uma comanda.
4. Verificar a chegada da order ao terminal.
5. Aprovar pagamento real pequeno.
6. Confirmar webhook, consulta do recurso e quitação única.
7. Repetir o mesmo webhook 100 vezes.
8. Criar nova cobrança e recusar no terminal.
9. Criar nova cobrança e deixar expirar.
10. Cancelar uma order ainda pendente.
11. Reembolsar a aprovada em ambiente controlado.
12. Desconectar a rede entre aprovação e webhook e validar reconciliação.

Expected:

- Recusa/expiração não cancelam produção.
- Evento duplicado não duplica pagamento.
- Estado desconhecido abre exceção e impede nova cobrança silenciosa.
- Reembolso ajusta saldo/histórico.

## Increment 6 - Omnichannel

1. Criar pedidos via Balcão, Cardápio público e iFood.
2. Confirmar origem em cada cartão.
3. Confirmar ordem do mais antigo no KDS.
4. Simular delivery e validar etapa Saiu para entrega.
5. Simular retirada e validar Pronto -> Entregue.

## Increment 7 - Public queue

1. Abrir `/fila` no domínio da loja.
2. Confirmar ativos do mais antigo ao mais novo.
3. Marcar um pedido Pronto/Entregue.
4. Confirmar concluídos mais recentes primeiro.
5. Inspecionar resposta e tela para telefone, endereço, valor e pagamento.
6. Repetir com duas lojas e confirmar isolamento.
7. Desligar a API brevemente e validar aviso de estado desatualizado.

## Increment 8 - Permissions

1. Entrar como Atendente.
2. Verificar apenas Capturar pedido e Pedidos/KDS.
3. Tentar acessar diretamente terminais, exceções, relatórios e usuários.
4. Confirmar 403 e auditoria.
5. Trocar loja em usuário multi-loja e verificar troca integral do contexto.

## Required automated gates

```powershell
npm.cmd run typecheck --workspace=@burgoos/api
npm.cmd run typecheck --workspace=@burgoos/web
npm.cmd run lint --workspace=@burgoos/api
npm.cmd run lint --workspace=@burgoos/web
npm.cmd test --workspace=@burgoos/api
npm.cmd test --workspace=@burgoos/web
npm.cmd run build --workspace=@burgoos/api
npm.cmd run build --workspace=@burgoos/web
```

Required E2E suites:

- Counter order -> KDS -> delivery.
- Service tab with two orders -> payment -> close.
- Point approved/declined/expired/unknown/refunded.
- Manual PagBank and cash.
- Idempotent order/charge/webhook.
- Reconnect KDS snapshot.
- Public queue privacy.
- Cross-tenant access and event isolation.

## Production readiness

- Migration backup and rollback procedure reviewed.
- OAuth scopes and Point availability confirmed with a second seller account.
- Terminal model and PDV mode validated.
- Webhook signature and notification dashboard healthy.
- Reconciliation scheduler observed.
- Alerting configured for unknown/duplicate payments.
- Operational runbook covers: terminal offline, approval without webhook, duplicate charge, manual contingency, cancellation after preparation and open tabs at shift close.
