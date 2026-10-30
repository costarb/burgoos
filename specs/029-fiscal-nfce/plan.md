# Implementation Plan: Módulo Fiscal — Emissão de NFC-e por Provedor Configurável

**Branch**: `029-fiscal-nfce` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

## Summary

Novo domínio **Fiscal** no monólito (`apps/api/src/management/fiscal`) que emite e acompanha a NFC-e das vendas de balcão/comanda, importadas e via API, através de um **contrato de provedor** com capacidades declaradas. O primeiro adapter é o **Bling** (OAuth2). A configuração é por empresa: emitente, provedor/conexão, ambiente, modo automático ou manual, certificado A1, perfis fiscais e mapeamento de pagamentos.

O cancelamento acompanha o pedido. Como o Bling não cancela NFC-e pela API, o fluxo é assistido: notificação urgente e detecção do cancelamento por sincronização. Uma **importação automática a cada 2 minutos** (Mercado Pago e PagBank) alimenta a meta de nota em até 5 minutos, com logs estruturados para monitoria.

Decisões de pesquisa em [research.md](./research.md). Modelo em [data-model.md](./data-model.md). Contratos em [contracts/fiscal-api.md](./contracts/fiscal-api.md).

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20 · **Dependencies**: NestJS 10, Prisma 5, Next.js 14, `@nestjs/schedule`. **Nova**: `node-forge` (+ `@types/node-forge`) para ler o PKCS#12. Para o ZIP da exportação, usar `archiver`/`jszip`, que já são dependências transitivas; declarar explicitamente a que for usada.

**Storage**: PostgreSQL (tabelas do data-model; migração `20261031100000_fiscal_nfce`). XML/DANFE no `AssetStorage` (S3 ou local) com chave `fiscal/<tenant>/<aaaa>/<mm>/<chave>.<ext>`.

**Testing**: Vitest. Unit (compositor, mapeamento tPag, validações CNPJ/IE/CSOSN, transições, regra "do dia", leitura do PFX com certificado de teste gerado no próprio teste). Integração com módulo focado + Prisma em memória (padrão das features 025–028), com um **adapter fake** configurável (autoriza, rejeita, timeout, sem cancelamento, cancela). Adapter Bling com respostas gravadas em fixtures (`__fixtures__`) depois da T001. Web: telas de configuração, perfis, pendências e status no pedido.

**Target Platform**: Render (API + web + worker de background jobs), PostgreSQL 18.

**Constraints**:
- `@Inject` explícito (Vitest sem decorator metadata).
- Hooks fiscais nunca quebram o fluxo de venda: falha do fiscal é logada e recuperada pela varredura.
- Concorrência 1 por empresa nas chamadas ao Bling (limite de requisições).
- Nada de segredos ou CPF completo em logs/respostas.
- Fuso de negócio `America/Sao_Paulo` (`BUSINESS_TIME_ZONE`).

## Constitution Check

- **Escopo**: a constituição lista "Fiscal/NF-e" como adiado; esta spec o promove (Governança: spec + plan + tasks atualizados juntos). Registrar a emenda da seção "Explicitly Deferred" ao concluir.
- **Multi-tenant**: todas as tabelas com `tenant_id`; ids sempre buscados com o tenant do usuário; jobs carregam `tenantId`; teste de isolamento obrigatório (FR-033).
- **Modular monolith**: novo módulo `FiscalModule` em Management; integração com Ordering/Payments por serviços injetados (hooks), sem acesso cruzado a tabelas fora de transações já existentes.
- **Tipagem/validação**: DTOs com class-validator; respostas do provedor validadas com zod antes do mapeamento.
- **Testes**: transições, idempotência (SC-005), cancelamento (SC-003), regra do dia, isolamento.

## Project Structure

