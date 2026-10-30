# Data Model: Módulo Fiscal — NFC-e

Migração: `packages/database/prisma/migrations/20261031100000_fiscal_nfce/`. Toda tabela nova tem `tenant_id` (exceto a configuração de plataforma) e índices iniciados por `tenant_id`.

## Enums novos

```prisma
enum FiscalProvider { BLING }
enum FiscalEnvironment { HOMOLOGATION PRODUCTION }
enum FiscalEmissionMode { AUTOMATIC MANUAL }
enum FiscalTaxRegime { SIMPLES_NACIONAL }
enum FiscalConnectionStatus { DRAFT CONNECTED ERROR DISCONNECTED }
enum FiscalCertificateStatus { ACTIVE REPLACED REMOVED }

enum FiscalDocumentStatus {
  PENDING            // criado, ainda não enviado
  PROCESSING         // enviado, aguardando SEFAZ/provedor
  AUTHORIZED
  REJECTED           // rejeição SEFAZ ou validação — corrigir e reemitir
  ERROR              // falha técnica esgotada — reprocessar
  CANCEL_PENDING     // cancelamento iniciado (API em andamento ou ação manual no provedor)
  CANCELLED
  CANCEL_FAILED      // fora do prazo / recusado — tratamento manual
}

enum FiscalDocumentEventType {
  CREATED SUBMITTED AUTHORIZED REJECTED ERROR RETRY_SCHEDULED
  SYNCED CANCEL_REQUESTED CANCEL_MANUAL_REQUIRED CANCELLED CANCEL_FAILED
  DOCUMENTS_STORED RETROACTIVE_CONFIRMED
}
```

Extensões: `BackgroundJobType += FISCAL_EMISSION, FISCAL_SYNC, FISCAL_CANCELLATION, FISCAL_SWEEP, SALES_AUTO_IMPORT`; `SalesRunTrigger += AUTOMATIC`.

## Tabelas novas

### `FiscalConfiguration` (1 por empresa)

| Campo | Tipo | Notas |
|---|---|---|
| tenantId | uuid unique | |
| enabled | bool, default false | |
| provider | FiscalProvider? | |
| environment | FiscalEnvironment, default HOMOLOGATION | |
| series | int? | Informativo/validação; numeração controlada pelo provedor |
| emissionMode | FiscalEmissionMode, default MANUAL | |
| eligibleSources | OrderSource[], default [COUNTER, IMPORT, API] | Só aceita esses três nesta fase |
| defaultCancelReason | varchar(255), default "Venda cancelada a pedido do cliente" | ≥ 15 caracteres |
| enabledAt | timestamp? | Marco da ativação (auditoria) |
| updatedByUserId, createdAt, updatedAt | | |

### `FiscalIssuer` (1 por empresa)

| Campo | Tipo | Notas |
|---|---|---|
| tenantId | uuid unique | |
| legalName | varchar(120) | Razão social |
| tradeName | varchar(120)? | Default: nome da loja |
| cnpj | char(14) | Só dígitos, DV validado |
| stateRegistration | varchar(20) | IE, validada para a UF |
| taxRegime | FiscalTaxRegime | |
| municipalityIbgeCode | char(7) | Resolvido (R6) ou manual |
| municipalityIbgeSource | varchar(10) | `IBGE_API` \| `MANUAL` |

O endereço não é duplicado: vem de `Tenant.config.address`. O snapshot completo do emitente fica em `FiscalDocument.issuerSnapshot`.

### `FiscalProviderConnection`

Segue `SalesIntegration` + `SalesIntegrationCredential`, simplificado.

| Campo | Tipo | Notas |
|---|---|---|
| tenantId, provider | unique(tenantId, provider) | Histórico preservado ao trocar de provedor |
| status | FiscalConnectionStatus | |
| credentialCiphertext | text? | Envelope `BLING_OAUTH` {accessToken, refreshToken} |
| tokenExpiresAt, refreshTokenExpiresAt | timestamp? | |
| externalAccountId | varchar? | Identificação da conta no provedor |
| settings | jsonb | Bling: `{ naturezaOperacaoId, paymentMethodMap: {CASH: id, ...}, storeId? }` |
| connectedAt, disconnectedAt, lastValidationAt | timestamp? | |
| lastErrorCode, lastErrorMessage | varchar? | Sem dados sensíveis |

### `PlatformFiscalProviderConfiguration` (global)

`provider FiscalProvider @unique`, `configurationCiphertext` ({clientId, clientSecret, redirectUri}), `updatedByUserId`. Separada de `PlatformIntegrationConfiguration` porque ela é indexada por `SalesProvider`.

### `FiscalCertificate`

| Campo | Tipo | Notas |
|---|---|---|
| tenantId | uuid | |
| status | FiscalCertificateStatus | Um ACTIVE por empresa (unique parcial via `activeKey` = tenantId quando ACTIVE) |
| secretCiphertext | text | Envelope `FISCAL_A1_CERTIFICATE` {pfxBase64, password} |
| subjectName, cnpj | varchar | |
| validFrom, validTo | timestamp | |
| fingerprintSha256 | char(64) | |
| lastExpiryAlertDays | int? | Evita alerta duplicado (30/15/7/1) |
| uploadedByUserId, createdAt, replacedAt | | |

