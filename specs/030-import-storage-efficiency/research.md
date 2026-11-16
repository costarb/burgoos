# Research: Eficiência de armazenamento e da tela de importação de vendas

Base: verificação de produção de 16/11 (logs e métricas do Render e consultas somente leitura ao Postgres) e leitura do código em `develop` (`d089be5`).

## Evidências de produção (16/11)

| Item | Valor |
|---|---|
| Banco | 233 MB de 1 GB de disco |
| `external_sales_movements` | 117 MB, 25.650 linhas, 4.380 movimentos distintos (`raw_payload` 45 MB, `normalized_data` 48 MB) |
| Execuções automáticas | 720 por dia por provedor. Em 15/11 o Mercado Pago gerou 9.404 movimentos para cerca de 70 vendas |
| `products` | 46 MB para 40 linhas. `image_url` em base64 ocupa 44 MB (36 produtos, até 2,1 MB cada) |
| `store_visual_configurations` | 6,9 MB para 3 linhas (identidade visual em base64) |
| Memória da API | Degraus de +250 MB no primeiro acesso do dia, com o heap JS estável em ~60 MB. OOM em 14/11 às 07:20 (limite de 512 MB) |
| Storage | Local até 16/11 às 11:39. 171 NFC-e autorizadas com `xml_asset_key` apontando para um disco apagado a cada deploy |

## R1. Como deixar de regravar vendas conhecidas sem perder a conciliação

**Decision**: o método `SalesImportPreviewService.process` ganha a opção `persistKnownSales` (padrão `true`). O ciclo automático passa `false`. Nesse modo, uma venda com `ExternalSaleIdentity` existente não vira linha em `external_sales_movements`:
- ela continua passando por `ProviderTransactionStateService.upsertFromMovement` (estado da transação, usado pela conciliação);
- ela é devolvida em memória em `knownSales: { externalSaleId, sale }[]`.

O ciclo automático chama `SalesImportConfirmationService.reconcileKnownSales(...)`, que carrega identidades e pedidos em lote e só faz `order.update` quando bruto, taxa, líquido ou data de liberação mudaram.

**Rationale**:
- Hoje o fluxo `DUPLICATE` da confirmação (`reconcileExistingOrder`) é o que leva ao pedido a taxa e a data de liberação que o Mercado Pago informa depois. Apenas parar de gravar quebraria a conciliação.
- Hoje cada ciclo faz um `order.update` incondicional para cada venda do dia: cerca de 70 escritas a cada 2 minutos, só no Mercado Pago. A atualização condicional elimina quase todas.
- A checagem de duplicidade hoje é um `findUnique` por movimento. Passa a ser um único `findMany ... externalSaleId IN (...)`.

**Alternatives considered**:
- *Uma execução contínua por dia (upsert de movimentos)*: mudaria a semântica de "execução", afetaria o histórico e a tela, e exigiria uma migração. Foi descartada.
- *Comparar com um hash do payload*: exigiria uma coluna nova e ainda gravaria a execução. A comparação direta com o pedido é mais simples e só toca o que importa.
- *Apagar a execução logo depois do ciclo sem novidade*: perderia o diagnóstico recente. A spec pede 2 dias (FR-005).

## R2. Atraso das vendas (`lagSeconds`)

**Decision**: calcular a partir da venda mais recente vista no ciclo, em memória (`latestOccurredAt` devolvido por `process`). Se o ciclo não vir nenhuma venda do dia, o valor fica `null` ("sem vendas hoje"), como já é exibido.

**Rationale**: a consulta atual procura o último movimento do dia em `external_sales_movements`. Sem regravação, o último movimento pode pertencer a uma execução apagada pela retenção. O valor em memória é exato e não consulta o banco.

## R3. Limpeza do acúmulo e retenção

**Decision**: estender `SalesImportRetentionService.purgeBatch` com três passos em SQL bruto, em lotes de 2.000 (`DELETE ... WHERE id IN (SELECT id ... LIMIT 2000)`):
1. **Compactação**: apagar movimentos `status = 'DUPLICATE'` de execuções `trigger = 'AUTOMATIC'` com status terminal. Já foram conciliados quando a execução foi confirmada.
2. **Execuções automáticas sem novidade**: apagar execuções `AUTOMATIC` com `counts->>'new' = '0'` e `created_at < now() - 2 days`. Dias e movimentos caem em cascata.
3. **Redação**: trocar `raw_payload` por `{redacted:true, redactedAt}` em movimentos com mais de 30 dias.

