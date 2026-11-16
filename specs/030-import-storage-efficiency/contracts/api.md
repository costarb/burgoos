# API Contracts: spec 030

Todos os endpoints `admin` exigem JWT e resolvem a loja pelo token (`user.tenantId`). Os ids de outra loja devolvem 404.

## Novos

### `GET /api/admin/products/options`

Lista enxuta para seletores (importação, importação automática, produto fixo).

- **Permissão**: `catalog.manage` ou `integrations.sales.view` ou `integrations.sales.manage`
- **Query**: `active?: "true" | "false"` (padrão: todos)
- **200**:
  ```json
  [{ "id": "uuid", "name": "Dogão Clássico", "price": "22.00", "active": true }]
  ```
- **Garantia**: nunca inclui imagem, descrição, categoria nem ficha técnica. Ordenação: nome.

### `POST /api/admin/fiscal/documents/recover-files`

Enfileira a recuperação de XML e DANFE da loja (job `FISCAL_FILE_RECOVERY`). É idempotente: com um job ativo, devolve o mesmo.

- **Permissão**: `fiscal.configure`
- **202**: `{ "jobId": "uuid", "status": "QUEUED" | "RUNNING" }`

### `GET /api/admin/fiscal/documents/recover-files`

Situação da última recuperação.

- **Permissão**: `fiscal.view`
- **200**:
  ```json
  { "status": "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED",
    "checked": 171, "recovered": 165, "missing": 6, "finishedAt": "2026-11-17T07:00:00.000Z" }
  ```

### `POST /api/admin/assets/legacy-images/migrate`

Enfileira a migração das imagens base64 da loja (job `LEGACY_IMAGE_MIGRATION`). É idempotente.

- **Permissão**: `catalog.manage`
- **202**: `{ "jobId": "uuid", "status": "QUEUED" | "RUNNING" }`

### `GET /api/admin/assets/legacy-images/migrate`

- **Permissão**: `catalog.manage`
- **200**: `{ "status": "...", "pending": 36, "migrated": 0, "failed": 0 }`

### `GET /api/assets/local/{key}?exp={epoch}&sig={hmac}` *(somente com `ASSET_STORAGE_PROVIDER=local`)*

Leitura assinada do storage local, para desenvolvimento.

- **200**: stream do arquivo com `Content-Type`
- **403**: assinatura inválida ou expirada
- **404**: arquivo inexistente ou storage diferente de `local`

## Alterados

### `GET /api/admin/sales-import-runs`

- **Query nova**: `trigger?: "MANUAL" | "AUTOMATIC" | "INITIAL_LOAD"`
- **Resposta**: igual à de hoje, mas sem o objeto `integration` aninhado. Nenhum consumidor usa esses campos: foi verificado em 16/11 na web e no MCP (que não consulta o histórico).

### `GET /api/admin/products` (e o item devolvido por `POST`/`PATCH`)

- `imageUrl`: **URL pronta para `<img>`**: URL de leitura assinada (1 h) quando a imagem está no bucket, URL externa quando já era http(s), e `null` sem imagem. Enquanto houver legado, o base64 continua sendo devolvido até a migração.
- **Campo novo** `imageAssetKey: string | null`: a chave crua do bucket, usada pelo formulário para manter a imagem sem reenviar.
- **Gravação** (`POST`/`PATCH` com `imageUrl`): aceita uma chave de asset ou uma URL http(s). **Recusa `data:`** depois da US4 (400 `"Envie a imagem pelo upload"`).

### Identidade visual (`GET/PUT /api/admin/store/branding`)

Mesma regra dos produtos para `logoUrl`, `headerImageUrl`, `bodyImageUrl` e `footerImageUrl`, com campos `*AssetKey`.

### `GET /api/admin/fiscal/...` (pendências e prontidão)

- `pendingReason` pode ser `"FILES_MISSING"`, com `filesMissingReason` no detalhe.
- A prontidão pode trazer `{ key: "STORAGE", ok: false, blocking: false, message: "Arquivos fiscais em storage temporario: configure o storage S3" }`.

### `POST /api/admin/assets/upload-intents`

Sem mudança de formato. `assetKey` passa a vir no layout `images/{tenantId}/{purpose}/{uuid}.{ext}`.

## Eventos de log (contrato de monitoria)

| Evento | Nível | Campos |
|---|---|---|
| `sales.auto_import.cycle` | log/warn | igual a hoje + `known` (vendas conhecidas no ciclo) e `reconciledOrders` (pedidos atualizados) |
| `sales.retention.completed` | log | `compactedMovements`, `deletedRuns`, `redactedPayloads`, `durationMs`, `hasMore` |
| `fiscal.files.recovery_completed` | log | `tenantId`, `checked`, `recovered`, `missing`, `durationMs` |
| `fiscal.files.missing` | warn | `tenantId`, `documentId`, `reason` |
| `catalog.legacy_image.migrated` / `.failed` | log/warn | `tenantId`, `entity`, `entityId`, `bytes` / `reason` |
| `storage.local_in_production` | warn | `provider` |
