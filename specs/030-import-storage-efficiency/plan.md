# Implementation Plan: Eficiência de armazenamento e da tela de importação de vendas

**Branch**: `030-import-storage-efficiency` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

## Summary

A spec trata de quatro problemas de produção encontrados em 16/11. Eles têm causas técnicas diferentes, então o plano tem quatro frentes que podem ir para produção em sequência:

1. **US1 (importação automática enxuta)**: o ciclo automático deixa de gravar como movimento as vendas que já têm `ExternalSaleIdentity`. A conciliação dessas vendas (taxa, líquido e data de liberação no pedido) passa a ser feita em memória, e o pedido só é atualizado quando algum valor muda. A retenção ganha três regras: compactar os movimentos duplicados legados, apagar execuções automáticas sem venda nova depois de 2 dias e redigir o `rawPayload` depois de 30 dias.
2. **US2 (tela de importação leve)**: um endpoint novo, `GET /api/admin/products/options`, devolve só `id`, `name`, `price` e `active`. A página para de chamar `getAdminCatalog()`. O histórico passa a ser filtrado por origem e carregado sob demanda.
3. **US3 (storage persistente e XMLs fiscais)**: as chaves passam a ser montadas num lugar só, com layout por tipo e depois por loja (`fiscal/`, `images/`, `exports/`) e o mês fiscal no horário de Brasília. Uma rotina recupera do Bling os XMLs que sumiram do storage local e marca como pendência o que não conseguir. Um aviso aparece quando a produção roda com storage local. A configuração do bucket R2 fica documentada.
4. **US4 (imagens fora do banco)**: um job migra as imagens base64 de produtos e da identidade visual para `images/`. O admin passa a receber URLs de leitura assinadas em vez do conteúdo da imagem. A imagem antiga é removida quando substituída, e novos valores base64 são recusados.

Uma tarefa transversal sobe o runtime para **Node 22** (aviso do SDK da AWS).

