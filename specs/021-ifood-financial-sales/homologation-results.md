# Homologation Results: Sincronização de Vendas Financeiras iFood

**Status**: Evidência de ambiente de teste (sandbox interno). Homologação formal junto ao iFood
ainda não realizada — produção permanece bloqueada pelo gate de US5 até aprovação do provedor.

## Ambiente

- Execução local, sem credenciais reais do iFood (fixtures sanitizadas em
  `apps/api/src/management/sales-integrations/ifood/__fixtures__/ifood-financial.fixtures.ts`).
- Nenhum token, documento, dado bancário ou NSU real foi usado ou versionado; todos os testes usam
  valores sintéticos (`token`, `merchant-1`, `sale-1`, etc.).
- Banco de dados: Postgres local (`docker compose up -d postgres`), sem dados de produção.

## Automated validation (T083)

| Verificação                                | Resultado                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run typecheck` (todos os workspaces)   | OK — sem erros em api, web, database, types, ui.                             |
| `npm run lint` (todos os workspaces)        | OK — sem erros após correção de 3 usos de `any` em testes iFood pré-existentes. |
| `npm run test --workspace @burgoos/web`     | OK — 129 testes, 54 arquivos.                                                 |
| `npm run test --workspace @burgoos/database`| OK — 10 testes (schema.spec.ts).                                             |
| `npm run test --workspace @burgoos/api`     | Ver observações abaixo.                                                      |

## Regression suites (T084)

Suítes unitárias/mockadas de PagBank, Mercado Pago e iFood operacional executadas isoladamente:

- `pagbank/*.spec.ts`, `mercado-pago/*.spec.ts`, `mercado-pago-point/*.spec.ts`,
  `management/integrations/ifood/*.spec.ts`, `test/ifood-tenant-isolation.e2e.spec.ts` e os
  `test/mercado-pago-*.e2e-spec.ts` — **162 testes passando** (1 falha pré-existente e não
  relacionada, ver observações).

## Resume/retry/race/isolation/monetary checks (T086)

Executados via os testes automatizados equivalentes aos passos manuais do quickstart (não houve
navegação manual em navegador neste ambiente):

| Cenário do quickstart          | Cobertura automatizada                                                          | Resultado |
| ------------------------------- | -------------------------------------------------------------------------------- | --------- |
| Retry (timeout/429/5xx)         | `ifood-financial.client.spec.ts`                                                 | OK        |
| Race (confirmação concorrente)  | `sales-import-confirmation.service.spec.ts`, `ifood-financial-sales-import.e2e-spec.ts` | OK |
| Isolamento entre tenants        | `ifood-tenant-isolation.e2e.spec.ts`, teste de identidade cross-tenant           | OK        |
| Tolerância monetária R$ 0,01    | `ifood-financial-reconciliation.service.spec.ts`, `sales-report.service.spec.ts` | OK        |
| Retomada parcial (eventos)      | `ifood-financial-reconciliation.service.spec.ts` (`cursor.eventsDone`)          | OK        |

## Known observations (não bloqueantes para este ambiente)

1. **Testes de integração dependentes de bootstrap completo do `AppModule`**
   (`apps/api/test/*.integration.spec.ts`, alguns `*.e2e-spec.ts`) falham neste ambiente sandbox
   por uma falha de injeção de dependência pré-existente em `BackgroundJobWorker` (não relacionada
   à feature iFood — confirmado via comparação antes/depois das mudanças desta feature). Não é
   causado por este trabalho; requer investigação separada da infraestrutura de testes.
2. **`test/ordering.spec.ts` — "allows only operational order status transitions"**: falha
   pré-existente, confirmada independente das mudanças desta feature (mesma falha com e sem o
   trabalho de iFood aplicado). Fora do escopo desta feature.
3. **`test/mercado-pago-webhook.e2e-spec.ts` — teste de carga de 100 notificações**: falha
   pré-existente (`this.configuration.value is not a function`), confirmada independente das
   mudanças desta feature. Fora do escopo desta feature.
4. **Corrigido nesta sessão**: três testes de `sales-report` (`test/sales-report.spec.ts`,
   `test/sales-report-memory.integration.spec.ts`,
   `test/pos-migration-compatibility.integration.spec.ts`) estavam com mocks desatualizados em
   relação à extensão do relatório para incluir dados financeiros do iFood (`$queryRaw` adicional
   e `externalFinancialSale.findMany`) feita em fase anterior desta mesma feature (US3). Mocks
   atualizados; os três testes voltaram a passar.
5. **Regeneração do Prisma Client**: `prisma generate` atualizou com sucesso os tipos TypeScript
   (incluindo os modelos/enums iFood), mas não conseguiu substituir o binário do query engine
   nativo porque o servidor de desenvolvimento local (`npm run dev --workspace @burgoos/api`)
   mantinha o arquivo aberto. Não bloqueia o uso do client gerado; reiniciar o servidor de dev e
   rodar `prisma generate` novamente conclui a troca do binário quando necessário.

## Unresolved provider observations (para a homologação formal com o iFood)

Itens que só podem ser confirmados com acesso real ao ambiente de homologação do iFood, listados
no `quickstart.md` (seção "Homologation") e ainda pendentes:

- Confirmar formato exato de erro 401/403/429 retornado pela API Sales/Financial Events/Settlements
  em produção (mapeamento atual baseado na documentação pública e nos fixtures sanitizados).
- Confirmar paginação completa (`pageCount`) em períodos de 90 dias com alto volume real.
- Confirmar reutilização da solicitação de arquivo de conciliação dentro da janela de seis horas
  com o endpoint real de Reconciliation On Demand.
- Registrar evidência não sensível da homologação (sem tokens, documentos, dados bancários ou NSU)
  após liberação do merchant de teste pelo iFood.

## Production gate

Produção permanece bloqueada (`READY_PRODUCTION` não habilitado) até que:

1. A homologação formal com o iFood seja concluída e aprovada.
2. Os itens da seção "Unresolved provider observations" sejam confirmados com o provedor.
3. A evidência sanitizada da homologação seja registrada neste arquivo.