A mesma rotina registra o log `sales.retention.completed` com as contagens e a duração (FR-007).

**Rationale**:
- Os movimentos não são referenciados por nenhuma tabela: `ExternalSaleIdentity` não guarda o id do movimento, e `order` e `providerTransactionState` são do lado do movimento, com `SetNull`. Apagar é seguro.
- A rotina diária já existe e já é idempotente. Basta acrescentar regras.
- Lotes por id evitam transação longa e bloqueio da importação automática.

**Ponto operacional**: no Postgres, `DELETE` não devolve espaço ao disco. O espaço é reaproveitado pelo autovacuum, o que já contém o crescimento. Para devolver os ~100 MB ao disco e cumprir o SC-002, é preciso rodar `VACUUM (FULL, ANALYZE) external_sales_movements;` numa janela sem movimento. Ele bloqueia a tabela por segundos. O passo a passo está no quickstart, e quem executa é o usuário.

**Alternatives considered**: um script único fora da aplicação. Foi descartado porque a regra precisa continuar valendo todo dia e a rotina já roda no worker.

## R4. Tela de importação

**Decision**:
- `GET /api/admin/products/options?active=true` com `select { id, name, price, active }`. Permissão: `catalog.manage`, `integrations.sales.view` ou `integrations.sales.manage`.
- `page.tsx` chama `getAdminToken()`, `listProductOptions()` e `listPaymentInstitutions()` em paralelo.
- `GET /admin/sales-import-runs?trigger=MANUAL` (padrão da tela), com `select` sem a integração aninhada. O histórico carrega quando o `<details>` é aberto.
- `SalesIntegrationPanel` carrega `providers` e `integrations` uma vez. Trocar de provedor não refaz as três chamadas.

**Rationale**: a lista de produtos da tela só precisa de nome e preço. Hoje vêm produtos com base64, categorias e fichas técnicas. O histórico atual mostra 20 itens entre milhares de ciclos automáticos, então o que importa (as importações manuais) fica escondido.

## R5. Layout e regras do bucket

**Decision**: um único módulo `common/storage/asset-keys.ts`:
- `fiscalKey(tenantId, issuedAt, name, kind)` → `fiscal/{tenantId}/{AAAA}/{MM}/{name}{.xml|-cancelamento.xml|.pdf}`, com ano e mês em `America/Sao_Paulo`;
- `imageKey(tenantId, purpose, ext)` → `images/{tenantId}/{product|branding-logo|branding-header|branding-body|branding-footer}/{uuid}.{ext}`;
- `exportKey(tenantId, jobId, fileName)` → `exports/{tenantId}/{jobId}/{fileName}`;
- `isStoredAssetKey(value)` aceita o layout novo e o legado `tenants/{id}/images/...`. A imagem de teste de 16/11 usa o legado.

No R2: uma regra de ciclo de vida que apaga `exports/` em 7 dias e uma *bucket lock rule* de 5 anos em `fiscal/`.

**Rationale**: as regras do bucket funcionam por prefixo. Começar pelo tipo permite uma regra para cada tipo de arquivo, sem código. Hoje as exportações gravam na raiz (`{tenantId}/...`) e nunca são apagadas do storage.

**Consequência da trava**: com a trava, uma chave fiscal só pode ser escrita uma vez. O código atual já grava cada XML uma única vez:
- `storeFiles` grava a autorização e o cancelamento em chaves diferentes;
- `file()` só grava quando o banco não tem a chave.

A recuperação (R6) só grava quando o arquivo não existe. A DANFE do Bling é uma página hospedada (redirect) e não é gravada.

**Alternatives considered**: manter `tenants/{id}/...` como raiz de tudo. Seria mais "multi-tenant", mas impediria regras por tipo no bucket.

## R6. Recuperação dos XMLs fiscais

**Decision**: `FiscalFileRecoveryService`, um job durável (`FISCAL_FILE_RECOVERY`, uma por loja, concorrência 1). Ele percorre as notas `AUTHORIZED` e `CANCELLED` em ordem de emissão:
- se `xmlAssetKey` for nulo ou `!storage.exists(key)`, chama o `storeFiles` existente (autorização e, para canceladas, cancelamento), que regrava na chave nova;
- se falhar, grava `filesMissingAt` e `filesMissingReason`, e a nota entra nas pendências como `FILES_MISSING`;
- em caso de sucesso, limpa esses campos.

