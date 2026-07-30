# Runbook operacional — POS, Mercado Pago Point e contingência

## Objetivo

Orientar a ativação e a operação do checkout do balcão sem expor tokens ou depender
exclusivamente do webhook. Este documento cobre Mercado Pago Point, pagamentos
manuais em Caixa/PagBank e tratamento inicial de incidentes.

## Pré-requisitos

- Aplicação Mercado Pago central do BurgoOS configurada pelo `SUPER_ADMIN`.
- Loja conectada por OAuth ou, somente para teste controlado, por token fixo.
- Integração no ambiente correto (`TEST` ou `PRODUCTION`).
- Usuário operador com `payments.charge` e `payments.confirm-manual`.
- Usuário responsável pela configuração com `payment-terminals.manage`.
- Webhook público HTTPS apontando para:
  `/api/webhooks/mercadopago/orders`.

Credenciais nunca devem ser copiadas para logs, navegador, chamados ou capturas de
tela. A API resolve e descriptografa o token da conexão da loja.

## Ativação da Point

1. Conectar a conta Mercado Pago da loja em **Integrações**.
2. Confirmar que a conta autorizadora é a proprietária das maquininhas.
3. No Mercado Pago, configurar a Point para trabalhar no modo **PDV**. Uma
   maquininha em modo `STANDALONE` pode ser descoberta, mas não recebe pedidos da
   Orders API.
4. Abrir o checkout de um pedido e selecionar **Mercado Pago Point**.
5. Clicar em **Sincronizar**.
6. Confirmar que a maquininha aparece como `PDV` e habilitá-la.
7. Enviar uma cobrança pequena e conferir aprovação na maquininha e no pedido.

O botão de sincronização consulta os terminais da conta conectada. Se retornar
terminais, mas nenhum estiver habilitável, revisar primeiro o modo PDV no Mercado
Pago e depois sincronizar novamente.

## Webhook

Configurar no Mercado Pago:

```text
https://<dominio-da-api>/api/webhooks/mercadopago/orders
```

Habilitar notificações relacionadas a Orders/Point. A assinatura secreta exibida
pelo Mercado Pago deve ser armazenada na configuração global protegida.

Uma entrega válida deve conter `x-signature`, `x-request-id` e o identificador do
recurso. A API valida a assinatura, persiste o envelope idempotentemente e consulta
o recurso no provedor antes de consolidar o estado.

O webhook acelera a atualização, mas não é a única fonte: cobranças pendentes são
reconciliadas periodicamente pela consulta da Orders API.

## Fluxo operacional

### Mercado Pago Point

1. Criar o pedido no POS.
2. No checkout, selecionar **Mercado Pago Point**.
3. Selecionar a maquininha PDV.
4. Enviar o valor e aguardar a ação do cliente.
5. Não repetir a cobrança enquanto o resultado estiver `PROCESSING` ou `UNKNOWN`.
6. Em caso inconclusivo, consultar novamente ou usar a tela de exceções.

### Caixa local, PagBank ou outra instituição manual

1. Realizar a cobrança fisicamente.
2. No checkout, selecionar **Caixa / PagBank**.
3. Escolher instituição e forma de pagamento.
4. Para dinheiro, informar o valor recebido; o sistema calcula o troco.
5. Para maquininha externa, registrar a referência quando disponível.
6. Confirmar somente após verificar o sucesso no equipamento.

O pagamento manual quita o saldo integral exibido. Se outra operação alterar o
saldo, fechar e reabrir o checkout para carregar o valor atual.

## Contingência

### Terminal offline ou não listado

- Confirmar energia e conectividade do terminal.
- Confirmar que a conta Mercado Pago conectada é a mesma do terminal.
- Confirmar modo PDV e sincronizar novamente.
- Se a fila exigir continuidade, usar PagBank/manual e registrar a referência.

### Cobrança sem resultado

- Não iniciar uma segunda cobrança imediatamente.
- Usar **Atualizar** para consultar a Orders API.
- Aguardar a reconciliação automática.
- Se permanecer inconclusiva, revisar em **Exceções de pagamento**.

### Aprovação na máquina sem atualização no sistema

- Pesquisar a cobrança pelo pedido/comanda.
- Atualizar a cobrança para consultar o provedor.
- Verificar recepção e assinatura do webhook.
- Nunca confirmar manualmente o mesmo pagamento sem antes descartar duplicidade.

### Erro de token

- Verificar o status da conexão Mercado Pago da loja.
- Renovar ou reconectar por OAuth.
- Token fixo deve permanecer restrito a testes controlados.
- Resolver a exceção somente depois de confirmar que a credencial voltou a operar.

### Possível duplicidade

- Conferir extrato da adquirente e identificadores das cobranças.
- Não alterar alocações diretamente no banco.
- Registrar a conclusão e a evidência na resolução da exceção.
- Se houver cobrança duplicada real, executar o estorno no provedor e reconciliar.

## Fechamento do turno

Antes de encerrar:

- conferir comandas abertas ou aguardando pagamento;
- concluir pedidos ativos no KDS;
- revisar cobranças `CREATED`, `WAITING_CUSTOMER`, `PROCESSING` ou `UNKNOWN`;
- resolver exceções financeiras abertas;
- conferir pagamentos manuais contra caixa e comprovantes.

O painel **Conferência de fechamento**, em `/admin/tabs`, resume essas pendências.
Ele é um controle operacional; não substitui o fechamento financeiro/físico do
caixa.

## Evidências mínimas do piloto

Registrar em `point-poc-results.md`:

- terminal descoberto e modo PDV;
- aprovação, recusa, expiração e cancelamento;
- atualização por webhook;
- recuperação por reconciliação;
- estorno e exceção após entrega;
- reconexão OAuth;
- teste com segunda conta real.
