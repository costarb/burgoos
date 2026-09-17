# Implementation Plan: Sincronização de Vendas Financeiras iFood

**Branch**: `021-ifood-financial-sales` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-ifood-financial-sales/spec.md`

## Summary

Adicionar o iFood ao pipeline comum de integrações de vendas, reutilizando a autorização da integração operacional e consultando vendas por intervalos paginados. Cada venda será persistida como fotografia financeira canônica: pedidos operacionais existentes serão enriquecidos pelo identificador externo; vendas concluídas ausentes poderão criar pedidos históricos consolidados. Pagamentos, parcelas, eventos financeiros e liquidações serão modelados separadamente para não reduzir múltiplos recebedores e datas aos campos escalares legados do pedido. A ativação produtiva dependerá de reconciliação mínima e evidência de homologação financeira.

## Technical Context

**Language/Version**: TypeScript strict, Node.js 20+

**Primary Dependencies**: NestJS, Prisma ORM, PostgreSQL, Next.js App Router, React, API REST iFood Financial e autenticação iFood existente

**Storage**: PostgreSQL para conexões, vendas canônicas, pagamentos, parcelas, eventos, liquidações, execuções e auditoria; payload externo redigido em JSON somente para diagnóstico controlado

**Testing**: Vitest para clientes, mappers e serviços; testes de integração NestJS/Prisma; Vitest + React Testing Library para o fluxo administrativo (componentes `.spec.tsx`); prova de aceite no ambiente de homologação iFood

**Target Platform**: API e worker Linux; frontend web responsivo; desenvolvimento local Windows

**Project Type**: Monorepo web com frontend, API modular e pacotes compartilhados

**Performance Goals**: exibir execução/progresso em até 5 segundos; processar intervalos de até 90 dias sem lacunas; manter paginação de 100 registros; retomar falhas sem reprocessamento destrutivo

**Constraints**: OAuth Bearer com validade variável; permissão financeira por merchant; rate limit externo; datas comerciais no timezone da loja; idempotência entre ingestão operacional e financeira; ausência de itens detalhados na fonte financeira; uma conexão por tenant/provider/ambiente; homologação obrigatória antes de produção

**Scale/Scope**: dezenas a centenas de estabelecimentos, uma conexão iFood por tenant, carga inicial de 90 dias, sincronizações manuais e reconciliação periódica; API Sales, eventos financeiros e liquidações no escopo

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Real Operation First**: Pass with explicit promotion. A especificação promove uma integração de marketplace já necessária ao piloto e entrega valor incremental por consulta, preview e importação.
- **TypeScript Strict By Default**: Pass. Contratos externos serão validados e normalizados antes de alcançar serviços de pedido ou persistência.
- **Modular Monolith, Domain-Oriented**: Pass. Autorização permanece em Delivery Integrations; coleta financeira e importação permanecem em Sales Integrations; relatórios consomem os dados comuns.
- **Tenant Isolation Is A Design Constraint**: Pass. Todas as novas chaves e consultas incluem tenant, integração, merchant e ambiente quando aplicável.
- **Tests Protect Operational Flow**: Pass. Deduplicação cruzada, valores financeiros, retomada, timezone, isolamento e regressão dos providers existentes terão cobertura.
- **Quality Gates**: Pass for planning. `spec.md`, pesquisa, modelo, contrato e quickstart ficam explícitos; `tasks.md` será gerado na etapa seguinte.

## Project Structure

### Documentation (this feature)

```text
specs/021-ifood-financial-sales/
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- ifood-financial-admin.openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/api/src/management/
|-- integrations/ifood/
|   |-- ifood-auth.service.ts
|   `-- ifood-client.ts
|-- sales-integrations/
|   |-- ifood/
|   |   |-- ifood-financial.client.ts
|   |   |-- ifood-financial.types.ts
|   |   |-- ifood-financial.controller.ts
|   |   |-- ifood-sales.mapper.ts
|   |   |-- ifood-sales-provider.adapter.ts
|   |   |-- ifood-financial-credential.service.ts
|   |   |-- ifood-financial-sale.service.ts
|   |   |-- ifood-financial-readiness.service.ts
|   |   |-- ifood-financial-reconciliation.mapper.ts
|   |   |-- ifood-financial-reconciliation.service.ts
|   |   |-- ifood-financial-reconciliation.processor.ts
|   |   |-- ifood-financial-observability.service.ts
|   |   |-- __fixtures__/
|   |   `-- *.spec.ts
|   |-- sales-import-preview.service.ts
|   |-- sales-import-confirmation.service.ts
|   |-- sales-import-retention.service.ts
|   |-- external-sale-identity.service.ts
|   `-- sales-integrations.module.ts
`-- reports/
    `-- sales-report.service.ts

apps/web/app/admin/orders/import/
|-- sales-integration-panel.tsx
|-- ifood-financial-panel.tsx
`-- *.spec.tsx

apps/web/app/admin/reports/sales/
|-- sales-report-client.tsx
|-- ifood-financial-details.tsx
`-- ifood-financial-details.spec.tsx

packages/database/prisma/
|-- schema.prisma
`-- migrations/

packages/types/src/
|-- index.ts
`-- sales-integrations.ts
```

**Structure Decision**: ampliar o domínio comum `management/sales-integrations` com um adapter financeiro iFood. A integração operacional continua proprietária do OAuth e dos detalhes completos do pedido; um serviço estreito fornece credenciais válidas ao adapter financeiro. O domínio comum continua proprietário de preview, confirmação, identidade externa e criação histórica. Dados financeiros normalizados são persistidos em entidades comuns, evitando lógica iFood nos relatórios.

## Design

### Autorização compartilhada