### `FiscalProfile`

| Campo | Tipo | Notas |
|---|---|---|
| tenantId | uuid | unique(tenantId, name) |
| name | varchar(80) | |
| ncm | char(8) | |
| cfop | char(4) | 5xxx para NFC-e |
| csosn | char(3) | Permitidos: 101, 102, 103, 300, 400, 500, 900 |
| origin | smallint 0–8 | |
| commercialUnit | varchar(6) | Default `UN` |
| cest | char(7)? | Obrigatório quando csosn = 500 (e 201/202/203 se habilitados no futuro) |
| benefitCode | varchar(10)? | cBenef (SP) quando aplicável |
| active | bool | |

Referências novas (FK opcional, `onDelete: Restrict`):
- `Category.fiscalProfileId`
- `Product.fiscalProfileId`
- `ProductComplement.fiscalProfileId`

### `FiscalDocument`

| Campo | Tipo | Notas |
|---|---|---|
| tenantId | uuid | |
| orderId | uuid? | XOR com `serviceTabId` (CHECK) |
| serviceTabId | uuid? | Comanda inteira |
| activeKey | varchar? unique | `order:<id>` / `tab:<id>` em todos os status, exceto REJECTED e CANCELLED (`null`). Garante uma nota ativa por venda. ERROR mantém a chave porque a nota pode ter sido autorizada no provedor; o reprocessamento reusa o mesmo documento |
| provider, environment | | Congelados na emissão |
| status | FiscalDocumentStatus | |
| trigger | varchar(12) | `AUTOMATIC` \| `MANUAL` \| `RETROACTIVE` |
| externalId | varchar? | Id no provedor, gravado antes do envio |
| number, series | int? | |
| accessKey | char(44)? | unique quando presente |
| protocol | varchar? | |
| issuedAt, authorizedAt | timestamp? | |
| saleOccurredAt | timestamp | Data da venda (regra do dia e métrica dos 5 minutos) |
| totalAmount | decimal(12,2) | |
| consumerDocument | varchar(14)? | CPF/CNPJ só dígitos |
| issuerSnapshot | jsonb | Emitente + endereço no momento da emissão |
| payloadSnapshot | jsonb | Rascunho neutro (itens, pagamentos), sem segredos |
| rejectionCode, rejectionMessage | varchar? | |
| xmlAssetKey, danfeAssetKey | varchar? | `fiscal/<tenant>/<aaaa>/<mm>/<chave>.xml\|pdf` |
| qrCodeUrl, consultationUrl | varchar? | |
| cancelReason | varchar(255)? | |
| cancelRequestedAt, cancelDeadlineAt, cancelledAt | timestamp? | |
| cancelProtocol, cancelXmlAssetKey | varchar? | |
| attempts | int | |
| nextSyncAt | timestamp? | Agenda da sincronização |
| requestedByUserId | uuid? | null = automático |
| createdAt, updatedAt | | |

Índices:
- `(tenantId, status)`
- `(tenantId, orderId)`
- `(tenantId, serviceTabId)`
- `(tenantId, saleOccurredAt)`
- `(status, nextSyncAt)` (sincronização global)

### `FiscalDocumentEvent`

`tenantId`, `documentId`, `type`, `actorUserId?`, `providerStatus?`, `code?`, `message?`, `metadata jsonb` (sanitizado: sem tokens, sem XML completo), `createdAt`. Índice `(tenantId, documentId, createdAt)`.

## Alterações em tabelas existentes

| Tabela | Campo | Notas |
|---|---|---|
| `orders` | `consumerDocument varchar(14)?` | CPF/CNPJ na nota (balcão) |
| `service_tabs` | `consumerDocument varchar(14)?` | CPF/CNPJ na nota (comanda) |
| `sales_integrations` | `autoImportEnabled bool default false` | |
| | `autoImportStrategy varchar?` | `PRICE_WEIGHTED` \| `FIXED_PRODUCT` |
| | `autoImportFixedProductId uuid?` | |
| | `autoImportLastSuccessAt timestamp?` | |
| | `autoImportConsecutiveFailures int default 0` | |
| | `autoImportLastErrorCode varchar?` | |
| | `autoImportLastAlertAt timestamp?` | Limita a 1 alerta/hora |
| `categories`, `products`, `product_complements` | `fiscalProfileId uuid?` | |

O status fiscal mostrado no pedido é derivado do `FiscalDocument` mais recente do pedido (ou da comanda do pedido). Sem documento: "Não emitida" (ou "Não aplicável" se a origem não é elegível ou o total é zero). Não há coluna desnormalizada em `orders`.

## Transições de `FiscalDocumentStatus`

```text
PENDING → PROCESSING → AUTHORIZED → CANCEL_PENDING → CANCELLED
   │          │                          └→ CANCEL_FAILED → (CANCELLED via sync, se cancelado depois no provedor)
   │          ├→ REJECTED   (activeKey liberado; reemissão cria novo documento)
   └──────────┴→ ERROR      (mantém activeKey; "Reprocessar" consulta o provedor e volta a PENDING/PROCESSING/AUTHORIZED)
```

O cancelamento pedido durante PROCESSING é guardado em `cancelRequestedAt`; ao autorizar, o documento vai direto para CANCEL_PENDING.