```text
packages/database/prisma/
  schema.prisma                                   # enums + tabelas fiscais; campos em orders, service_tabs,
                                                  # sales_integrations, categories, products, product_complements
  migrations/20261031100000_fiscal_nfce/          # + CHECK (order_id XOR service_tab_id)
  seed.ts                                         # permissões fiscal.* nos perfis padrão

apps/api/src/management/fiscal/                   # NOVO
  fiscal.module.ts
  fiscal-permissions.ts                           # chaves fiscal.view|configure|issue|cancel
  configuration/
    fiscal-configuration.controller.ts|service.ts # GET/PUT configuração, prontidão
    fiscal-issuer.service.ts                      # emitente + endereço do Tenant.config + IBGE
    ibge-municipality.client.ts
    fiscal-readiness.service.ts
    br-documents.ts                               # DV de CNPJ/CPF, IE por UF (SP completo; demais: formato)
  certificates/
    fiscal-certificate.controller.ts|service.ts   # upload, metadados, rotação
    pkcs12-reader.ts                              # node-forge
    certificate-expiry.scheduler.ts               # diário 08:00
  profiles/
    fiscal-profile.controller.ts|service.ts       # CRUD, atribuição em lote, faltantes
    fiscal-profile-resolver.ts                    # produto→categoria; complemento→complemento→produto
  providers/
    fiscal-provider.adapter.ts                    # contrato + FiscalProviderError
    fiscal-provider.registry.ts
    fiscal-provider-context.service.ts            # tokens decifrados + refresh sob demanda
    bling/
      bling-oauth.service.ts                      # authorize/callback/refresh (padrão Mercado Pago OAuth)
      bling-oauth.controller.ts                   # integrations/bling/callback
      bling-connection.controller.ts|service.ts   # options, settings, disconnect
      bling.client.ts                             # HTTP + zod + rate limit/backoff
      bling-nfce.mapper.ts                        # NfceDraft → payload Bling; resposta → ProviderDocumentState
      bling-fiscal-provider.adapter.ts            # capabilities: cancelViaApi=false
      bling-document-decoder.ts                   # Base64 + GZIP
      bling-token-refresh.scheduler.ts
      __fixtures__/
    testing/fake-fiscal-provider.adapter.ts
  documents/
    nfce-composer.ts                              # itens, complementos, descontos, rateios, pagamentos (tPag)
    fiscal-eligibility.service.ts                 # origem, pago, total > 0, regra do dia, prontidão
    fiscal-trigger.service.ts                     # requestAutomatic(target) — chamado pelos hooks
    fiscal-emission.service.ts                    # cria documento (activeKey), job FISCAL_EMISSION
    fiscal-emission.processor.ts                  # create→submit→estado; timeout→findByReference
    fiscal-sync.processor.ts                      # PROCESSING/CANCEL_PENDING/CANCEL_FAILED via get()
    fiscal-sync.scheduler.ts                      # a cada minuto; nextSyncAt com backoff por idade
    fiscal-sweep.scheduler.ts                     # a cada minuto: vendas do dia sem nota (modo automático)
    fiscal-cancellation.service.ts                # API ou assistido; prazo por UF; notificações
    fiscal-order-guard.service.ts                 # bloqueia alteração com nota ativa
    fiscal-document-storage.service.ts            # grava/lê XML e DANFE no AssetStorage
    fiscal-documents.controller.ts                # lista, detalhe, emitir, reprocessar, cancelar, danfe/xml
    fiscal-audit.service.ts                       # FiscalDocumentEvent + logs estruturados
    cancel-deadlines.ts                           # { SP: 30 } minutos, padrão 30
  exports/fiscal-xml-export.handler.ts            # contexto FISCAL_XML na infraestrutura de exportação

apps/api/src/platform/integrations/
  bling-platform-configuration.controller.ts|service.ts

apps/api/src/management/sales-integrations/
  auto-import/
    sales-auto-import.scheduler.ts                # @Cron a cada 2 min → job SALES_AUTO_IMPORT por integração
    sales-auto-import.processor.ts                # run AUTOMATIC: preview.process + confirmation.confirm
    sales-auto-import-health.service.ts           # contadores, lag, alerta degradado (1/h)
  dto/                                            # autoImport no PATCH; health no GET

apps/api/src/security/integration-secret.service.ts     # envelopes BLING_OAUTH, FISCAL_A1_CERTIFICATE
apps/api/src/management/access/permissions/permission-catalog.ts  # área Fiscal

# Hooks (chamadas a FiscalTriggerService / FiscalCancellationService / FiscalOrderGuard)
apps/api/src/ordering/ordering.service.ts               # CANCELLED → cancelamento
apps/api/src/ordering/order-maintenance.service.ts      # exclusão → cancelamento; edição → guard
apps/api/src/ordering/counter-sales/counter-order.service.ts  # consumerDocument; update → guard; pago na criação → trigger
apps/api/src/ordering/tabs/service-tab.service.ts       # consumerDocument; cancel → cancelamento
apps/api/src/payments/manual/manual-payment.service.ts  # pedido/comanda quitados → trigger
apps/api/src/payments/application/payment-settlement.service.ts  # Point aprovado → trigger
apps/api/src/management/sales-integrations/sales-import-confirmation.service.ts  # pedido criado → trigger (pós-commit)
apps/api/src/ordering/historical-order-import.service.ts  # API/IMPORT por arquivo → trigger (pós-commit)
apps/api/src/ordering/whatsapp-link.ts                  # link de consulta

apps/web/
  app/platform/integrations/                     # cartão Bling (client id/secret)
  app/admin/fiscal/                              # NOVO: configuração (emitente, provedor, Bling, pagamentos,
                                                 #   certificado, prontidão), perfis, atribuições, pendências, notas
  app/admin/orders/                              # coluna/filtro de status fiscal; ações no detalhe; CPF no balcão
  app/admin/tabs/                                # CPF na nota no checkout; status fiscal da comanda
  app/admin/orders/import/                       # importação automática + saúde na integração
  components/admin/admin-navigation.ts           # item "Fiscal" (fiscal.view)
  lib/api.ts                                     # clientes dos endpoints fiscais
```

