# Data Model: Eficiência de armazenamento e da tela de importação de vendas

A feature quase não muda o esquema. O comportamento muda em cima das tabelas existentes.

## Mudanças de esquema

### `fiscal_documents` (migração `20261116120000_fiscal_files_missing`)

| Campo | Tipo | Regra |
|---|---|---|
| `files_missing_at` | `timestamptz NULL` | Preenchido pela recuperação quando o XML não pôde ser obtido. Limpo quando a recuperação consegue o arquivo |
| `files_missing_reason` | `varchar(500) NULL` | Motivo legível, sem segredos ("Provedor nao retornou o XML", "Nota nao encontrada no provedor" etc.) |

`pendingReason()` devolve `FILES_MISSING` quando `files_missing_at` não é nulo. A prioridade fica depois de `TAX_DIVERGENCE` e antes de `null`.

### `packages/types`

- `FiscalPendingReason` += `"FILES_MISSING"`.
- `FiscalReadinessKey` += `"STORAGE"`, um item de aviso que não bloqueia.
- `ProductOption = { id: string; name: string; price: string; active: boolean }`.
- `SalesImportRunListQuery.trigger?: "MANUAL" | "AUTOMATIC" | "INITIAL_LOAD"`.

## Regras novas sobre tabelas existentes

### `sales_import_runs` / `sales_import_days` / `external_sales_movements`

| Regra | Onde | Detalhe |
|---|---|---|
| Venda conhecida no automático não vira movimento | `SalesImportPreviewService.process(..., { persistKnownSales: false })` | "Conhecida" quer dizer que existe `ExternalSaleIdentity` com (tenant, provider, environment, externalSaleId). `counts.duplicate` continua contando essas vendas |
| A manual continua gravando tudo | padrão `persistKnownSales: true` | A pré-visualização mostra novas, duplicadas e rejeitadas (FR-004) |
| Compactação | retenção | `DELETE` de movimentos `DUPLICATE` de execuções `AUTOMATIC` em status terminal (`COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`) |
| Execução automática sem novidade | retenção | `DELETE` de execuções `AUTOMATIC` com `counts->>'new' = '0'` e `created_at < now() - interval '2 days'` (dias e movimentos caem em cascata) |
| Redação do payload | retenção | `raw_payload = {"redacted":true,"redactedAt":...}` em movimentos com `created_at < now() - interval '30 days'` que ainda não foram redigidos |
| Prazo atual | retenção (sem mudança) | Execuções terminais com mais de 180 dias são apagadas |

Os passos de retenção rodam em lotes de 2.000 ids, dentro do prazo da rotina (`RETENTION_DEADLINE_MS`), e continuam no próximo ciclo se sobrar trabalho (`hasMore`).

### `external_sale_identities` / `provider_transaction_states` / `orders`

Nada muda no esquema, e a limpeza não toca nessas tabelas. Mudam duas coisas no comportamento:
- `provider_transaction_states` continua recebendo `upsertFromMovement` em todo ciclo, inclusive para vendas conhecidas;
- em `orders`, `reconcileKnownSales` só atualiza `paymentGrossAmount`, `paymentFeeAmount`, `paymentNetAmount`, `paymentReleaseExpectedAt` e `paymentReleaseSource` quando algum valor difere do que já está gravado.

### `products.image_url` / `store_visual_configurations.*_url`

| Estado | Valor | Situação |
|---|---|---|
| Legado | `data:image/...;base64,...` | Só leitura até a migração. Recusado para gravação depois da US4 (FR-019) |
| Chave legada | `tenants/{tenantId}/images/{purpose}/{uuid}.{ext}` | Aceita na leitura (imagem de teste de 16/11). A migração não mexe nela |
| Chave nova | `images/{tenantId}/{purpose}/{uuid}.{ext}` | Padrão para gravações novas |
| URL http(s) | URL externa | Aceita, sem mudança |

Transição: `base64 → (job de migração) → chave nova`. A troca de imagem apaga a chave anterior (FR-020).

## Layout do bucket (`asset-keys.ts`)

| Tipo | Chave | Regra no bucket |
|---|---|---|
| XML de autorização | `fiscal/{tenantId}/{AAAA}/{MM}/{chaveAcesso}.xml` | Trava de 5 anos |
| XML de cancelamento | `fiscal/{tenantId}/{AAAA}/{MM}/{chaveAcesso}-cancelamento.xml` | Trava de 5 anos |
| DANFE (PDF) | `fiscal/{tenantId}/{AAAA}/{MM}/{chaveAcesso}.pdf` | Trava de 5 anos |
| Imagem | `images/{tenantId}/{product\|branding-logo\|branding-header\|branding-body\|branding-footer}/{uuid}.{png\|jpg\|webp}` | Sem expiração |
| Exportação | `exports/{tenantId}/{jobId}/{arquivo}` | Expira em 7 dias |

`AAAA/MM` vêm da data de emissão em `America/Sao_Paulo`. Quando não há chave de acesso, usa-se o id do documento, como hoje.

## Jobs duráveis novos (`background_jobs.type`)

| Tipo | Alvo | Dedupe | Política |
|---|---|---|---|
| `FISCAL_FILE_RECOVERY` | `TENANT` / tenantId | `fiscal-file-recovery:{tenantId}` | `maxAttempts 3`, lease de 10 min. Processa até o prazo e se reagenda se sobrar |
| `LEGACY_IMAGE_MIGRATION` | `TENANT` / tenantId | `legacy-image-migration:{tenantId}` | `maxAttempts 3`, lease de 10 min. Uma imagem por iteração |
