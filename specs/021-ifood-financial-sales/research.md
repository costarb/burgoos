# Research: Sincronização de Vendas Financeiras iFood

**Feature**: `021-ifood-financial-sales`  
**Date**: 2026-09-04

## API Sales como fonte primária

**Decision**: usar Sales para listar vendas por merchant/período; usar Financial Events e Settlements para conciliar, não para criar outra venda.

**Rationale**: Sales disponibiliza no mesmo dia ID, status, timezone, cesta, entrega, benefícios, pagamentos, recebedor, saldo e eventos. Aceita até 90 dias, página inicial zero e 100 registros por página. Financial Events detalha créditos/débitos e Settlements informa liquidação. Fontes: [API Sales](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/api-sales/), [Financial Events](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/api-financial-events/) e [Settlements](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/api-settlement/).

**Alternatives considered**: criar pedidos pelo CSV mensal foi rejeitado por ser assíncrono e orientado a lançamentos; usar eventos isolados foi rejeitado porque eventos do mesmo pedido podem ocupar páginas diferentes.

## Estratégia híbrida de pedidos

**Decision**: enriquecer o pedido operacional quando `sales.id` corresponder ao `externalOrderId`; criar pedido histórico consolidado apenas quando nenhum pedido existir.

**Rationale**: o módulo operacional já obtém itens, opções, cliente e entrega, enquanto Sales expõe somente o valor agregado da cesta.

**Alternatives considered**: sempre criar duplica pedidos; nunca criar deixa lacunas históricas; reconstruir itens pelo total inventa informação.

## Credencial compartilhada

**Decision**: vincular integração financeira à operacional e obter token válido por serviço interno, sem copiar segredo.

**Rationale**: a autenticação existente suporta os fluxos iFood e validade informada pelo token. Novas permissões exigem novo token e podem levar até 10 minutos para propagar. Fonte: [Autenticação iFood](https://developer.ifood.com.br/en-US/docs/guides/modules/authentication/intro/).

**Alternatives considered**: duplicar credenciais cria rotação divergente; fundir domínios faz pedidos dependerem da conciliação.

## Componentes financeiros explícitos

**Decision**: persistir venda canônica e filhos para pagamentos, parcelas e eventos; liquidações ficam em entidade própria.

**Rationale**: uma venda pode ter múltiplos meios, recebedores, parcelas e datas; `saleBalance` não equivale ao total pago.

**Alternatives considered**: somente JSON impede filtros/constraints; ampliar só `Order` não representa cardinalidade; reutilizar pagamentos POS mistura captura local e informação importada.

## Regra de valores

**Decision**: usar `saleGrossValue.bag` no item consolidado histórico e preservar entrega, serviço, benefícios, pagamentos e saldo em campos próprios.

**Rationale**: a cesta representa produtos fornecidos pela loja; a documentação distingue Store GMV, iFood GMV e total pago.

**Alternatives considered**: incluir entrega/serviço no pedido infla receita de produto; usar saldo como total transforma líquido em bruto.

## Recebedor e impacto no repasse

**Decision**: somente pagamento recebido pelo iFood gera recebível iFood. Recebimento direto fica registrado; eventos com impacto ainda ajustam o saldo.

**Rationale**: dinheiro, cartão na entrega e benefícios podem ser recebidos pela loja, mas ainda gerar comissão. Fonte: [Financial Events](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/api-financial-events/).

**Alternatives considered**: atribuir tudo ao iFood superestima contas a receber; ignorar recebimento da loja perde faturamento e comissão.

## Classificação fail-closed

**Decision**: `CONCLUDED` pode criar histórico; `CANCELLED` e estados/métodos desconhecidos ficam para revisão, sem conversão automática.

**Rationale**: códigos externos evoluem e cancelamentos pré-faturamento não são receita.

**Alternatives considered**: mapear desconhecido para categoria genérica esconde erro; descartar elimina auditabilidade.

## Paginação, timezone e retomada

**Decision**: iniciar página zero, avançar por `pageCount`, registrar cobertura na data comercial do timezone do merchant, tratar 401/403/429/5xx distintamente e respeitar `retry-after`.

**Rationale**: metadata é mais segura que inferir por tamanho. `createdAt` é UTC, mas períodos respeitam timezone da loja. O limite documentado é 1.000 requisições/minuto. Fontes: [API Sales](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/api-sales/) e [boas práticas](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/best-practices-and-troubleshooting).

**Alternatives considered**: parar em página curta pode truncar; agrupar em UTC desloca venda; retry ilimitado bloqueia worker.

## Gate de produção

**Decision**: permitir POC de Sales, mas bloquear produção até a visão mínima de Financial Events e Settlements e evidência de homologação.

**Rationale**: o módulo Financial requer conta profissional, aplicação funcional em teste e homologação; integração parcial é causa de reprovação. Fonte: [Homologação Financial](https://developer.ifood.com.br/en-US/docs/food/guides/modules/financial/homologation).

**Alternatives considered**: liberar Sales diretamente arrisca falta de permissão e reprovação; implementar CSV primeiro amplia escopo sem melhorar pedidos.

## Segurança e reconciliação CSV

**Decision**: redigir credenciais, documentos e dados bancários; guardar payload mínimo sob retenção existente. Reconciliation On Demand não participa da criação de pedidos, mas integra o gate produtivo e a experiência de conciliação/exportação.

**Rationale**: o CSV é mensal, compactado, assíncrono, atualizado até D-1 e limita nova solicitação da competência por seis horas. Fonte: [Reconciliation On Demand](https://developer.ifood.com.br/en-US/docs/guides/modules/financial/api-reconciliation-ondemand/).

**Alternatives considered**: payload integral indefinido amplia risco; CSV no preview torna a experiência lenta; deixar o CSV fora do gate torna a homologação financeira incompleta.
