# Contratos: Módulo Fiscal

Respostas em JSON e mensagens em português. Valores monetários em string decimal (`"12.50"`). O tenant vem sempre do usuário autenticado; ids de outra empresa respondem 404. Nenhuma resposta contém tokens, arquivo ou senha de certificado, nem XML completo.

## Permissões novas (catálogo de acesso, área "Fiscal")

| Chave | Ação | Uso |
|---|---|---|
| `fiscal.view` | VIEW | Ver configuração, notas, pendências; baixar DANFE/XML |
| `fiscal.configure` | MANAGE (sensível) | Emitente, provedor, certificado, perfis fiscais, importação automática no fiscal |
| `fiscal.issue` | CREATE | Emitir/reprocessar; emissão retroativa |
| `fiscal.cancel` | DELETE (sensível) | Cancelar NFC-e sem cancelar o pedido; recebe as notificações de cancelamento |

Perfis padrão no seed: dono/admin recebem todas; operador recebe `fiscal.view` e `fiscal.issue`.

## Plataforma — `platform/integrations/bling/configuration`

- `GET` → `{ configured: boolean, clientId: string|null, redirectUri: string, updatedAt }`
- `PUT` `{ clientId, clientSecret }` → mesmo formato (segredo nunca retornado)

## Configuração — `admin/fiscal`

### `GET admin/fiscal/configuration` (`fiscal.view`)
```json
{
  "enabled": false,
  "provider": "BLING",
  "environment": "HOMOLOGATION",
  "series": 1,
  "emissionMode": "AUTOMATIC",
  "eligibleSources": ["COUNTER", "IMPORT", "API"],
  "defaultCancelReason": "Venda cancelada a pedido do cliente",
  "issuer": {
    "legalName": "...", "tradeName": "...", "cnpj": "12345678000190", "stateRegistration": "...",
    "taxRegime": "SIMPLES_NACIONAL", "municipalityIbgeCode": "3550308", "municipalityIbgeSource": "IBGE_API",
    "address": { "street": "...", "number": "...", "complement": null, "neighborhood": "...", "city": "São Paulo", "state": "SP", "postalCode": "01000000" },
    "missingAddressFields": []
  },
  "connection": { "provider": "BLING", "status": "CONNECTED", "connectedAt": "...", "lastErrorMessage": null, "capabilities": { "cancelViaApi": false, "usesOwnCertificate": false } },
  "certificate": { "subjectName": "...", "cnpj": "...", "validTo": "...", "daysToExpire": 120, "cnpjMatchesIssuer": true } ,
  "readiness": { "ready": false, "items": [ { "key": "PAYMENT_MAP", "ok": false, "message": "Mapeie PIX para uma forma de pagamento do Bling" } ] }
}
```
`readiness.items[].key`: `ISSUER`, `ADDRESS`, `CONNECTION`, `CERTIFICATE` (só bloqueia se `usesOwnCertificate`), `DEFAULT_PROFILE`, `PRODUCTS_WITHOUT_PROFILE`, `PAYMENT_MAP`, `OPERATION_NATURE`.

### `PUT admin/fiscal/configuration` (`fiscal.configure`)
`{ enabled, provider, environment, series, emissionMode, defaultCancelReason }`. `enabled=true` exige `readiness.ready`, senão 409 com os itens pendentes. Trocar `provider` com documentos em PROCESSING/CANCEL_PENDING → 409.

### Dados da loja *(revisado em 2026-10-30; substitui `PUT admin/fiscal/issuer`)*
- `GET/PUT admin/store-profile` (`store.profile.manage`; dono e admin sempre): o admin vê e altera a própria loja (`name`, `phone`, `address`, `socialLinks`, `legalName`, `tradeName`, `cnpj`, `stateRegistration`, `taxRegime`, `municipalityIbgeCode`). Slug, domínio e ativação não são aceitos.
- `POST/PATCH platform/stores[/:id]` (plataforma): aceitam os mesmos campos fiscais, além dos já existentes.
- Validações: CNPJ (DV, alfanumérico), IE para a UF do endereço, código IBGE resolvido pela cidade/UF quando não informado (422 `IBGE_NOT_RESOLVED` se não encontrar).

### ~~`PUT admin/fiscal/issuer`~~ (removido)
`{ legalName, tradeName?, cnpj, stateRegistration, taxRegime, municipalityIbgeCode? }`. Sem `municipalityIbgeCode`, ele é resolvido pelo IBGE; se não resolver → 422 `IBGE_NOT_RESOLVED` pedindo o código manual.

### Conexão Bling
- `POST admin/fiscal/connections/bling/authorize` → `{ authorizationUrl }` (state assinado, 10 min)
- `GET integrations/bling/callback?code&state` → redireciona para `/admin/fiscal?connected=bling` ou `?error=...`
- `GET admin/fiscal/connections/bling/options` → `{ paymentForms: [{id, name}], operationNatures: [{id, name}] }`, lido do Bling
- `PUT admin/fiscal/connections/bling/settings` `{ naturezaOperacaoId, paymentMethodMap: { CASH: "id", PIX: "id", ... } }`
- `DELETE admin/fiscal/connections/bling` → desconecta (status DISCONNECTED, credenciais apagadas)

