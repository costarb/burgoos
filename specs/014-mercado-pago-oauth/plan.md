# Implementation Plan: Conexao Mercado Pago Multiempresa

**Branch**: `014-mercado-pago-oauth` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-mercado-pago-oauth/spec.md`

## Summary

Evoluir o subdominio existente `Management/Sales Integrations` para adicionar Mercado Pago com dois modos de credencial por tenant: OAuth Authorization Code com `state`, PKCE e renovacao, ou Access Token fixo write-only para testes. O adapter Mercado Pago coleta pagamentos paginados por periodo e recursos Point confirmados na prova de conceito, normaliza-os no pipeline atual de preview/importacao e recebe webhooks apenas como gatilho para buscar o recurso canonico. Novas entidades pequenas controlam tentativas OAuth, notificacoes, auditoria e lock operacional; pedidos, movimentos e identidade externa existentes permanecem como fonte comum.

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20+

**Primary Dependencies**: NestJS 10, `@nestjs/schedule`, Next.js 14 App Router, React 18, Prisma, PostgreSQL, class-validator, native `fetch`, Node.js `crypto`

**Storage**: PostgreSQL via Prisma para conexoes tenant-scoped, credenciais cifradas, tentativas OAuth, notificacoes, auditoria, execucoes e movimentos; configuracao global OAuth permanece em variaveis seguras por ambiente

**Testing**: Vitest para OAuth, cliente, mapper, renovacao, assinatura e UI; Supertest para contratos HTTP/callback/webhook e isolamento tenant; fixtures sanitizadas oficiais; typecheck, lint, Prisma validate e teste manual controlado com segunda conta Point

**Target Platform**: Monolito web em Linux/containers, API REST publica/administrativa e frontend administrativo responsivo

**Project Type**: Monorepo web com API NestJS, frontend Next.js e pacotes compartilhados

**Performance Goals**: Callback e cadastro de token concluem em ate 10 segundos fora de indisponibilidade externa; webhook autenticado responde em menos de 2 segundos; preview de 90 dias e reconciliacoes executam fora da requisicao HTTP; consultas administrativas permanecem paginadas

**Constraints**: Segredos nunca retornados/logados; tenant sempre derivado da sessao ou de estado opaco; uma conta externa por provider/ambiente; OAuth code de uso unico e 10 minutos; token OAuth cerca de 180 dias; refresh token rotacionado; busca limitada aos ultimos 12 meses e intervalo menor que 365 dias; Point usa recurso `order` na documentacao atual e exige POC; token fixo nao renova automaticamente

**Scale/Scope**: Dezenas a centenas de lojas, uma conexao Mercado Pago por tenant/ambiente, cargas iniciais de 30/60/90 dias, reconciliacao de 24 horas a cada 15 minutos e sete dias diariamente

## Constitution Check

_GATE: Passed before research and re-checked after design._

- **Real Operation First**: Pass. A entrega remove CSV/manual para uma operacao financeira real e permite token fixo para desbloquear o POC antes da aprovacao OAuth.
- **TypeScript Strict By Default**: Pass. Respostas OAuth, pagamentos, orders, webhooks, estados e contratos compartilhados serao tipados e validados na borda.
- **Modular Monolith, Domain-Oriented**: Pass. Mercado Pago entra no modulo existente de integracoes de vendas; scheduler e webhook executam no mesmo monolito, sem broker ou microservico novo.
- **Tenant Isolation Is A Design Constraint**: Pass. Conexao, tentativa, credencial, notificacao, auditoria, run e movimento carregam tenant; callback resolve tenant somente pelo state persistido; webhook resolve pela conta externa.
- **Tests Protect Operational Flow**: Pass. Testes cobrem state/PKCE, write-only, concorrencia, rotacao, 401, assinatura, idempotencia, preview/importacao e acesso cruzado; POC real e gate de rollout.
- **MVP Scope Promotion**: Pass with explicit promotion. A constituicao adia integracoes financeiras, mas a especificacao promove Mercado Pago com entregas, limites e gate Point explicitos.
- **Pre-implementation artifacts**: Pass. Spec, plan, research, data model, contracts, quickstart e `tasks.md` estao completos.
- **Post-design re-check**: Pass. O desenho reutiliza o pipeline e a cifra existentes, adiciona somente persistencia necessaria e nao introduz violacao sem justificativa.

## Project Structure

### Documentation (this feature)

```text
specs/014-mercado-pago-oauth/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- mercado-pago.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/
|-- api/
|   `-- src/management/sales-integrations/
|       |-- dto/
|       |-- mercado-pago/
|       |   |-- mercado-pago-oauth.service.ts
|       |   |-- mercado-pago.client.ts
|       |   |-- mercado-pago.mapper.ts
|       |   |-- mercado-pago-webhook.service.ts
|       |   |-- mercado-pago-refresh.service.ts
|       |   `-- mercado-pago-sales-provider.adapter.ts
|       |-- sales-provider.adapter.ts
|       |-- sales-import-run.processor.ts
|       `-- sales-integrations.module.ts
`-- web/
    `-- app/admin/orders/import/
        |-- sales-integration-panel.tsx
        `-- mercado-pago-connection-panel.tsx
