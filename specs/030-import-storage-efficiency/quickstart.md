# Quickstart: spec 030 (operação e implantação)

Para quem implanta e opera a produção (Render + Cloudflare R2 + Postgres).

## 1. Bucket R2 (já criado em 16/11)

Variáveis no serviço `burgoos-api` (já configuradas, os valores ficam só no painel do Render):

| Variável | Valor |
|---|---|
| `ASSET_STORAGE_PROVIDER` | `s3` |
| `S3_BUCKET` | nome do bucket |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | token R2 com *Object Read & Write* só nesse bucket |

CORS do bucket (*Settings → CORS Policy*): `PUT` e `GET` liberados para a origem do admin, com o header `content-type`.

### 1.1 Regra de expiração das exportações

R2 → bucket → *Settings → Object lifecycle rules → Add rule*:
- **Name**: `exports-7-days`
- **Prefix**: `exports/`
- **Action**: *Delete objects* após **7 dias**

### 1.2 Trava de retenção dos arquivos fiscais

R2 → bucket → *Settings → Bucket lock rules → Add rule*:
- **Name**: `fiscal-5-years`
- **Prefix**: `fiscal/`
- **Retention**: **5 anos** (1825 dias)

Com a trava, nenhum arquivo em `fiscal/` pode ser apagado nem sobrescrito durante o prazo, nem pelo painel. Crie a regra **depois** da primeira recuperação (seção 4), para que a recuperação possa gravar os arquivos que faltam. A recuperação só grava chaves que ainda não existem, mas criar a trava depois evita que um erro de configuração vire um arquivo travado com conteúdo errado.

## 2. Fase A: importação enxuta + tela leve (US1/US2)

1. Merge em `develop` e depois em `main`. O deploy é automático.
2. Nos logs, `sales.auto_import.cycle` passa a trazer `known` e `reconciledOrders`. `found` continua igual.
3. A compactação roda na rotina diária de retenção (02:00 UTC = 23:00 em Brasília). Confira o log `sales.retention.completed`. Se `hasMore = true`, ela continua no dia seguinte.
4. Para conferir o volume (somente leitura):
   ```sql
   select count(*), pg_size_pretty(pg_total_relation_size('external_sales_movements'))
   from external_sales_movements;
   ```
5. **Devolver o espaço ao disco** (passo manual, numa janela sem movimento, por exemplo antes de abrir a loja):
   ```sql
   VACUUM (FULL, ANALYZE) external_sales_movements;
   VACUUM (FULL, ANALYZE) sales_import_runs;
   VACUUM (FULL, ANALYZE) sales_import_days;
   ```
   Isso bloqueia as tabelas por alguns segundos. A importação automática do ciclo seguinte se recupera sozinha. Rode pelo `psql` com a *External Database URL* do Render.

## 3. Fase A: validação da tela

- Abrir **Pedidos → Importar** pela manhã: a página deve abrir em até 3 s.
- Na aba *Network* do navegador, a carga da página fica abaixo de 200 KB.
- No Render, *Metrics → Memory*: sem degrau relevante na abertura.

## 4. Fase B: chaves novas e recuperação dos XMLs (US3)

1. Deploy da fase B.
2. **Fiscal → Configuração**: a prontidão não mostra o aviso `STORAGE` (o storage já é S3).
3. Disparar a recuperação: botão **Recuperar arquivos** na tela Fiscal, ou `POST /api/admin/fiscal/files/recovery`.
4. Acompanhar o log `fiscal.files.recovery_completed` (`recovered` / `missing`).
5. Notas em `missing` aparecem em **Pendências** como "Arquivo fiscal indisponível", com o motivo.
6. Depois disso, criar a trava da seção 1.2.

## 5. Fase C: migração das imagens (US4)

1. Deploy da fase C.
2. **Cardápio → Produtos → Migrar imagens antigas**, ou `POST /api/admin/assets/legacy-images/migrate`.
3. Acompanhar `catalog.legacy_image.migrated` / `.failed` e o `GET` de situação.
4. Conferir que o cardápio público e o admin mostram as fotos.
5. Conferir o tamanho da tabela (meta abaixo de 1 MB):
   ```sql
   select pg_size_pretty(pg_total_relation_size('products'));
   ```
   Para devolver o espaço: `VACUUM (FULL, ANALYZE) products; VACUUM (FULL, ANALYZE) store_visual_configurations;`

## 6. Fase D: Node 22

1. Localmente: instalar Node 22 e rodar `npm ci && npm run typecheck && npm test && npm run build`, com a web numa worktree fora do OneDrive.
2. No Render: o `engines.node` do `package.json` define a versão. Se o build ainda usar a 20, crie `NODE_VERSION=22` nos dois serviços.
3. Depois do deploy, o aviso `NodeVersionSupportWarning` some dos logs de subida.

## 7. Desenvolvimento local

- `ASSET_STORAGE_PROVIDER=local` continua funcionando. As imagens do admin usam URLs locais assinadas (`/api/assets/local/...`).
- Para testar contra o R2, use um **bucket separado** do de produção.