### Certificado
- `POST admin/fiscal/certificate` (multipart: `file` .pfx/.p12 até 20 KB, `password`) → metadados. Erros 422: `INVALID_PASSWORD`, `INVALID_FILE`, `EXPIRED`.
- `DELETE admin/fiscal/certificate` → status REMOVED.

### Perfis fiscais — `admin/fiscal/profiles`
- `GET` → `[{ id, name, ncm, cfop, csosn, origin, commercialUnit, cest, benefitCode, active, usage: { categories, products, complements } }]`
- `POST` / `PATCH :id` → validações FR-009. `DELETE :id` em uso → 409 com `usage`.
- `PUT admin/fiscal/profile-assignments` `{ categories: [{id, fiscalProfileId|null}], products: [...], complements: [...] }` (atribuição em lote)
- `GET admin/fiscal/profile-assignments/missing` → produtos/complementos ativos sem perfil resolvido

## Documentos — `admin/fiscal/documents`

### `GET admin/fiscal/documents` (`fiscal.view`)
Filtros: `status[]`, `from`, `to` (data da venda), `orderId`, `serviceTabId`, `pendingOnly=true` (fila de pendências), paginação `page`/`pageSize`.
Item: `{ id, target: { type: "ORDER"|"TAB", id, publicCode }, status, trigger, number, series, accessKey, totalAmount, saleOccurredAt, authorizedAt, rejectionCode, rejectionMessage, cancelDeadlineAt, pendingReason, providerPanelUrl, actions: ["REPROCESS","CANCEL","OPEN_IN_PROVIDER", ...] }`.

`pendingReason`: `REJECTED`, `ERROR`, `CANCEL_MANUAL_REQUIRED`, `CANCEL_FAILED`, `MISSING_FISCAL_DATA`, `PROVIDER_DISCONNECTED`, `SAME_DAY_NOT_ISSUED`.

### `GET admin/fiscal/documents/:id` → item + `consumerDocumentMasked`, `events[]`, `qrCodeUrl`, `consultationUrl`.

### `GET admin/fiscal/documents/:id/danfe` e `/xml` (`fiscal.view`) → stream do storage (`application/pdf` / `application/xml`). Sem cópia local: busca no provedor, grava e devolve.

### `POST admin/fiscal/emissions` (`fiscal.issue`)
`{ target: { type: "ORDER"|"TAB", id }, consumerDocument?, confirmRetroactive?: boolean }`
- 202 `{ documentId, status: "PENDING" }`
- 409 `ALREADY_ISSUED` (documento ativo), `NOT_ELIGIBLE` (origem/status/valor), `NOT_READY` (prontidão)
- 422 `RETROACTIVE_CONFIRMATION_REQUIRED` quando a venda é de dia anterior e `confirmRetroactive` não veio

### `POST admin/fiscal/documents/:id/reprocess` (`fiscal.issue`) → ERROR/REJECTED: consulta o provedor e reenvia ou cria um novo documento (REJECTED). 202.

### `POST admin/fiscal/documents/:id/cancel` (`fiscal.cancel`) `{ reason }` (15–255) → 202 `{ status: "CANCEL_PENDING", manualActionRequired: true, cancelDeadlineAt, providerPanelUrl }`.

### `POST admin/fiscal/documents/:id/tax-divergence/review` (`fiscal.configure` ou `fiscal.issue`) → marca como revisada a divergência de CFOP/CSOSN da nota (após ajustar a natureza no provedor). 409 `NO_TAX_DIVERGENCE` quando a nota não tem divergência. Retorna o detalhe da nota.

### `POST admin/fiscal/documents/:id/sync` (`fiscal.cancel` ou `fiscal.issue`) → "Já cancelei no provedor": força uma sincronização imediata com o provedor (não altera o status sem confirmação do provedor).

### Exportação
`POST admin/exports` com `context: "FISCAL_XML"` e `{ from, to }` → job da infraestrutura de exportação; gera um ZIP (`autorizadas/`, `canceladas/`, `resumo.csv`) e notifica quando pronto. Exclui documentos HOMOLOGATION.

## Alterações em endpoints existentes

- **Pedido (lista/detalhe/KDS)**: o pedido ganha `fiscal: { status, documentId, number, accessKey, consultationUrl, pendingReason } | null` (status derivado; "NOT_ISSUED" / "NOT_APPLICABLE").
- **Lista de pedidos**: filtro `fiscalStatus[]`.
- **Balcão e comanda**: os DTOs de criação/checkout aceitam `consumerDocument?` (CPF/CNPJ com DV).
- **Manutenção de pedido / atualização de pedido de balcão**: 409 `FISCAL_DOCUMENT_ACTIVE` quando há nota AUTHORIZED/PROCESSING.
- **Link de WhatsApp do pedido**: inclui `consultationUrl` quando autorizado.
- **Integração de vendas** (`PATCH admin/sales-integrations/:id`): `autoImport: { enabled, strategy: "PRICE_WEIGHTED"|"FIXED_PRODUCT", fixedProductId? }`; o GET devolve também `autoImport.health: { lastSuccessAt, consecutiveFailures, lastErrorCode, lagSeconds, degraded }`.

