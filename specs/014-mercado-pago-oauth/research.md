# Research: Conexao Mercado Pago Multiempresa

## OAuth para terceiros

**Decision**: Usar Authorization Code com aplicacao central, `state` opaco, redirect URI fixa e PKCE S256. O estado expira em 10 minutos e e consumido uma vez.

**Rationale**: A documentacao oficial indica Authorization Code para agir em nome de vendedores terceiros, recomenda PKCE e informa codigo de autorizacao valido por 10 minutos e uso unico.

**Alternatives considered**: Token copiado como unico modo foi rejeitado para SaaS; Client Credentials foi rejeitado porque atua em nome da propria aplicacao, nao da loja. Token fixo permanece apenas como modo explicito de teste/provisorio.

**Source**: https://www.mercadopago.com.br/developers/pt/docs/security/oauth e https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation

## Persistencia do state e PKCE

**Decision**: Persistir hash SHA-256 do state, verifier cifrado, tenant, usuario, ambiente, expiracao e status. O valor cru do state existe apenas no navegador/URL durante o fluxo.

**Rationale**: Evita usar tenant ID como autoridade, limita impacto de leitura indevida do banco e permite callback sem depender da sessao original. O verifier possui 43 a 128 caracteres e gera challenge Base64URL(SHA-256).

**Alternatives considered**: State JWT auto-contido foi rejeitado porque uso unico/revogacao exigiria persistencia de qualquer forma; session-only foi rejeitado por fragilidade em callback cross-browser e multiplas instancias.

## Token fixo

**Decision**: Aceitar Access Token produtivo em endpoint administrativo write-only, validar a conta no provider, cifrar no mesmo envelope de segredos e marcar modo `FIXED_TOKEN`. Nao persistir fragmentos recuperaveis e nao renovar automaticamente.

**Rationale**: Atende testes antes do onboarding OAuth sem criar caminho inseguro no frontend. A referencia de pagamentos exige Bearer Access Token e aceita credencial obtida pelo painel; a verificacao remota impede associacao baseada em user ID digitado.

**Alternatives considered**: Variavel de ambiente unica foi rejeitada por quebrar isolamento multiempresa; armazenar token no navegador foi rejeitado por exposicao e impossibilidade de jobs/webhooks.

**Source**: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/search-payments/get

## Renovacao OAuth

**Decision**: Renovar conexoes OAuth a 15 dias do vencimento com claim exclusivo. Substituir access token, refresh token e validade em uma transacao. Um 401 permite uma renovacao e uma repeticao; depois requer reautorizacao.

**Rationale**: Access Tokens Authorization Code duram aproximadamente 180 dias, `offline_access` habilita refresh e cada renovacao devolve novo refresh token que precisa ser salvo novamente.

**Alternatives considered**: Renovar em toda chamada aumenta corrida; renovar somente depois do vencimento aumenta indisponibilidade; lock apenas em memoria nao protege multiplas instancias.

**Source**: https://www.mercadopago.com.br/developers/en/docs/security/oauth/renewal

## Busca de pagamentos

**Decision**: Consultar `/v1/payments/search` com `sort=date_created`, `criteria=asc`, `range=money_release_date`, `begin_date`, `end_date`, `limit` e `offset`. A data de liberacao foi escolhida apos batimento com o CDV. Dividir internamente ranges se necessario, deduplicando por payment ID.

Na importacao, `money_release_date` tambem define o instante comercial persistido no pedido e usado pelos filtros. O offset recebido do provider deve ser respeitado e a apresentacao deve ser convertida para `America/Sao_Paulo`; por exemplo, `2026-07-18T23:00:11-04:00` pertence a 19/07 em Sao Paulo. `date_created` permanece no payload/estado para auditoria e serve apenas como fallback quando a liberacao nao for informada. A previa exibe as duas datas sem expor o payload bruto.

**Rationale**: O endpoint retorna os ultimos 12 meses, exige ordenacao/criterio, aceita range menor que 365 dias e responde com `paging.total/limit/offset`. Ordem ascendente reduz risco de perder itens quando novos pagamentos entram durante uma carga.

**Alternatives considered**: Consulta sem range foi rejeitada por custo e instabilidade; offset descendente foi rejeitado por deslocamento de paginas com novas vendas; cursor nao e documentado nesse endpoint.

**Source**: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/search-payments/get

## Webhooks e Point

**Decision**: Validar `x-signature` com `x-request-id`, data ID e segredo da aplicacao, persistir evento idempotente, responder rapidamente e buscar o recurso canonico. Suportar `payment` e preparar `order`, habilitando Point apenas apos POC.

**Rationale**: A documentacao orienta confirmar recebimento antes de consultar o recurso. Ela associa Mercado Pago Point ao topico `order` e endpoint `/v1/orders/{order_id}`, enquanto `payment` se aplica a outros produtos. O exemplo contem `user_id`, usado para resolver a conexao.

**Alternatives considered**: Confiar no payload foi rejeitado porque e apenas notificacao; mapear tudo como payment foi rejeitado pela documentacao Point; URL por tenant foi rejeitada por complicar configuracao da aplicacao central.

**Source**: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks

## Pipeline comum de provider

**Decision**: Substituir a obrigacao `fetchDay` por `fetchRange`, com adapter responsavel por paginacao/decomposicao e retorno normalizado incremental. PagBank implementa range chamando sua coleta diaria; Mercado Pago pagina o intervalo.

**Rationale**: Preserva registry, preview, importacao e idempotencia atuais sem impor a API diaria PagBank a providers futuros.

**Alternatives considered**: Criar orchestrator Mercado Pago paralelo duplicaria regras; fingir um dia por chamada aumentaria requisicoes e esconderia semantica real do provider.

## Processamento assincrono e locks

**Decision**: Reusar processamento interno do monolito e claims persistidos por conexao/evento. Nao adicionar broker nesta entrega.

**Rationale**: A escala prevista e moderada, o projeto ja processa runs assincronamente e o lock no banco cobre multiplas instancias. O modelo permite migrar para fila externa sem mudar contratos.

**Alternatives considered**: Processar callback/webhook inteiro na requisicao arrisca timeout; broker dedicado e complexidade prematura para o piloto.

## Estado financeiro canonico

**Decision**: Manter movimentos de preview imutaveis e adicionar uma transacao canonica por conexao/provider ID para atualizacoes de webhook/reconciliacao.

**Rationale**: Runs sao evidencias historicas; atualizar seu payload destruiria auditoria. O estado canonico permite observar approved/refunded/cancelled/charged_back sem modificar automaticamente pedidos.

**Alternatives considered**: Nova tabela de pagamentos totalmente paralela foi rejeitada; mutar o ultimo movimento foi rejeitado por historico e ausencia de movimento quando webhook chega antes da carga.