## Design

**Unidade fiscal.** Pedido avulso (balcão, importado, API) ou comanda inteira (R3). O `FiscalDocument` aponta para um dos dois; `activeKey` (`order:<id>`/`tab:<id>`, unique) impede duas notas ativas. REJECTED e CANCELLED liberam a chave; ERROR mantém, porque a nota pode existir no provedor.

**Emissão.**
1. `FiscalEmissionService.request` valida a elegibilidade, monta o `NfceDraft` (compositor + resolvedor de perfis + snapshot do emitente), cria o documento PENDING com `payloadSnapshot` e enfileira `FISCAL_EMISSION` (`dedupeKey = documentId`, prioridade HIGH).
2. O processor chama `create`, grava o `externalId` na mesma hora e chama `submit`.
3. Resultado AUTHORIZED: grava os dados, baixa XML/DANFE para o storage e loga `saleToAuthorizationSeconds`. PROCESSING: agenda `nextSyncAt`. REJECTED: libera a chave e entra na fila de pendências.
4. Erro retryable: deixa o retry para a política do job (backoff até 6 tentativas), depois ERROR. Timeout em `create`: chama `findByReference` antes de qualquer nova tentativa.
5. Faltando dados (perfil, mapeamento de pagamento): REJECTED local com `MISSING_FISCAL_DATA`, sem chamar o provedor.

**Gatilhos (R8).** Hooks pós-commit chamam `FiscalTriggerService.requestAutomatic`. Ele é envolvido em try/catch e só loga, para nunca derrubar a venda. Ele ignora o pedido quando a empresa está em modo manual ou desativada, a origem não é elegível, a venda não é do dia, não está paga ou já tem documento ativo. A varredura de 1 minuto recupera o que os hooks perderam (`fiscal.trigger.recovered`).

**Cancelamento.**
- *Gatilhos*: pedido `CANCELLED`, exclusão, comanda cancelada ou ação direta.
- *Com nota AUTHORIZED*: vai para CANCEL_PENDING com justificativa e `cancelDeadlineAt = authorizedAt + prazo(UF)`.
  - Com `cancelViaApi`, enfileira `FISCAL_CANCELLATION`.
  - Sem `cancelViaApi` (Bling), cria a notificação ERROR para quem tem `fiscal.cancel`, com prazo, justificativa e `providerPanelUrl`, e um lembrete aos 10 minutos restantes. Loga `cancel_manual_required`.