## Contrato interno do provedor fiscal

```ts
export interface FiscalProviderCapabilities {
  cancelViaApi: boolean;
  usesOwnCertificate: boolean;     // provedor recebe o A1 do ERP
  documentDownload: "INLINE" | "LINK" | "NONE";
  panelUrl?: (externalId: string) => string;
}

export interface NfceDraft {      // neutro, montado pelo compositor
  reference: string;               // id do FiscalDocument (idempotência/rastreio)
  environment: "HOMOLOGATION" | "PRODUCTION";
  issuer: IssuerSnapshot;
  consumer?: { document: string };
  items: Array<{ code: string; description: string; quantity: string; unitPrice: string; grossAmount: string;
                 discount: string; freight: string; otherExpenses: string; ncm: string; cfop: string; csosn: string;
                 origin: number; unit: string; cest: string | null; benefitCode: string | null }>;
  payments: Array<{ method: PaymentMethod; tPag: string; amount: string }>;
  change: string;
  total: string;
  additionalInfo?: string;
}

export type ProviderDocumentState =
  | { status: "PROCESSING"; externalId: string }
  | { status: "AUTHORIZED"; externalId: string; number: number; series: number; accessKey: string;
      protocol?: string; authorizedAt: string; qrCodeUrl?: string; consultationUrl?: string }
  | { status: "REJECTED"; externalId?: string; code: string; message: string }
  | { status: "CANCELLED"; externalId: string; cancelledAt?: string; protocol?: string };

export interface FiscalProviderAdapter {
  readonly provider: FiscalProvider;
  readonly capabilities: FiscalProviderCapabilities;
  create(ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string }>;
  submit(ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState>;
  get(ctx: ProviderContext, externalId: string): Promise<ProviderDocumentState>;
  findByReference(ctx: ProviderContext, draft: NfceDraft): Promise<{ externalId: string } | null>; // recuperação de timeout
  panelUrl(externalId: string): string | null;                      // atalho do cancelamento assistido
  validateSettings(settings: Record<string, unknown>): FiscalSettingsIssue[]; // itens PAYMENT_MAP / OPERATION_NATURE da prontidão
  cancel?(ctx: ProviderContext, externalId: string, reason: string): Promise<ProviderDocumentState>;
  downloadXml(ctx: ProviderContext, externalId: string, kind: "AUTHORIZATION" | "CANCELLATION"): Promise<Buffer | null>;
  downloadDanfe(ctx: ProviderContext, externalId: string): Promise<Buffer | null>;
}
```

Erros do adapter: `FiscalProviderError(code: "AUTHENTICATION" | "RATE_LIMIT" | "UNAVAILABLE" | "TIMEOUT" | "VALIDATION" | "INCOMPATIBLE_RESPONSE", retryable, providerCode?, message)`, no mesmo padrão de `SalesProviderError`. `TIMEOUT` em `create` dispara `findByReference` antes de qualquer nova tentativa.

## Eventos de log (monitoria)

Formato: JSON numa linha via `Logger`, campos comuns `event`, `tenantId`, `provider`, `durationMs`, sem PII (CPF mascarado, sem tokens).

| Evento | Nível | Campos extras |
|---|---|---|
| `sales.auto_import.cycle` | log / warn em `failed` | `integrationId`, `result: success\|skipped\|failed`, `found`, `created`, `duplicate`, `unresolved`, `errorCode`, `lagSeconds`, `attempt` |
| `sales.auto_import.degraded` | warn | `integrationId`, `consecutiveFailures`, `lagSeconds`, `reason` |
| `fiscal.document.submitted` | log | `documentId`, `target`, `trigger` |
| `fiscal.document.authorized` | log | `documentId`, `saleToAuthorizationSeconds` |
| `fiscal.document.rejected` | warn | `documentId`, `code` |
| `fiscal.document.error` | error | `documentId`, `errorCode`, `attempt`, `retryable` |
| `fiscal.document.cancel_manual_required` | warn | `documentId`, `cancelDeadlineAt` |
| `fiscal.document.cancelled` | log | `documentId`, `via: API\|PROVIDER_PANEL` |
| `fiscal.document.cancel_failed` | error | `documentId`, `reason` |
| `fiscal.trigger.recovered` | warn | `target` (venda emitida pela varredura, não pelo hook) |
| `fiscal.connection.error` | error | `errorCode` (ex.: refresh do token falhou) |
| `fiscal.certificate.expiring` | warn | `daysToExpire` |