Decisões em [research.md](./research.md). Modelo em [data-model.md](./data-model.md). Contratos em [contracts/api.md](./contracts/api.md). Operação e configuração do R2 em [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript strict. Node.js 20 hoje e **22** ao fim da feature (FR-021).

**Primary Dependencies**: NestJS 10, Prisma 5, Next.js 14, `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` (já instalados), `@nestjs/schedule`. Nenhuma dependência nova.

**Storage**: PostgreSQL 18 no Render (`basic_256mb`, 1 GB de disco sem crescimento automático). Arquivos no `AssetStorage`: Cloudflare R2 (modo S3) em produção desde 16/11 e disco local em desenvolvimento. Uma migração Prisma pequena adiciona `files_missing_at` e `files_missing_reason` em `fiscal_documents`.

**Testing**: Vitest. Testes unitários para o montador de chaves, a classificação de vendas conhecidas, a conciliação condicional, as regras de retenção e o decodificador de base64. Testes de integração com módulo focado e Prisma em memória ou fake, no padrão das features 025 a 029. Fakes de `AssetStorage` (com `exists` e `createReadUrl`) e do adapter fiscal. Na web, testes da página de importação (sem catálogo) e do histórico filtrado.

**Target Platform**: Render (`burgoos-api` com 512 MB, `burgoos-web`), R2 e PostgreSQL 18.

**Project Type**: monorepo web (API NestJS + web Next.js + pacotes compartilhados).

**Performance Goals**: SC-001 a SC-006 da spec. Uma abertura da tela de importação deve trafegar menos de 200 KB, a importação automática deve acrescentar no máximo 5 MB/dia ao banco, e a memória da API deve crescer no máximo 30 MB por abertura de tela.

**Constraints**:
- `@Inject` explícito: o Vitest não tem decorator metadata (ver memória do projeto).
- O ciclo automático continua sem lançar exceções e continua registrando a saúde da integração da mesma forma.
- A limpeza e as migrações rodam em lotes e são idempotentes. Nenhuma transação longa.
- A migração de imagens processa **uma imagem por vez**, para não repetir o pico de memória.
- A trava de retenção do R2 em `fiscal/` torna as chaves fiscais *write-once*. Nenhum código pode sobrescrever uma chave fiscal já gravada.
- O fuso de negócio é `America/Sao_Paulo`.
- Nenhum segredo do bucket em logs, respostas ou documentação.

**Scale/Scope**: uma loja em produção, cerca de 70 a 150 vendas por dia, 2 provedores automáticos a cada 2 minutos (1.440 ciclos por dia), 40 produtos (36 com foto), cerca de 180 NFC-e.

## Constitution Check

| Princípio | Situação |
|---|---|
| I. Real Operation First | ✅ A feature corrige problemas reais da loja piloto: lentidão, OOM, disco e guarda fiscal. |
| II. TypeScript strict | ✅ DTOs validados. O decodificador de base64 valida o MIME e o tamanho antes de gravar. |
| III. Modular monolith | ✅ As mudanças ficam dentro dos módulos existentes (Sales Integrations, Catalog, Fiscal, Storage, Exports). O montador de chaves fica em `common/storage`. |
| IV. Tenant isolation | ✅ Toda chave começa por tipo seguido do `tenantId`. Os endpoints novos resolvem a loja pelo token. Jobs carregam o `tenantId`. Há teste de isolamento nos endpoints novos. |
| V. Tests protect operational flow | ✅ Testes cobrem a criação de pedidos e de NFC-e pela importação automática (SC-007): nenhum pedido duplicado ou faltante. |
| Technical Standards: "S3-compatible object storage for product images" | ✅ A US4 cumpre esse padrão, que hoje é violado pelo base64 legado. |
| Quality gates | ✅ `spec.md`, `plan.md` e `tasks.md` antes de implementar. Contratos e modelo explícitos. |

Nenhuma violação. *Complexity Tracking* fica vazio.

## Project Structure

### Documentation (this feature)

```text
specs/030-import-storage-efficiency/
├── spec.md
├── plan.md              # este arquivo
├── research.md
├── data-model.md
├── quickstart.md        # configuração do R2, limpeza, recuperação, migração, VACUUM
├── contracts/api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code

```text
packages/database/prisma/
  schema.prisma                                   # fiscal_documents.files_missing_at/reason
  migrations/20261116120000_fiscal_files_missing/

packages/types/src/
  fiscal.ts                                       # FiscalPendingReason += "FILES_MISSING"
  sales-integrations.ts (ou equivalente)          # ProductOption, filtro trigger do histórico

apps/api/src/common/storage/
  asset-keys.ts                                   # NOVO: fiscalKey / imageKey / exportKey / isStoredAssetKey
  asset-storage.ts                                # + exists(key), createReadUrl(key, ttl)
  s3-asset-storage.service.ts                     # HeadObject + presigned GET
  local-asset-storage.service.ts                  # fs.stat + URL local assinada (HMAC)
  local-asset-read.controller.ts                  # NOVO (só storage local): GET assinado
  asset-upload.service.ts                         # usa imageKey()
  storage-health.ts                               # NOVO: aviso de storage local em produção

apps/api/src/management/sales-integrations/
  sales-import-preview.service.ts                 # modo "persistKnownSales=false"; checagem de identidade em lote
  sales-import-confirmation.service.ts            # reconcileKnownSales(): atualização condicional do pedido
  auto-import/sales-auto-import.service.ts        # usa o novo modo; atraso calculado em memória
  sales-import-retention.service.ts               # compactação, runs sem novidade, redação do rawPayload
  sales-import-history.service.ts                 # filtro trigger; select enxuto
  dto/sales-integration.dto.ts                    # trigger?: MANUAL|AUTOMATIC|INITIAL_LOAD

apps/api/src/catalog/
  controllers/admin-product.controller.ts         # GET /admin/products/options
  catalog.service.ts                              # listProductOptions(); imageUrl resolvido; remoção da imagem antiga
  legacy-image-migration.service.ts               # NOVO: job durável de migração base64 → images/
apps/api/src/customer-experience/branding/store-branding.service.ts  # mesma regra para logo/cabeçalho/corpo/rodapé

apps/api/src/management/fiscal/documents/
  fiscal-document-storage.service.ts              # delega a asset-keys (mês no horário de Brasília)
  fiscal-file-recovery.service.ts                 # NOVO: job durável de recuperação de XML/DANFE
  fiscal-documents.service.ts                     # pendingReason FILES_MISSING; endpoint de recuperação
apps/api/src/management/fiscal/configuration/fiscal-readiness.service.ts  # item STORAGE (aviso)

apps/api/src/management/exports/export-job.worker.ts   # usa exportKey()

apps/web/app/admin/orders/import/
  page.tsx                                        # token + productOptions + institutions (sem catálogo)
  order-import-client.tsx / sales-integration-panel.tsx / sales-auto-import-card.tsx
                                                  # tipo ProductOption; histórico sob demanda e filtrado
apps/web/lib/api.ts                               # listProductOptions(), listSalesImportRuns({trigger})
apps/web/app/admin/fiscal/fiscal-labels.ts        # rótulo FILES_MISSING

package.json, apps/*/package.json, .node-version  # Node 22
docs/ARCHITECTURE.md, docs/USER_GUIDE.md          # layout do bucket, retenção, recuperação
```

**Structure Decision**: o monorepo existente (`apps/api`, `apps/web`, `packages/*`) não muda. O código novo fica nos módulos donos de cada dado. A regra de montagem de chaves fica num só arquivo (`asset-keys.ts`), para que o layout do bucket não volte a divergir.

## Ordem de entrega

Todas as fases ficam na mesma branch. Cada fase é mergeada em `develop` e depois em `main` quando termina, para que a US1 não espere as demais:

| Fase | Conteúdo | Depende de |
|---|---|---|
| A | US1 + US2 | — |
| B | US3: chaves, recuperação, aviso e quickstart do R2 | Fase A não é obrigatória |
| C | US4: migração de imagens e URLs assinadas | B (`asset-keys`, `createReadUrl`) |
| D | Node 22 | — (isolada para limitar o risco) |

## Complexity Tracking

Nenhuma violação da constituição.