1. Uma integração de vendas `IFOOD` referencia a integração operacional iFood do mesmo tenant e ambiente; conexões operacionais legadas são migradas para `PRODUCTION`.
2. O serviço financeiro solicita um token válido ao serviço de autenticação existente; nenhum token é copiado para `SalesIntegrationCredential`.
3. Ativação exige merchant igual nas duas conexões e permissão financeira confirmada.
4. Uma resposta não autorizada permite uma renovação controlada; ausência de escopo resulta em estado de atenção, sem destruir a conexão operacional.

### Coleta, cobertura e retomada

1. O adapter aceita somente intervalos de 1 a 90 dias, rejeita períodos maiores antes da chamada, inicia na página zero e encerra pela metadata de páginas.
2. Resultados são agrupados pela data comercial no timezone informado pelo merchant e produzem evidência diária compatível com o preview atual.
3. A chave de página/intervalo concluído é persistida antes de avançar. Retomadas reutilizam vendas canônicas já persistidas e não apagam movimentos de outra execução.
4. Respostas 401, 403, 429 e 5xx recebem códigos distintos; `retry-after` e backoff limitam nova tentativa.

### Classificação e valores

1. `CONCLUDED` é elegível para criação histórica. `CANCELLED` e estados desconhecidos são persistidos, mas não criam pedido concluído.
2. O valor do item consolidado usa o valor da cesta (`bag`), preservando entrega, taxa de serviço, benefícios e total pago em campos financeiros próprios.
3. `saleBalance` representa saldo financeiro, não pagamento do cliente. Eventos e sinais continuam explícitos.
4. Cada método de pagamento e parcela é preservado; `liability=IFOOD` representa recebimento pelo iFood e `STORE` recebimento direto.
5. Método futuro permanece com código bruto e mapeamento nulo até revisão.

### Deduplicação híbrida

1. Localizar primeiro `PlatformOrderLink` por provider, merchant e `sale.id`.
2. Quando encontrado, criar/atualizar a identidade financeira apontando para o pedido operacional e apenas enriquecê-lo.
3. Na ausência do link, reivindicar `ExternalSaleIdentity` antes de criar o pedido histórico.
4. Se o pedido operacional chegar durante a importação, a transação que perder a disputa reutiliza o pedido vencedor ou registra conflito recuperável; nunca mantém dois pedidos ativos para a mesma identidade.
5. A identidade financeira é a barreira final entre execuções manuais, retomadas e reconciliação.

### Reconciliação

1. A fotografia da venda é atualizável; eventos financeiros são imutáveis e idempotentes.
2. Eventos com impacto compõem saldo esperado; eventos informativos permanecem consultáveis sem alterar o total.
3. Parcelas preservam datas esperadas individualmente.
4. Liquidações são armazenadas por título/fechamento; divergência absoluta maior que R$ 0,01 abre estado de revisão.
5. Solicitações de reconciliação on-demand são persistidas, respeitam a janela de seis horas, acompanham processamento assíncrono e disponibilizam download temporário sem armazenar o arquivo como fonte de pedidos.
6. Nenhum evento financeiro altera destrutivamente status ou existência do pedido nesta entrega.

### Compatibilidade e rollout

1. PagBank e Mercado Pago continuam usando o adapter e identidades atuais.
2. Campos escalares de `Order` permanecem por compatibilidade, mas o relatório usa as entidades financeiras para iFood quando houver múltiplos componentes.
3. Homologação começa com consultas no ambiente de teste e cabeçalho exigido pelo provider.
4. Produção exige evidência de Sales, Financial Events, Settlements, Reconciliation On Demand, paginação, erros, filtros de impacto, download e clareza de interface.

## Test Strategy

- **Contrato/mapper**: concluído, cancelado, pagamento online/offline, múltiplos meios, parcelas, benefícios, códigos desconhecidos e timezone.
- **Cliente**: paginação zero-based, intervalo máximo, metadata, timeout, 401/refresh, 403, 429/retry-after e redaction.
- **Serviço**: enrich versus create, corrida com ingestão operacional, repetição, retomada, isolamento e vínculo merchant/tenant.
- **Persistência**: unicidades de venda, pagamento, parcela, evento e liquidação; sinais monetários e precisão decimal.
- **Relatórios**: filtros iFood, bruto versus líquido, liability da loja/iFood, eventos com/sem impacto e divergência.
- **UI/E2E**: ativação, readiness, preview, confirmação, progresso, erro parcial e histórico consolidado.
- **Regressão**: suítes PagBank, Mercado Pago, iFood operacional, pedidos, estoque e relatório de vendas.
- **Homologação**: execução guiada conforme `quickstart.md`, sem credenciais ou dados pessoais nos artefatos.

## Constitution Check - Post Design

- **Real Operation First**: Pass. O primeiro corte entrega consulta e importação segura; conciliação completa é gate de produção, não bloqueio para POC.
- **Strict Contracts**: Pass. Payload externo não tipado fica confinado ao client/mapper; contratos internos e persistidos são explícitos.
- **Modular Monolith**: Pass. Não há serviço externo novo, broker novo ou duplicação do domínio de autenticação.
- **Tenant Isolation**: Pass. Chaves compostas, resolução autenticada e testes de dois tenants são parte do desenho.
- **Operational Tests**: Pass. Os riscos de duplicidade e distorção financeira têm cenários de integração e E2E.
- **Scope Discipline**: Pass with promotion recorded in the spec. Fiscal, reconstrução de itens e mutações destrutivas permanecem fora.

## Complexity Tracking

Nenhuma violação constitucional não justificada. A promoção da integração financeira está formalizada na especificação e reutiliza módulos existentes.