packages/
|-- database/prisma/
|   |-- schema.prisma
|   `-- migrations/
`-- types/src/
    `-- sales-integrations.ts
```

**Structure Decision**: Ampliar `management/sales-integrations` porque conexao, coleta e importacao ja pertencem a esse subdominio. A pasta provider-specific encapsula HTTP/OAuth/webhook/mapeamento Mercado Pago; o orchestrator comum recebe um contrato de intervalo paginado e continua responsavel por preview e importacao. Nenhum token ou payload externo chega ao servico de pedidos.

## Design Decisions

- Adicionar `MERCADO_PAGO`, `SalesCredentialMode` e `SalesIntegrationEnvironment`; manter `SalesInputChannel.API` para coleta. Webhook e reconciliacao sao origens de execucao, nao canais de identidade.
- Usar `ACTIVE` e `DISABLED` apenas como estados internos legados; os contratos e a interface Mercado Pago mapeiam esses valores para `CONNECTED` e `DISCONNECTED`, respectivamente, mantendo os demais estados com os nomes da especificacao.
- Evoluir `SalesProviderAdapter.fetchDay` para um contrato de `fetchRange`/paginas. O adapter PagBank implementa o novo contrato decompondo o periodo em dias; Mercado Pago usa `range=money_release_date`, datas, `limit` e `offset`, conforme o batimento com o CDV.
- Manter `SalesIntegrationCredential` versionada, mas armazenar um envelope cifrado tipado. OAuth contem access/refresh/expires/scopes; token fixo contem apenas access token e metadados de validacao. Somente fingerprint e datas ficam fora da cifra.
- Persistir `OAuthAuthorizationAttempt` com hash do state, verifier cifrado, tenant, solicitante, periodo inicial de 30/60/90 dias, expiracao e consumo. O periodo padrao e 30 dias. O callback consome a tentativa atomicamente antes da troca e conclui/expira com estado explicito para impedir replay; depois da conexao integra, cria o run inicial com o periodo persistido.
- Validar token fixo por chamada autenticada que devolva a identidade da conta; a UI envia o segredo uma vez. Troca de modo usa credencial candidata e so rotaciona a ativa depois de validacao completa.
- Adicionar ambiente a `SalesIntegration` e aos indices de identidade. A migracao preenche `PRODUCTION` para PagBank existente e troca unicidade por `(tenantId, provider, channel, environment)`.
- Usar claim de banco com `operationLockUntil`/`operationLockOwner` na conexao para renovacao e sincronizacao. O par OAuth novo e persistido em uma transacao; falha apos sucesso remoto marca `REAUTHORIZATION_REQUIRED`, pois repetir refresh pode invalidar a cadeia.
- Receber webhook em controller publico com raw body/headers necessarios, validar HMAC e timestamp, persistir chave idempotente e responder antes do processamento. O worker resolve `providerUserId`, carrega a conexao e busca `payment` ou `order` canonico.
- Nao assumir que `/v1/payments/search` cobre Point. O adapter de pagamento entra primeiro; o mapper de `order` e topicos habilitados ficam atras de capability/feature flag ate o POC real confirmar identificadores, valores e notificacoes.
- Reutilizar `ExternalSalesMovement` para snapshots por run. Adicionar `ProviderTransactionState` como estado canonico mutavel por conexao para reconciliacao; ele aponta para a identidade/pedido quando houver, evitando editar payloads historicos de runs.
- Importar apenas pagamento/order aprovado e liquidamente elegivel. Cancelamento, estorno e contestacao atualizam o estado canonico e auditoria, geram atencao operacional e nao alteram pedido automaticamente.
- Jobs internos: refresh diario; reconciliacao curta a cada 15 minutos; longa diaria. Claims no banco tornam execucao segura em multiplas instancias sem adicionar broker nesta fase.
- Inicializar `ScheduleModule` uma unica vez no modulo de integracoes e registrar os schedulers de refresh/reconciliacao; callback e webhook publicos usam os caminhos canonicos `/api/integrations/mercadopago/callback` e `/api/webhooks/mercadopago`.

## Complexity Tracking

No constitution violations requiring exception.