- *Com nota PROCESSING*: grava `cancelRequestedAt` e aplica a regra acima ao autorizar.
- *Cancelamento de um pedido dentro de uma comanda paga*: cancela a nota da comanda. O usuário refaz o fechamento, e a reemissão é manual com os pedidos restantes.
- *Pós-prazo*: o sync vê o prazo vencido sem cancelamento e marca CANCEL_FAILED, mas continua consultando por 7 dias (cobre cancelamento extemporâneo feito no Bling). Depois para e fica na fila.

**Sincronização.** Agendador a cada minuto seleciona documentos `PROCESSING | CANCEL_PENDING | CANCEL_FAILED` com `nextSyncAt <= now`. Enfileira `FISCAL_SYNC` por documento (dedupe), com concorrência 1 por empresa. O intervalo cresce com a idade:
- 1 minuto na primeira hora;
- 15 minutos até 24 horas;
- 1 hora até 7 dias.
Quando o provedor responde CANCELLED, guarda o XML do cancelamento se o provedor fornecer.

**Guard de alteração.** `FiscalOrderGuard.assertMutable(tenantId, orderId)` lança 409 `FISCAL_DOCUMENT_ACTIVE` quando o pedido (ou a comanda dele) tem nota PROCESSING/AUTHORIZED. Ele é chamado na manutenção de itens/valores e no update do pedido de balcão. Exclusão e cancelamento continuam permitidos e disparam o cancelamento.

**Conexão Bling.** Mesmo desenho do Mercado Pago OAuth:
- `state` assinado com tenant e usuário; callback troca o code por tokens e grava o envelope `BLING_OAUTH`.
- Scheduler renova os tokens antes de expirar. O `FiscalProviderContext` também renova sob demanda em 401, uma vez.
- Falha de refresh: conexão ERROR, log `fiscal.connection.error`, pendência `PROVIDER_DISCONNECTED` nas emissões.
- `options` lista formas de pagamento e naturezas de operação para o mapeamento obrigatório na prontidão.

**Certificado.** Upload multipart, leitura com `pkcs12-reader`. Recusa senha errada, arquivo inválido e certificado vencido. Grava o envelope cifrado e os metadados. O certificado anterior vira REPLACED. Scheduler diário gera as notificações 30/15/7/1 (`lastExpiryAlertDays`). O Bling não usa o certificado (`usesOwnCertificate=false`), então a prontidão só avisa.

**Importação automática (R7).**
- **Agendamento**: `@Cron("0 */2 * * * *")` só no papel consumer (`RuntimeRoleService`). Enfileira um `SALES_AUTO_IMPORT` por integração ativa com `autoImportEnabled` (dedupe por integração, sem sobreposição).
- **Execução**: o processor pega o lock de operação, cria um run AUTOMATIC do dia (e o dia anterior nos primeiros 10 minutos após a meia-noite) e chama `preview.process` e `confirmation.confirm` em sequência, com a estratégia configurada.
- **Sucesso**: zera as falhas, atualiza `autoImportLastSuccessAt` e loga `sales.auto_import.cycle` com contagens e `lagSeconds`.
- **Falha**: incrementa os contadores e loga o ciclo `failed` com `errorCode`. Com 3 ou mais falhas seguidas, ou lag maior que 15 minutos, emite `sales.auto_import.degraded` e uma notificação (no máximo 1 por hora).
- **Fiscal**: os pedidos criados disparam o gatilho fiscal pelo hook da confirmação.

**Exportação ao contador.** *(Ajustado na implementação.)* A infraestrutura de exportação é tabular (CSV/XLSX/PDF), então o ZIP é gerado por um endpoint próprio, `GET admin/fiscal/exports/xml?from&to&environment`, que lê os documentos do período (até 5.000), monta `autorizadas/`, `canceladas/` e `resumo.csv` com o gerador de ZIP extraído para `common/zip` e devolve o arquivo. Homologação só entra quando pedida explicitamente.

**Compartilhamento.** *(Ajustado.)* O link de WhatsApp existente é o do cardápio público (fora do escopo e anterior à nota). O compartilhamento virou um botão "WhatsApp" na célula fiscal do pedido, com a consulta pública da SEFAZ e a chave de acesso.