O job é disparado por um endpoint (`POST /api/admin/fiscal/documents/recover-files`, permissão `fiscal.configure`) e por um agendamento semanal (domingo às 04:00, horário de Brasília).

**Rationale**: o download pelo provedor já existe (`adapter.downloadXml`). Falta orquestrar e registrar a falha. O ritmo de uma nota por vez respeita o limite do Bling (3 req/s), já tratado no contexto do provedor.

## R7. URLs de imagem no admin

**Decision**: `AssetStorage.createReadUrl(key, ttlSeconds)`:
- **S3/R2**: presigned GET de 1 hora;
- **local**: URL da API assinada por HMAC (`/api/assets/local/{key}?exp=&sig=`), com o segredo derivado do `JWT_SECRET`.

As respostas de produto (e de identidade visual) do admin trazem `imageUrl` já resolvido e `imageAssetKey` com a chave crua, usada para salvar. O cardápio público continua no proxy atual (`/api/public/tenants/{slug}/products/{id}/image`), sem mudança.

**Rationale**: o admin usa `<img src={product.imageUrl}>`, e com uma chave do bucket a imagem quebra (é o caso da imagem de teste de 16/11). Um `<img>` não envia o token Bearer, então um endpoint autenticado não serve. A URL assinada é curta e não expõe o bucket.

**Alternatives considered**: um proxy na rota do Next.js com o cookie de sessão. Funcionaria, mas passaria os bytes pelo servidor web e duplicaria a lógica.

## R8. Migração das imagens base64

**Decision**: `LegacyImageMigrationService`, um job durável (`LEGACY_IMAGE_MIGRATION`) disparado por `POST /api/admin/assets/legacy-images/migrate` (loja do token, permissão `catalog.manage`). Ele processa **um registro por vez**:
1. lê só o id e o valor;
2. valida o `data:image/(png|jpeg|webp);base64,` e o tamanho decodificado (≤ 5 MB nesta migração, porque o legado tem fotos de até 2,1 MB em base64);
3. grava em `imageKey(...)`;
4. faz um `updateMany where { id, imageUrl: valorAntigo }` com a chave. Se o valor mudou no meio, apaga o arquivo recém-gravado.

Em caso de falha, mantém o base64 e registra `catalog.legacy_image.failed`. A contagem final fica no resultado do job.

**Rationale**:
- Um registro por vez limita a memória a cerca de 2 imagens.
- O update condicional evita sobrescrever uma foto trocada pelo usuário durante a migração.
- A operação é idempotente: valores que já são chave são ignorados.

**FR-019**: depois da migração, `normalizeImageValue` recusa `data:`. A web já envia imagens por URL assinada (não existe `readAsDataURL` em produção), então a mudança não afeta o uso normal.

**FR-020**: `updateProduct`, `deleteProduct` e a gravação da identidade visual apagam a chave anterior, se ela for do bucket e diferente da nova, depois do commit e em modo best effort.

## R9. Node 22

**Decision**: `"engines": { "node": ">=22 <23" }` na raiz, um `.node-version` com `22` e a variável `NODE_VERSION=22` no Render, se o painel não ler o `engines`. Validar build, typecheck e testes em Node 22 numa worktree fora do OneDrive (memória do projeto: o build do Next trava no OneDrive).

**Rationale**: o `@aws-sdk/*` v3 avisa que vai exigir Node 22 ou superior, e o Node 20 está no fim do suporte. A tarefa fica isolada (fase D) para que uma regressão de runtime não se misture às outras mudanças.

## R10. Storage local em produção

**Decision**: na subida, se `NODE_ENV=production` e `ASSET_STORAGE_PROVIDER=local`, registrar o log `storage.local_in_production` em nível `warn`. A prontidão fiscal ganha o item `STORAGE`, que não bloqueia a emissão: "Arquivos fiscais em storage temporário".

**Rationale**: foi exatamente o que aconteceu até 16/11, sem nenhum sinal. O item não bloqueia a emissão porque a nota continua válida no provedor.