**Certificado A1.** *(Pendente.)* Todas as versões do `node-forge` até a 1.4.0 têm vulnerabilidades altas no parser ASN.1; as corrigidas (1.4.1/1.4.2) foram publicadas em 2026-10-27. A US6 aguarda decisão (usar a versão nova após avaliação ou outra biblioteca). O Bling não usa o certificado do ERP, então a emissão não depende dela.

**Web.**
- `/admin/fiscal` com abas: Configuração (emitente, provedor/conexão, pagamentos e natureza, certificado, prontidão), Perfis fiscais (CRUD + atribuição em lote por categoria/produto/complemento + faltantes), Notas (lista filtrável) e Pendências (com ações e contador de prazo para cancelamento manual).
- Pedidos: badge de status fiscal, filtro, ações no detalhe (emitir, reprocessar, DANFE, imprimir, abrir no provedor) e campo CPF/CNPJ no fechamento de balcão e comanda.
- Importação: chave "Importação automática" com estratégia e um painel de saúde.

## Test Strategy

- **Compositor (R3/R4)**: complementos pagos viram itens; gratuitos não; ajuste negativo vira desconto; soma igual a `order.total` ao centavo; comanda junta pedidos não cancelados; pagamento dividido e troco; importado sem alocação.
- **Elegibilidade e regra do dia**: venda 23:59 importada 00:01 → manual; modo manual; origem PUBLIC_MENU/IFOOD; total zero; não pago.
- **Emissão (fake)**: autorizado direto; PROCESSING → sync autoriza; rejeição libera a chave e permite reemitir; timeout em `create` → `findByReference` acha e não duplica (SC-005); duas requisições simultâneas → um documento; erro retryable esgotado → ERROR → reprocessar.
- **Cancelamento**: com `cancelViaApi` → CANCELLED; sem → CANCEL_PENDING + notificação + sync detecta CANCELLED; prazo vencido → CANCEL_FAILED; cancelamento durante PROCESSING; exclusão de pedido; comanda; guard bloqueia manutenção (SC-003).
- **Bling**: mapper com fixtures (payload de criação, respostas de consulta, decodificação GZIP+Base64), OAuth callback/refresh, 401 → refresh → retry único, 429 → retryable.
- **Certificado**: PFX de teste gerado com node-forge (válido, vencido, senha errada, CNPJ divergente); resposta sem segredo.
- **Importação automática**: ciclo sucesso/duplicado/sem sobreposição; falha isolada por integração; contadores e alerta degradado com limite de 1/h; virada de dia; logs com os campos de FR-027b.
- **Isolamento**: usuário da empresa B não lê/emite/cancela documentos da A; jobs com tenant errado não processam.
- **Web**: configuração e prontidão, perfis, pendências com prazo, badge/filtro no pedido, CPF no balcão.

## Rollout

1. **T001 (bloqueante)**: validar a API do Bling em homologação com a conta real de SP: criação, envio, consulta, conteúdo de `xml`/links, itens inline vs. produto cadastrado, formas de pagamento e natureza. Gravar as fixtures e ajustar o mapper e o research.
2. Liberar com `enabled=false` e modo MANUAL por padrão. Piloto: homologação → produção em modo manual → automático.
3. Importação automática desligada por padrão por integração. Monitoria: alertas sobre `sales.auto_import.degraded`, `fiscal.document.error`, `fiscal.document.cancel_manual_required` e `fiscal.trigger.recovered`.

## Complexity Tracking

| Ponto | Por que é necessário | Alternativa mais simples rejeitada |
|---|---|---|
| Cancelamento assistido + sincronização | O Bling não tem cancelamento de NFC-e pela API | Cancelar via `DELETE` (não cancela na SEFAZ, gera nota autorizada sem venda) |
| Hooks + varredura | Meta de 30 s no balcão e garantia de não perder vendas | Só varredura (latência de 1–2 min) ou só hooks (perde vendas em falha) |
| Comanda como unidade fiscal | A comanda é paga uma vez, com pagamentos na própria comanda | Uma nota por pedido da comanda (pagamentos não se dividem por pedido) |
| Nova dependência `node-forge` | O Node não lê metadados de PKCS#12 | Pedir validade manual (perde validação de senha/CNPJ) |
